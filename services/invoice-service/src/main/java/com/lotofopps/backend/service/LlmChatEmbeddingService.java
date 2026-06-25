package com.lotofopps.backend.service;

import com.lotofopps.backend.client.model.EmbedRequest;
import com.lotofopps.backend.model.Invoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class LlmChatEmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(LlmChatEmbeddingService.class);

    private static final Map<String, String> CATEGORY_LABELS = Map.ofEntries(
        Map.entry("KONTOFUEHRUNGSGEBUEHREN",          "Kontoführungsgebühren"),
        Map.entry("WEGE_ZUR_ARBEIT",                  "Wege zur Arbeit"),
        Map.entry("HOMEOFFICE_UND_ARBEITSZIMMER",     "Homeoffice und Arbeitszimmer"),
        Map.entry("INTERNET_UND_TELEFON",             "Internet und Telefon"),
        Map.entry("ARBEITSMITTEL",                    "Arbeitsmittel"),
        Map.entry("BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN","Berufsverbände und Gewerkschaften"),
        Map.entry("STEUERBERATUNGSKOSTEN",            "Steuerberatungskosten"),
        Map.entry("REISEKOSTEN",                      "Reisekosten"),
        Map.entry("BEWERBUNGEN",                      "Bewerbungen"),
        Map.entry("FORTBILDUNGEN",                    "Fortbildungen"),
        Map.entry("UMZUG",                            "Umzug"),
        Map.entry("BEWIRTUNG",                        "Bewirtung"),
        Map.entry("DOPPELTER_HAUSHALT",               "Doppelter Haushalt"),
        Map.entry("AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN","Außergewöhnliche Fahrzeugkosten"),
        Map.entry("SONSTIGE_AUSGABEN",                "Sonstige Ausgaben")
    );

    private final String llmChatUrl;
    private final RestTemplate restTemplate;

    public LlmChatEmbeddingService(
            @Value("${llm.chat.url}") String llmChatUrl,
            RestTemplate restTemplate) {
        this.llmChatUrl = llmChatUrl.endsWith("/")
                ? llmChatUrl.substring(0, llmChatUrl.length() - 1) : llmChatUrl;
        this.restTemplate = restTemplate;
    }

    public void embedInvoice(Invoice invoice) {
        try {
            EmbedRequest body = buildEmbedBody(invoice);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.exchange(
                    llmChatUrl + "/v1/embed",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class);
            log.info("Embedded invoice id={}", invoice.getId());
        } catch (Exception e) {
            log.warn("Failed to embed invoice id={}: {}", invoice.getId(), e.getMessage());
        }
    }

    public void deleteEmbedding(Long invoiceId) {
        try {
            restTemplate.delete(llmChatUrl + "/v1/embed/" + invoiceId);
            log.info("Deleted embedding for invoice id={}", invoiceId);
        } catch (Exception e) {
            log.warn("Failed to delete embedding for invoice id={}: {}", invoiceId, e.getMessage());
        }
    }

    private EmbedRequest buildEmbedBody(Invoice invoice) {
        return new EmbedRequest()
                .invoiceId(invoice.getId())
                .text(buildText(invoice))
                .userId(invoice.getUserId() != null ? invoice.getUserId() : "")
                .itemName(invoice.getItemName())
                .company(invoice.getCompany())
                .price(invoice.getPrice())
                .category(invoice.getCategory() != null ? invoice.getCategory().name() : null)
                .invoiceDate(invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : null)
                .documentId(invoice.getDocument() != null ? invoice.getDocument().getId() : null);
    }

    private String buildText(Invoice invoice) {
        String dateStr = invoice.getInvoiceDate() != null
                ? invoice.getInvoiceDate().toString() : "unbekanntes Datum";
        String categoryLabel = invoice.getCategory() != null
                ? CATEGORY_LABELS.getOrDefault(invoice.getCategory().name(), invoice.getCategory().name())
                : "Sonstige Ausgaben";
        String priceStr = invoice.getPrice() != null
                ? invoice.getPrice().toPlainString() : "0.00";

        return String.format(
            "Rechnung von %s vom %s: %s – Betrag: %s EUR – Kategorie: %s",
            invoice.getCompany(),
            dateStr,
            invoice.getItemName(),
            priceStr,
            categoryLabel
        );
    }
}
