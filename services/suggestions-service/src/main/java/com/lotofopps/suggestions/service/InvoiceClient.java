package com.lotofopps.suggestions.service;

import com.lotofopps.suggestions.client.model.InvoiceResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

@Service
public class InvoiceClient {

    private final String invoiceServiceUrl;
    private final RestTemplate restTemplate;

    public InvoiceClient(
            @Value("${invoice.service.url}") String invoiceServiceUrl,
            RestTemplate restTemplate) {
        this.invoiceServiceUrl = invoiceServiceUrl.endsWith("/")
                ? invoiceServiceUrl.substring(0, invoiceServiceUrl.length() - 1)
                : invoiceServiceUrl;
        this.restTemplate = restTemplate;
    }

    public List<InvoiceResponse> fetchLatestInvoices(String userId, int limit) {
        String url = UriComponentsBuilder
                .fromUriString(invoiceServiceUrl + "/internal/v1/invoices/latest")
                .queryParam("userId", userId)
                .queryParam("limit", limit)
                .toUriString();
        ResponseEntity<List<InvoiceResponse>> response = restTemplate.exchange(
                url, HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("invoice-service returned non-2xx or empty response for latest invoices");
        }
        return response.getBody();
    }
}
