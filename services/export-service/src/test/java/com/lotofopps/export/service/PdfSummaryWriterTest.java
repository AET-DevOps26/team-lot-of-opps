package com.lotofopps.export.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.lotofopps.export.api.model.ExportCategoryTotal;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.api.model.InvoiceResponse;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PdfSummaryWriterTest {

    private final PdfSummaryWriter writer = new PdfSummaryWriter(new CategoryLabels());

    @Test
    void rendersAReadablePdf() throws IOException {
        byte[] pdf = writer.render(export());

        assertThat(pdf).startsWith((byte) '%', (byte) 'P', (byte) 'D', (byte) 'F');
        assertThat(text(pdf)).contains("Werbungskosten 2025");
    }

    @Test
    void showsTheTotalTheAllowanceAndWhatIsDeductibleAboveIt() throws IOException {
        String text = text(writer.render(export()));

        assertThat(text).contains("Summe der Werbungskosten").contains("1.400,50");
        assertThat(text).contains("Arbeitnehmer-Pauschbetrag 2025").contains("1.230,00");
        assertThat(text).contains("zusätzlich absetzbar").contains("170,50");
    }

    @Test
    void rendersGermanCategoryNamesWithTheirUmlautsIntact() throws IOException {
        ExportSummaryResponse summary =
                summary()
                        .categories(
                                List.of(
                                        new ExportCategoryTotal()
                                                .category(
                                                        InvoiceCategory
                                                                .BERUFSVERB_NDE_UND_GEWERKSCHAFTEN)
                                                .invoiceCount(1)
                                                .total(new BigDecimal("120.00"))));
        TaxYearExport export = new TaxYearExport(2025, summary, List.of(), Map.of());

        assertThat(text(writer.render(export))).contains("Berufsverbände und Gewerkschaften");
    }

    @Test
    void listsEachInvoiceWithTheDocumentIdItsReceiptIsFiledUnder() throws IOException {
        String text = text(writer.render(export()));

        assertThat(text).contains("Laptop").contains("Media Markt").contains("Arbeitsmittel");
        // The "Beleg" column must match the receipts/<documentId>-* entry in the ZIP.
        assertThat(text).contains("42");
    }

    @Test
    void rendersAnEmptyYearWithoutFailing() {
        TaxYearExport empty =
                new TaxYearExport(
                        2025,
                        new ExportSummaryResponse()
                                .year(2025)
                                .invoiceCount(0)
                                .totalExpenses(BigDecimal.ZERO)
                                .lumpSumAllowance(new BigDecimal("1230.00"))
                                .deductibleAboveLumpSum(BigDecimal.ZERO)
                                .categories(List.of()),
                        List.of(),
                        Map.of());

        assertThatCode(() -> writer.render(empty)).doesNotThrowAnyException();
        assertThat(textQuietly(writer.render(empty))).contains("Keine Belege");
    }

    private static TaxYearExport export() {
        InvoiceResponse laptop =
                new InvoiceResponse()
                        .id(1L)
                        .itemName("Laptop")
                        .company("Media Markt")
                        .price(new BigDecimal("999.99"))
                        .category(InvoiceCategory.ARBEITSMITTEL)
                        .invoiceDate(LocalDate.of(2025, 3, 4))
                        .documentId(42L);
        InvoiceResponse train =
                new InvoiceResponse()
                        .id(2L)
                        .itemName("Bahnticket")
                        .company("Deutsche Bahn")
                        .price(new BigDecimal("400.51"))
                        .category(InvoiceCategory.REISEKOSTEN)
                        .invoiceDate(LocalDate.of(2025, 5, 6))
                        .documentId(43L);

        ExportSummaryResponse summary =
                summary()
                        .categories(
                                List.of(
                                        new ExportCategoryTotal()
                                                .category(InvoiceCategory.ARBEITSMITTEL)
                                                .invoiceCount(1)
                                                .total(new BigDecimal("999.99")),
                                        new ExportCategoryTotal()
                                                .category(InvoiceCategory.REISEKOSTEN)
                                                .invoiceCount(1)
                                                .total(new BigDecimal("400.51"))));

        return new TaxYearExport(2025, summary, List.of(laptop, train), Map.of());
    }

    private static ExportSummaryResponse summary() {
        return new ExportSummaryResponse()
                .year(2025)
                .invoiceCount(2)
                .totalExpenses(new BigDecimal("1400.50"))
                .lumpSumAllowance(new BigDecimal("1230.00"))
                .deductibleAboveLumpSum(new BigDecimal("170.50"))
                .categories(List.of());
    }

    private static String text(byte[] pdf) throws IOException {
        PdfReader reader = new PdfReader(pdf);
        try {
            StringBuilder content = new StringBuilder();
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                content.append(extractor.getTextFromPage(page)).append('\n');
            }
            return content.toString();
        } finally {
            reader.close();
        }
    }

    private static String textQuietly(byte[] pdf) {
        try {
            return text(pdf);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
