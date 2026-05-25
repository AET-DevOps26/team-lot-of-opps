package com.lotofopps.backend.service;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.repository.InvoiceRepository;
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

        return invoiceRepository.saveAll(invoices);
    }

    private List<Map<String, Object>> sendToAiBackend(Document document) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(Paths.get(document.getStoragePath())));

        String contentType = document.getContentType();
        String url = (contentType != null && contentType.startsWith("image/"))
                ? aiBackendUrl + "/vision"
                : aiBackendUrl;

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                url, HttpMethod.POST, request,
                new ParameterizedTypeReference<>() {});

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
