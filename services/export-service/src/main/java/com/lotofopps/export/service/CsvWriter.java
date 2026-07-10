package com.lotofopps.export.service;

import com.lotofopps.export.api.model.InvoiceResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Renders invoices as RFC 4180 CSV — one row per line item, the shape a Steuerberater imports.
 *
 * <p>Encoded as UTF-8 with a leading byte-order mark: without it Excel decodes the file as the
 * system's legacy code page and mangles every umlaut in the category names.
 */
@Component
public class CsvWriter {

    private static final String[] HEADER = {
        "id", "invoiceDate", "itemName", "company", "category", "price", "documentId", "createdAt"
    };

    private static final String BYTE_ORDER_MARK = "\uFEFF";

    public byte[] toCsv(List<InvoiceResponse> invoices) {
        StringBuilder csv = new StringBuilder(BYTE_ORDER_MARK);
        appendRow(csv, HEADER);
        for (InvoiceResponse invoice : invoices) {
            appendRow(
                    csv,
                    text(invoice.getId()),
                    text(invoice.getInvoiceDate()),
                    text(invoice.getItemName()),
                    text(invoice.getCompany()),
                    invoice.getCategory() == null ? "" : invoice.getCategory().getValue(),
                    text(invoice.getPrice()),
                    text(invoice.getDocumentId()),
                    text(invoice.getCreatedAt()));
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void appendRow(StringBuilder csv, String... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(escape(cells[i]));
        }
        csv.append("\r\n");
    }

    private static String escape(String cell) {
        if (cell.indexOf(',') < 0
                && cell.indexOf('"') < 0
                && cell.indexOf('\n') < 0
                && cell.indexOf('\r') < 0) {
            return cell;
        }
        return '"' + cell.replace("\"", "\"\"") + '"';
    }

    private static String text(Object value) {
        return Objects.toString(value, "");
    }
}
