package com.lotofopps.export.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.api.model.InvoiceResponse;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CsvWriterTest {

    private final CsvWriter writer = new CsvWriter();

    @Test
    void startsWithAByteOrderMarkSoSpreadsheetsDecodeUmlauts() {
        byte[] csv = writer.toCsv(List.of());

        assertThat(csv).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
    }

    @Test
    void writesTheHeaderAndOneRowPerInvoice() {
        String csv = text(writer.toCsv(List.of(invoice("Laptop", "Media Markt", "999.99"))));

        assertThat(csv.replace("\uFEFF", "").lines().toList())
                .containsExactly(
                        "id,invoiceDate,itemName,company,category,price,documentId,createdAt",
                        "1,2025-03-04,Laptop,Media Markt,ARBEITSMITTEL,999.99,7,");
    }

    @Test
    void writesTheCategoryWireValueNotTheMangledEnumConstant() {
        InvoiceResponse invoice =
                invoice("Mitgliedsbeitrag", "ver.di", "120.00")
                        .category(InvoiceCategory.BERUFSVERB_NDE_UND_GEWERKSCHAFTEN);

        assertThat(text(writer.toCsv(List.of(invoice))))
                .contains("BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN");
    }

    @Test
    void quotesCellsContainingSeparatorsQuotesOrNewlines() {
        InvoiceResponse invoice = invoice("Desk, oak", "Say \"Hi\" GmbH", "250.00");

        assertThat(text(writer.toCsv(List.of(invoice))))
                .contains("\"Desk, oak\",\"Say \"\"Hi\"\" GmbH\"");
    }

    @Test
    void leavesMissingCategoryAndDocumentEmpty() {
        InvoiceResponse invoice =
                invoice("Cash receipt", "Kiosk", "3.50").category(null).documentId(null);

        assertThat(text(writer.toCsv(List.of(invoice)))).contains("Cash receipt,Kiosk,,3.50,,");
    }

    private static InvoiceResponse invoice(String itemName, String company, String price) {
        return new InvoiceResponse()
                .id(1L)
                .itemName(itemName)
                .company(company)
                .price(new BigDecimal(price))
                .category(InvoiceCategory.ARBEITSMITTEL)
                .invoiceDate(LocalDate.of(2025, 3, 4))
                .documentId(7L);
    }

    private static String text(byte[] csv) {
        return new String(csv, StandardCharsets.UTF_8);
    }
}
