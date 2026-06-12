package com.lotofopps.suggestions.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lotofopps.suggestions.dto.InvoiceItem;
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

Give 2-4 specific, actionable suggestions. Reference actual items from the invoices where possible (e.g., "You uploaded a hotel in Berlin — do you have the train or flight receipt?"). Be concise.""";

    private final String llmUrl;
    private final String llmModel;
    private final int invoiceLimit;
    private final SuggestionRepository suggestionRepository;
    private final InvoiceClient invoiceClient;
    private final RestTemplate restTemplate;

    public SuggestionService(
            @Value("${llm.url}") String llmUrl,
            @Value("${llm.model}") String llmModel,
            @Value("${suggestions.invoice-limit:5}") int invoiceLimit,
            SuggestionRepository suggestionRepository,
            InvoiceClient invoiceClient,
            RestTemplate restTemplate) {
        this.llmUrl = llmUrl.endsWith("/") ? llmUrl.substring(0, llmUrl.length() - 1) : llmUrl;
        this.llmModel = llmModel;
        this.invoiceLimit = invoiceLimit;
        this.suggestionRepository = suggestionRepository;
        this.invoiceClient = invoiceClient;
        this.restTemplate = restTemplate;
    }

    public List<SuggestionResponse> getSuggestions(String userId) {
        List<InvoiceItem> invoices = invoiceClient.fetchLatestInvoices(userId, invoiceLimit);
        if (invoices.isEmpty()) {
            return List.of();
        }

        if (needsNewSuggestion(userId, invoices)) {
            generateAndStore(userId, invoices);
        }

        return suggestionRepository.findTop5ByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(SuggestionResponse::from).toList();
    }

    /**
     * Only call the LLM when invoices were uploaded after the most recent
     * stored suggestion, so dashboard reloads don't trigger redundant
     * generations.
     */
    private boolean needsNewSuggestion(String userId, List<InvoiceItem> invoices) {
        Optional<Suggestion> latest = suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(userId);
        if (latest.isEmpty()) {
            return true;
        }
        Optional<LocalDateTime> newestInvoice = invoices.stream()
                .map(InvoiceItem::createdAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder());
        return newestInvoice.map(t -> latest.get().getCreatedAt().isBefore(t)).orElse(false);
    }

    private void generateAndStore(String userId, List<InvoiceItem> invoices) {
        try {
            String text = callLlm(invoices);
            if (text != null && !text.isBlank()) {
                suggestionRepository.save(new Suggestion(userId, text.strip()));
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

    private String callLlm(List<InvoiceItem> invoices) throws Exception {
        String context = invoices.stream()
                .map(inv -> String.format("- %s | %s | %s EUR | %s | %s",
                        Objects.toString(inv.itemName(), ""),
                        Objects.toString(inv.company(), ""),
                        Objects.toString(inv.price(), ""),
                        Objects.toString(inv.category(), ""),
                        Objects.toString(inv.invoiceDate(), "")))
                .collect(Collectors.joining("\n"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", llmModel);
        body.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content",
                        "Here are the user's uploaded invoices:\n" + context
                                + "\n\nWhat tax documents are missing? Give specific suggestions.")));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer EMPTY");

        ResponseEntity<String> response = restTemplate.exchange(
                llmUrl + "/v1/chat/completions", HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);

        JsonNode root = MAPPER.readTree(response.getBody());
        return root.path("choices").get(0).path("message").path("content").asText();
    }
}
