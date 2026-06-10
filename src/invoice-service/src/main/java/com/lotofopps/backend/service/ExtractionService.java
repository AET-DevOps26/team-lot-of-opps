package com.lotofopps.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lotofopps.backend.dto.ExtractionItem;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.repository.InvoiceRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.*;

@Service
public class ExtractionService {

    private static final Logger log = LoggerFactory.getLogger(ExtractionService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Ported verbatim from src/ai-components/app/main.py
    private static final String ITEM_FIELDS = """
Return a JSON object with a single key "items" containing a list. Each element represents one line item and has:
- product_name: name of the item or service
- company: name of the SELLER who issued this invoice — the business or person who will receive payment. THE SELLER'S NAME IS ALMOST ALWAYS THE VERY FIRST WORD(S) AT THE TOP OF THE DOCUMENT, directly attached to the heading, e.g. "Kraushaar INVOICE" → seller is "Kraushaar"; "Süßebier INVOICE" → seller is "Süßebier"; "Margraf Koch II e.G. INVOICE" → seller is "Margraf Koch II e.G.". Look there FIRST. Return ONLY that short name. Rules — do NOT return any of the following, even though they look like company names: (1) the name in the BILL TO / TO / An / Empfänger block — that is the BUYER, a different person; (2) the company name written next to the word "Bank" in the PAYMENT DETAILS / BANK / IBAN section near the bottom — that is the seller's BANK, not the seller, even if it has a suffix like GmbH/AG/e.G.; (3) email addresses, phone numbers, VAT/tax IDs, IBAN numbers (2 letters + digits), street addresses, or the words INVOICE/RECHNUNG. Use the same seller value for every item.
- value: line item NET total as a decimal number — this is the rightmost "Subtotal" amount printed ON THAT SAME LINE ITEM ROW, i.e. Qty × Unit Price, NOT the unit price itself. Example row "2 Grocery Shopping 3 € 139.88 € 419.64" → Qty=3, Unit Price=139.88, and the value to return is 419.64 (the line's Subtotal/total column, last number on the row) — never the unit price. German invoices use comma as decimal separator — convert correctly: "418,93" → 418.93 (NOT 41893), "1.234,56" → 1234.56, "43,92" → 43.92. The comma is ALWAYS the decimal point, never strip it.
- invoice_date: date of the invoice in YYYY-MM-DD format. Convert any format: "10.10.2025" → "2025-10-10", "11 Aug 2025" → "2025-08-11". If there is only 1 date on the invoice take that one as the invoice_date. If there is more than 1 take the one on the line with invoice date. Return the date in this format: YYYY-MM-DD. For example: If the date on the invoice is: 11 Aug 2025. Convert to: 2025-08-11
- category: best matching category for this specific item (use exact enum string, fall back to SONSTIGE_AUSGABEN if unsure)

If the invoice has no individual line items, return a single item using the invoice's overall product/service description and grand total (Summe brutto / Gesamtbetrag).

Only extract rows that describe an actual product or service that was purchased. Do NOT create separate items for summary, fee, or metadata rows such as:
- Subtotals and totals: Subtotal, Zwischensumme, Summe, Gesamtbetrag, Grand Total, Total, Total due, Net total, Nettobetrag
- Taxes and charges: VAT, MwSt, USt, Tax, Government Tax, Service Charge, Bediengung
- Tips, donations, fees: Tip, Trinkgeld, Donation, Spende, Processing Fee, Convenience Fee, Bearbeitungsgebühr
- Payment metadata: Payment method, Zahlungsart, Paid via, or any row naming a payment provider (e.g. AIRWALLEX, Visa, PayPal, Mastercard) — these describe HOW the invoice was paid, not WHAT was purchased
If every row on the invoice is one of the above (i.e. there are no real product/service rows), fall back to the rule above: return a single item using the invoice's overall description and grand total.

Category values:
  KONTOFUEHRUNGSGEBUEHREN, WEGE_ZUR_ARBEIT, HOMEOFFICE_UND_ARBEITSZIMMER,
  INTERNET_UND_TELEFON, ARBEITSMITTEL, BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN,
  STEUERBERATUNGSKOSTEN, REISEKOSTEN, BEWERBUNGEN, FORTBILDUNGEN,
  UMZUG, BEWIRTUNG, DOPPELTER_HAUSHALT, AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN,
  SONSTIGE_AUSGABEN
""";

    private static final String VISION_LAYOUT_HINT = """
Use the VISUAL LAYOUT to identify sections:
- The SELLER (Absender/Von) is typically in the top-right corner or letterhead — this is who sent the invoice
- The BUYER (Empfänger/An) is typically in the middle-left address block — this is who received it
- Do NOT confuse the two
""";

    private static final String INVOICE_LIST_SCHEMA = """
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "product_name": {"type": "string"},
          "company": {"type": "string"},
          "value": {"type": "number"},
          "invoice_date": {"type": ["string", "null"]},
          "category": {"type": "string"}
        },
        "required": ["product_name", "company", "value", "category"]
      }
    }
  },
  "required": ["items"]
}
""";

    private final String llmUrl;
    private final String llmModel;
    private final InvoiceRepository invoiceRepository;
    private final RestTemplate restTemplate;
    private final LlmChatEmbeddingService embeddingService;

    public ExtractionService(
            @Value("${llm.url}") String llmUrl,
            @Value("${llm.model}") String llmModel,
            InvoiceRepository invoiceRepository,
            RestTemplate restTemplate,
            LlmChatEmbeddingService embeddingService) {
        this.llmUrl = llmUrl.endsWith("/") ? llmUrl.substring(0, llmUrl.length() - 1) : llmUrl;
        this.llmModel = llmModel;
        this.invoiceRepository = invoiceRepository;
        this.restTemplate = restTemplate;
        this.embeddingService = embeddingService;
    }

    public List<Invoice> extractAndStore(Document document) throws IOException {
        byte[] fileBytes = Files.readAllBytes(Paths.get(document.getStoragePath()));
        List<ExtractionItem> items = extractItems(fileBytes, document.getContentType(), document.getFilename());
        log.info("Extracted {} item(s) from document {}", items.size(), document.getStoragePath());

        List<Invoice> invoices = items.stream().map(item -> {
            Invoice invoice = new Invoice(
                    item.product_name(),
                    item.company(),
                    BigDecimal.valueOf(item.value()));
            if (item.invoice_date() != null && !item.invoice_date().isBlank()) {
                try {
                    invoice.setInvoiceDate(LocalDate.parse(item.invoice_date()));
                } catch (Exception e) {
                    log.warn("Could not parse date '{}': {}", item.invoice_date(), e.getMessage());
                }
            }
            invoice.setCategory(parseCategory(item.category()));
            invoice.setUserId(document.getUserId());
            invoice.setDocument(document);
            return invoice;
        }).toList();

        List<Invoice> saved = invoiceRepository.saveAll(invoices);
        saved.forEach(embeddingService::embedInvoice);
        return saved;
    }

    private List<ExtractionItem> extractItems(byte[] fileBytes, String contentType, String filename) throws IOException {
        boolean isPdf = "application/pdf".equals(contentType)
                || (filename != null && filename.toLowerCase().endsWith(".pdf"));

        List<String[]> images;
        if (isPdf) {
            images = pdfToBase64Images(fileBytes);
        } else {
            String mime = (contentType != null && contentType.startsWith("image/")) ? contentType : "image/png";
            images = Collections.singletonList(new String[]{mime, Base64.getEncoder().encodeToString(fileBytes)});
        }
        return callLlmVision(images);
    }

    private List<String[]> pdfToBase64Images(byte[] pdfBytes) throws IOException {
        List<String[]> images = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            for (int i = 0; i < doc.getNumberOfPages(); i++) {
                BufferedImage img = renderer.renderImageWithDPI(i, 96);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(img, "PNG", baos);
                images.add(new String[]{"image/png", Base64.getEncoder().encodeToString(baos.toByteArray())});
            }
        }
        return images;
    }

    private List<ExtractionItem> callLlmVision(List<String[]> images) {
        String prompt = "You are a German tax document classifier. Extract invoice line items from the images below and return valid JSON. The invoice may be in German or English.\n"
                + VISION_LAYOUT_HINT + "\n" + ITEM_FIELDS;

        List<Map<String, Object>> messageContent = new ArrayList<>();
        messageContent.add(Map.of("type", "text", "text", prompt));
        for (String[] img : images) {
            messageContent.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of("url", "data:" + img[0] + ";base64," + img[1])));
        }
        return callLlm(messageContent);
    }

    private List<ExtractionItem> callLlm(List<Map<String, Object>> messageContent) {
        String url = llmUrl + "/v1/chat/completions";

        Map<String, Object> responseFormat;
        try {
            responseFormat = Map.of(
                    "type", "json_schema",
                    "json_schema", Map.of(
                            "name", "InvoiceList",
                            "schema", MAPPER.readValue(INVOICE_LIST_SCHEMA, Map.class)));
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse invoice JSON schema", e);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", llmModel);
        body.put("messages", List.of(Map.of("role", "user", "content", messageContent)));
        body.put("response_format", responseFormat);
        body.put("temperature", 0);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer EMPTY");

        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                log.info("LLM attempt {}/3 model={}", attempt + 1, llmModel);
                ResponseEntity<String> response = restTemplate.exchange(
                        url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

                String responseBody = response.getBody();
                if (responseBody == null || responseBody.isBlank()) {
                    log.warn("LLM attempt {} returned empty body", attempt + 1);
                    if (attempt == 2) throw new RuntimeException("LLM returned empty response after 3 attempts");
                    sleep2s();
                    continue;
                }

                JsonNode root = MAPPER.readTree(responseBody);
                String responseText = root.path("choices").get(0).path("message").path("content").asText();
                if (responseText.isBlank()) {
                    log.warn("LLM attempt {} returned empty content", attempt + 1);
                    if (attempt == 2) throw new RuntimeException("LLM returned empty content after 3 attempts");
                    sleep2s();
                    continue;
                }

                log.info("LLM returned {} chars", responseText.length());
                JsonNode itemsNode = MAPPER.readTree(responseText).path("items");
                List<ExtractionItem> result = new ArrayList<>();
                for (JsonNode node : itemsNode) {
                    String invoiceDate = node.path("invoice_date").isNull() ? null
                            : node.path("invoice_date").asText(null);
                    result.add(new ExtractionItem(
                            node.path("product_name").asText(""),
                            node.path("company").asText(""),
                            node.path("value").asDouble(0),
                            invoiceDate,
                            node.path("category").asText(null)));
                }
                if (result.isEmpty()) log.warn("LLM returned 0 items");
                else log.info("Parsed {} invoice items", result.size());
                return result;

            } catch (Exception e) {
                log.warn("LLM attempt {} failed: {}", attempt + 1, e.getMessage());
                if (attempt == 2) throw new RuntimeException("LLM extraction failed after 3 attempts", e);
                sleep2s();
            }
        }
        return List.of();
    }

    private void sleep2s() {
        try {
            Thread.sleep(2000);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
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
