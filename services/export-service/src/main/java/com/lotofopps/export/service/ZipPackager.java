package com.lotofopps.export.service;

import com.lotofopps.export.api.model.DocumentResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Packs one tax year into the archive a user actually submits: the summary sheet, the machine-
 * readable renderings, and every original receipt behind the numbers.
 */
@Component
public class ZipPackager {

    private static final Logger log = LoggerFactory.getLogger(ZipPackager.class);

    /** Loads a receipt's bytes, or throws if invoice-service cannot serve it. */
    @FunctionalInterface
    public interface ReceiptLoader {
        byte[] load(long documentId);
    }

    public byte[] pack(
            TaxYearExport export,
            Map<Long, DocumentResponse> documents,
            byte[] summaryPdf,
            byte[] csv,
            byte[] json,
            ReceiptLoader receiptLoader) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        String root = "taxforward-export-" + export.year() + "/";
        List<String> missingReceipts = new ArrayList<>();

        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            write(zip, root + "summary.pdf", summaryPdf);
            write(zip, root + "invoices.csv", csv);
            write(zip, root + "invoices.json", json);

            // One entry per *document*, not per invoice: several line items are typically
            // extracted from the same receipt, and the archive must not duplicate the file.
            for (Map.Entry<Long, DocumentResponse> entry : documents.entrySet()) {
                long documentId = entry.getKey();
                try {
                    write(
                            zip,
                            root + receiptPath(entry.getValue()),
                            receiptLoader.load(documentId));
                } catch (RuntimeException e) {
                    // A single unreadable receipt must not cost the user the whole export; the
                    // archive says which ones are missing instead of silently omitting them.
                    log.warn("Skipping receipt {} in export: {}", documentId, e.getMessage());
                    missingReceipts.add(receiptPath(entry.getValue()));
                }
            }

            write(zip, root + "README.txt", readme(export, missingReceipts));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to assemble the export archive", e);
        }
        return out.toByteArray();
    }

    private static void write(ZipOutputStream zip, String name, byte[] content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content);
        zip.closeEntry();
    }

    /**
     * Receipts are named by document id first so the "Beleg" column of the PDF and the {@code
     * documentId} column of the CSV both point at a unique file.
     */
    static String receiptPath(DocumentResponse document) {
        return "receipts/" + document.getId() + "-" + safeFilename(document.getFilename());
    }

    /**
     * Uploaded filenames are attacker-controlled. Anything that could escape the {@code receipts/}
     * directory — separators, {@code ..}, control characters — is replaced rather than sanitized
     * away, so two distinct uploads cannot collapse onto one entry name.
     */
    static String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "receipt";
        }
        String cleaned = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        while (cleaned.startsWith(".")) {
            cleaned = cleaned.substring(1);
        }
        if (cleaned.isBlank()) {
            return "receipt";
        }
        return cleaned.length() > 100 ? cleaned.substring(0, 100) : cleaned;
    }

    private static byte[] readme(TaxYearExport export, List<String> missingReceipts) {
        StringBuilder readme = new StringBuilder();
        readme.append("TaxForward — Export ")
                .append(export.year())
                .append("\n\n")
                .append(
                        "summary.pdf    Werbungskosten summary to hand to the Finanzamt or your tax advisor.\n")
                .append(
                        "invoices.csv   One row per invoice line item (UTF-8 with BOM, RFC 4180).\n")
                .append(
                        "invoices.json  The same data plus the summary figures, machine-readable.\n")
                .append("receipts/      The original uploads, named <documentId>-<filename>.\n\n")
                .append(
                        "Several invoice line items may be extracted from a single receipt, so there\n")
                .append(
                        "are usually fewer files in receipts/ than rows in invoices.csv. Match them on\n")
                .append("the documentId column.\n\n")
                .append(
                        "Only invoices you reviewed and accepted are included. This export is not tax advice.\n");

        if (!missingReceipts.isEmpty()) {
            readme.append(
                    "\nWARNING: these receipts could not be retrieved and are missing from this archive:\n");
            missingReceipts.forEach(name -> readme.append("  - ").append(name).append('\n'));
        }
        return readme.toString().getBytes(StandardCharsets.UTF_8);
    }
}
