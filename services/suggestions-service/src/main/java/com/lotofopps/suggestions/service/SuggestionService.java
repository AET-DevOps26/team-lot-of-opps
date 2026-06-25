package com.lotofopps.suggestions.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lotofopps.suggestions.client.model.InvoiceResponse;
import com.lotofopps.suggestions.dto.SuggestionResponse;
import com.lotofopps.suggestions.model.Suggestion;
import com.lotofopps.suggestions.repository.SuggestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SuggestionService {

    private static final Logger log = LoggerFactory.getLogger(SuggestionService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Ported verbatim from src/.old/ai-components/app/main.py
    private static final String SYSTEM_PROMPT = """
You are a German tax expert helping students maximize their tax refund.
Analyze the uploaded invoices and identify missing documents based on these German tax deduction pairs:
- Hotel receipt → flight/train receipt (Reisekosten require both)
- Train/flight receipt → hotel receipt
- Internet bill → phone bill (both deductible for home office)
- Work equipment (laptop, desk) → software licenses, accessories
- Training/course receipt → travel receipt to the training location
- Home office claim → internet bill
- Conference registration → travel + hotel receipts
- Business meal → names of attendees and business purpose

Return exactly 2 specific, actionable suggestions as JSON: {"suggestions": ["<first>", "<second>"]}. Each suggestion must be a single short sentence (max ~20 words) that references an actual item from the invoices where possible (e.g., "You uploaded a hotel in Berlin — do you have the train or flight receipt?"). Output only the JSON object.""";

    private final String llmUrl;
    private final String llmModel;
    private final String llmApiKey;
    private final int invoiceLimit;
    private final SuggestionRepository suggestionRepository;
    private final InvoiceClient invoiceClient;
    private final RestTemplate restTemplate;

    public SuggestionService(
            @Value("${llm.url}") String llmUrl,
            @Value("${llm.model}") String llmModel,
            @Value("${llm.api-key}") String llmApiKey,
            @Value("${suggestions.invoice-limit:5}") int invoiceLimit,
            SuggestionRepository suggestionRepository,
            InvoiceClient invoiceClient,
            RestTemplate restTemplate) {
        this.llmUrl = llmUrl.endsWith("/") ? llmUrl.substring(0, llmUrl.length() - 1) : llmUrl;
        this.llmModel = llmModel;
        this.llmApiKey = llmApiKey;
        this.invoiceLimit = invoiceLimit;
        this.suggestionRepository = suggestionRepository;
        this.invoiceClient = invoiceClient;
        this.restTemplate = restTemplate;
    }

    public List<SuggestionResponse> getSuggestions(String userId, String language) {
        String lang = normalizeLanguage(language);
        List<InvoiceResponse> invoices = invoiceClient.fetchLatestInvoices(userId, invoiceLimit);
        if (invoices.isEmpty()) {
            return List.of();
        }

        if (needsNewSuggestion(userId, invoices, lang)) {
            generateAndStore(userId, invoices, lang);
        }

        return suggestionRepository.findByUserIdOrderByIdAsc(userId)
                .stream().map(SuggestionResponse::from).toList();
    }

    /** The frontend only offers en/de; anything unrecognized falls back to English. */
    private static String normalizeLanguage(String language) {
        return "de".equalsIgnoreCase(language) ? "de" : "en";
    }

    /**
     * Call the LLM when invoices were uploaded after the most recent stored
     * suggestion (so dashboard reloads don't trigger redundant generations),
     * or when the stored suggestions are in a different language than requested.
     */
    private boolean needsNewSuggestion(String userId, List<InvoiceResponse> invoices, String language) {
        Optional<Suggestion> latest = suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(userId);
        if (latest.isEmpty()) {
            return true;
        }
        if (!language.equals(latest.get().getLanguage())) {
            return true;
        }
        Optional<LocalDateTime> newestInvoice = invoices.stream()
                .map(InvoiceResponse::getCreatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder());
        return newestInvoice.map(t -> latest.get().getCreatedAt().isBefore(t)).orElse(false);
    }

    private void generateAndStore(String userId, List<InvoiceResponse> invoices, String language) {
        try {
            List<String> suggestions = callLlm(invoices, language);
            if (!suggestions.isEmpty()) {
                // Replace the previous set so each suggestion is its own row and
                // stale suggestions don't accumulate.
                suggestionRepository.deleteByUserId(userId);
                suggestions.forEach(text -> suggestionRepository.save(new Suggestion(userId, text, language)));
            }
        } catch (Exception e) {
            // Fall back to previously stored suggestions; fail only if there are none.
            if (suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(userId).isEmpty()) {
                throw new RuntimeException("Failed to generate suggestions", e);
            }
            log.warn("Suggestion generation failed for user {}, returning stored suggestions: {}",
                    userId, e.getMessage());
        }
    }

    /** Ask the LLM for a structured {"suggestions": [...]} object and return at most two entries. */
    private List<String> callLlm(List<InvoiceResponse> invoices, String language) throws Exception {
        String context = invoices.stream()
                .map(inv -> String.format("- %s | %s | %s EUR | %s | %s",
                        Objects.toString(inv.getItemName(), ""),
                        Objects.toString(inv.getCompany(), ""),
                        Objects.toString(inv.getPrice(), ""),
                        Objects.toString(inv.getCategory(), ""),
                        Objects.toString(inv.getInvoiceDate(), "")))
                .collect(Collectors.joining("\n"));

        // Keep the German-tax domain prompt; only steer the output language.
        String languageName = "de".equals(language) ? "German" : "English";
        String systemPrompt = SYSTEM_PROMPT + "\nWrite each suggestion in " + languageName + ".";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", llmModel);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content",
                        "Here are the user's uploaded invoices:\n" + context
                                + "\n\nWhat tax documents are missing?")));
        body.put("response_format", SUGGESTIONS_SCHEMA);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + llmApiKey);

        ResponseEntity<String> response = restTemplate.exchange(
                llmUrl + "/v1/chat/completions", HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);

        String content = MAPPER.readTree(response.getBody())
                .path("choices").get(0).path("message").path("content").asText();

        List<String> suggestions = new ArrayList<>();
        for (JsonNode node : MAPPER.readTree(content).path("suggestions")) {
            String text = node.asText().strip();
            if (!text.isBlank()) {
                suggestions.add(text);
            }
            if (suggestions.size() == MAX_SUGGESTIONS) {
                break;
            }
        }
        return suggestions;
    }

    private static final int MAX_SUGGESTIONS = 2;

    // OpenAI-compatible structured-output request that constrains the model to
    // {"suggestions": ["...", "..."]} so we never have to parse free-form text.
    private static final Map<String, Object> SUGGESTIONS_SCHEMA = Map.of(
            "type", "json_schema",
            "json_schema", Map.of(
                    "name", "tax_suggestions",
                    "strict", true,
                    "schema", Map.of(
                            "type", "object",
                            "additionalProperties", false,
                            "required", List.of("suggestions"),
                            "properties", Map.of(
                                    "suggestions", Map.of(
                                            "type", "array",
                                            "minItems", MAX_SUGGESTIONS,
                                            "maxItems", MAX_SUGGESTIONS,
                                            "items", Map.of("type", "string"))))));
}
