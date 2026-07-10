package com.lotofopps.backend.service;

import com.lotofopps.backend.grpc.DeleteRequest;
import com.lotofopps.backend.grpc.EmbedRequest;
import com.lotofopps.backend.grpc.EmbeddingServiceGrpc;
import com.lotofopps.backend.model.Invoice;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LlmChatEmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(LlmChatEmbeddingService.class);

    private static final Map<String, String> CATEGORY_LABELS =
            Map.ofEntries(
                    Map.entry("KONTOFUEHRUNGSGEBUEHREN", "Kontoführungsgebühren"),
                    Map.entry("WEGE_ZUR_ARBEIT", "Wege zur Arbeit"),
                    Map.entry("HOMEOFFICE_UND_ARBEITSZIMMER", "Homeoffice und Arbeitszimmer"),
                    Map.entry("INTERNET_UND_TELEFON", "Internet und Telefon"),
                    Map.entry("ARBEITSMITTEL", "Arbeitsmittel"),
                    Map.entry(
                            "BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN",
                            "Berufsverbände und Gewerkschaften"),
                    Map.entry("STEUERBERATUNGSKOSTEN", "Steuerberatungskosten"),
                    Map.entry("REISEKOSTEN", "Reisekosten"),
                    Map.entry("BEWERBUNGEN", "Bewerbungen"),
                    Map.entry("FORTBILDUNGEN", "Fortbildungen"),
                    Map.entry("UMZUG", "Umzug"),
                    Map.entry("BEWIRTUNG", "Bewirtung"),
                    Map.entry("DOPPELTER_HAUSHALT", "Doppelter Haushalt"),
                    Map.entry(
                            "AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN", "Außergewöhnliche Fahrzeugkosten"),
                    Map.entry("SONSTIGE_AUSGABEN", "Sonstige Ausgaben"));

    private final EmbeddingServiceGrpc.EmbeddingServiceBlockingStub embeddingStub;

    public LlmChatEmbeddingService(
            EmbeddingServiceGrpc.EmbeddingServiceBlockingStub embeddingStub) {
        this.embeddingStub = embeddingStub;
    }

    // Vector-store sync is best-effort: swallow gRPC errors so an invoice write is never
    // blocked by llm-chat being down (same fire-and-forget contract as the former REST call).
    public void embedInvoice(Invoice invoice) {
        try {
            embeddingStub.embed(buildEmbedBody(invoice));
            log.info("Embedded invoice id={}", invoice.getId());
        } catch (Exception e) {
            log.warn("Failed to embed invoice id={}: {}", invoice.getId(), e.getMessage());
        }
    }

    public void deleteEmbedding(Long invoiceId) {
        try {
            embeddingStub.deleteEmbedding(
                    DeleteRequest.newBuilder().setInvoiceId(invoiceId).build());
            log.info("Deleted embedding for invoice id={}", invoiceId);
        } catch (Exception e) {
            log.warn("Failed to delete embedding for invoice id={}: {}", invoiceId, e.getMessage());
        }
    }

    private EmbedRequest buildEmbedBody(Invoice invoice) {
        EmbedRequest.Builder b =
                EmbedRequest.newBuilder()
                        .setInvoiceId(invoice.getId())
                        .setText(buildText(invoice))
                        .setUserId(invoice.getUserId() != null ? invoice.getUserId() : "")
                        .setItemName(invoice.getItemName() != null ? invoice.getItemName() : "N/A")
                        .setCompany(invoice.getCompany() != null ? invoice.getCompany() : "N/A");
        if (invoice.getPrice() != null) {
            b.setPrice(invoice.getPrice().doubleValue());
        }
        if (invoice.getCategory() != null) {
            b.setCategory(invoice.getCategory().name());
        }
        if (invoice.getInvoiceDate() != null) {
            b.setInvoiceDate(invoice.getInvoiceDate().toString());
        }
        if (invoice.getDocument() != null && invoice.getDocument().getId() != null) {
            b.setDocumentId(invoice.getDocument().getId());
        }
        return b.build();
    }

    private String buildText(Invoice invoice) {
        String dateStr =
                invoice.getInvoiceDate() != null
                        ? invoice.getInvoiceDate().toString()
                        : "unbekanntes Datum";
        String categoryLabel =
                invoice.getCategory() != null
                        ? CATEGORY_LABELS.getOrDefault(
                                invoice.getCategory().name(), invoice.getCategory().name())
                        : "Sonstige Ausgaben";
        String priceStr = invoice.getPrice() != null ? invoice.getPrice().toPlainString() : "0.00";

        return String.format(
                "Rechnung von %s vom %s: %s – Betrag: %s EUR – Kategorie: %s",
                invoice.getCompany(), dateStr, invoice.getItemName(), priceStr, categoryLabel);
    }
}
