package com.lotofopps.export.client;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.InvoiceResponse;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Reads the user's invoices and receipts from invoice-service.
 *
 * <p>Unlike suggestions-service, this talks to invoice-service's <em>public</em> {@code /api/v1}
 * endpoints rather than {@code /internal/v1}, forwarding the {@code X-User-Sub} that Traefik's
 * forward-auth middleware resolved. invoice-service therefore applies its own per-user scoping and
 * document-ownership checks to every read, instead of this service being trusted to pass the right
 * {@code userId}. The endpoints are reached directly on the cluster-internal address, so they never
 * traverse the public gateway.
 */
@Service
public class InvoiceServiceClient {

    private static final String USER_HEADER = "X-User-Sub";

    private final String invoiceServiceUrl;
    private final RestTemplate restTemplate;

    public InvoiceServiceClient(
            @Value("${invoice.service.url}") String invoiceServiceUrl, RestTemplate restTemplate) {
        this.invoiceServiceUrl =
                invoiceServiceUrl.endsWith("/")
                        ? invoiceServiceUrl.substring(0, invoiceServiceUrl.length() - 1)
                        : invoiceServiceUrl;
        this.restTemplate = restTemplate;
    }

    /** Accepted invoices only; invoices still under review must never reach a tax export. */
    public List<InvoiceResponse> fetchAcceptedInvoices(String userId, Integer year) {
        UriComponentsBuilder uri =
                UriComponentsBuilder.fromUriString(invoiceServiceUrl + "/api/v1/invoices")
                        .queryParam("status", "ACCEPTED");
        if (year != null) {
            uri.queryParam("invoiceYear", year);
        }
        return getForList(uri.toUriString(), userId, new ParameterizedTypeReference<>() {});
    }

    public List<DocumentResponse> fetchDocuments(String userId) {
        return getForList(
                invoiceServiceUrl + "/api/v1/documents",
                userId,
                new ParameterizedTypeReference<>() {});
    }

    /**
     * The raw bytes of an uploaded receipt; invoice-service 403s documents owned by someone else.
     */
    public byte[] fetchDocumentContent(String userId, long documentId) {
        String url = invoiceServiceUrl + "/api/v1/documents/" + documentId + "/content";
        ResponseEntity<byte[]> response =
                restTemplate.exchange(
                        url, HttpMethod.GET, new HttpEntity<>(headers(userId)), byte[].class);
        byte[] body = response.getBody();
        if (!response.getStatusCode().is2xxSuccessful() || body == null) {
            throw new RestClientException(
                    "invoice-service returned no content for document " + documentId);
        }
        return body;
    }

    private <T> List<T> getForList(
            String url, String userId, ParameterizedTypeReference<List<T>> type) {
        ResponseEntity<List<T>> response =
                restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers(userId)), type);
        List<T> body = response.getBody();
        if (!response.getStatusCode().is2xxSuccessful() || body == null) {
            throw new RestClientException("invoice-service returned no body for " + url);
        }
        return body;
    }

    private static HttpHeaders headers(String userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(USER_HEADER, userId);
        return headers;
    }
}
