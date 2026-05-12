package com.lotofopps.backend.service;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
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

    public Invoice extractAndStore(Document document) {
        Map<String, Object> aiResponse = sendToAiBackend(document);

        Invoice invoice = new Invoice(
                (String) aiResponse.get("product_name"),
                (String) aiResponse.get("company"),
                new BigDecimal(aiResponse.get("value").toString())
        );
        invoice.setUserId(document.getUserId());
        String rawDate = (String) aiResponse.get("invoice_date");
        if (rawDate != null) {
            invoice.setInvoiceDate(LocalDate.parse(rawDate));
        }
        invoice.setDocument(document);
        return invoiceRepository.save(invoice);
    }

    private Map<String, Object> sendToAiBackend(Document document) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(Paths.get(document.getStoragePath())));

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                aiBackendUrl, HttpMethod.POST, request,
                new ParameterizedTypeReference<>() {});

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("AI backend returned non-2xx or empty response");
        }
        return response.getBody();
    }
}
