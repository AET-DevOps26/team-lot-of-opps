package com.lotofopps.backend.service;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class AiBackendService {

    private static final Logger logger = LoggerFactory.getLogger(AiBackendService.class);

    private final String aiBackendUrl;
    private final InvoiceRepository invoiceRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    public AiBackendService(
            @Value("${ai.backend.url}") String aiBackendUrl,
            InvoiceRepository invoiceRepository) {
        this.aiBackendUrl = aiBackendUrl;
        this.invoiceRepository = invoiceRepository;
    }

    public List<Invoice> extractAndStore(Document document) {
        List<Map<String, Object>> items = sendToAiBackend(document);
        logger.info("AI backend returned {} item(s) for document {}", items.size(), document.getStoragePath());
        if (items.isEmpty()) {
            logger.warn("AI backend returned 0 items — no invoices will be created for document {}", document.getStoragePath());
        }

        List<Invoice> invoices = items.stream().map(item -> {
            Invoice invoice = new Invoice(
                    (String) item.get("product_name"),
                    (String) item.get("company"),
                    new BigDecimal(item.get("value").toString())
            );
            String rawDate = (String) item.get("invoice_date");
            if (rawDate != null) {
                invoice.setInvoiceDate(LocalDate.parse(rawDate));
            }
            invoice.setCategory(parseCategory((String) item.get("category")));
            invoice.setUserId(document.getUserId());
            invoice.setDocument(document);
            return invoice;
        }).toList();

        List<Invoice> saved = invoiceRepository.saveAll(invoices);
        saved.forEach(inv -> {
            try {
                storeEmbeddings(inv);
            } catch (Exception e) {
                logger.warn("Failed to store embeddings for invoice {}: {}", inv.getId(), e.getMessage());
            }
        });
        return saved;
    }

    private void storeEmbeddings(Invoice invoice) {
        String text = String.format("product: %s, company: %s, value: %s, date: %s, category: %s",
                invoice.getItemName(), invoice.getCompany(), invoice.getPrice(),
                invoice.getInvoiceDate(), invoice.getCategory());
        String base = aiBackendUrl.endsWith("/") ? aiBackendUrl.substring(0, aiBackendUrl.length() - 1) : aiBackendUrl;
        String url = base + "/embed";
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("invoice_id", invoice.getId());
        body.put("text", text);
        body.put("user_id", invoice.getUserId());
        body.put("item_name", invoice.getItemName());
        body.put("company", invoice.getCompany());
        body.put("price", invoice.getPrice());
        body.put("category", invoice.getCategory() != null ? invoice.getCategory().name() : null);
        body.put("invoice_date", invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : null);
        body.put("document_id", invoice.getDocument() != null ? invoice.getDocument().getId() : null);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Void.class);
        logger.info("Stored embeddings for invoice {}", invoice.getId());
    }

    public String getSuggestions(String userId, List<Invoice> invoices) {
        String base = aiBackendUrl.endsWith("/") ? aiBackendUrl.substring(0, aiBackendUrl.length() - 1) : aiBackendUrl;
        String url = base + "/suggestions";

        List<Map<String, Object>> items = invoices.stream().map(inv -> {
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("itemName", inv.getItemName());
            item.put("company", inv.getCompany());
            item.put("price", inv.getPrice());
            item.put("invoiceDate", inv.getInvoiceDate() != null ? inv.getInvoiceDate().toString() : null);
            item.put("category", inv.getCategory() != null ? inv.getCategory().name() : null);
            return item;
        }).toList();

        Map<String, Object> body = Map.of("userId", userId, "items", items);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, headers),
                new ParameterizedTypeReference<>() {});

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("AI backend returned non-2xx or empty response for suggestions");
        }
        return (String) response.getBody().get("answer");
    }

    public void deleteEmbeddings(Long invoiceId) {
        String url = aiBackendUrl + "/embed/" + invoiceId;
        restTemplate.exchange(url, HttpMethod.DELETE, null, Void.class);
    }

    private List<Map<String, Object>> sendToAiBackend(Document document) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(Paths.get(document.getStoragePath())));

        String base = aiBackendUrl.endsWith("/") ? aiBackendUrl.substring(0, aiBackendUrl.length() - 1) : aiBackendUrl;
        String url = base + "/extract";

        logger.info("Sending extract request to {} for document {}", url, document.getStoragePath());
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                url, HttpMethod.POST, request,
                new ParameterizedTypeReference<>() {});

        logger.info("AI backend responded with status {}", response.getStatusCode());
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("AI backend returned non-2xx or empty response");
        }
        return response.getBody();
    }

    private InvoiceCategory parseCategory(String raw) {
        if (raw == null) return null;
        try {
            return InvoiceCategory.valueOf(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
