package com.lotofopps.export.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.ExportCategoryTotal;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.api.model.InvoiceResponse;
import com.lotofopps.export.client.InvoiceServiceClient;
import com.lotofopps.export.config.PauschbetragTable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ExportAssemblerTest {

    private static final String USER = "user-1";

    private InvoiceServiceClient invoiceServiceClient;
    private ExportAssembler assembler;

    @BeforeEach
    void setUp() {
        invoiceServiceClient = mock(InvoiceServiceClient.class);
        PauschbetragTable pauschbetrag = new PauschbetragTable();
        pauschbetrag.setDefaultAmount(new BigDecimal("1230"));
        pauschbetrag.setByYear(Map.of(2022, new BigDecimal("1200")));
        assembler = new ExportAssembler(invoiceServiceClient, pauschbetrag);
    }

    @Test
    void summarizesTotalsAndTheAmountAboveTheLumpSumAllowance() {
        ExportSummaryResponse summary =
                assembler.summarize(
                        2025,
                        List.of(
                                invoice(1L, "800.00", InvoiceCategory.ARBEITSMITTEL, null),
                                invoice(2L, "600.50", InvoiceCategory.REISEKOSTEN, null)));

        assertThat(summary.getYear()).isEqualTo(2025);
        assertThat(summary.getInvoiceCount()).isEqualTo(2);
        assertThat(summary.getTotalExpenses()).isEqualByComparingTo("1400.50");
        assertThat(summary.getLumpSumAllowance()).isEqualByComparingTo("1230.00");
        assertThat(summary.getDeductibleAboveLumpSum()).isEqualByComparingTo("170.50");
    }

    @Test
    void clampsTheDeductibleAtZeroWhenExpensesStayBelowTheAllowance() {
        ExportSummaryResponse summary =
                assembler.summarize(
                        2025, List.of(invoice(1L, "42.00", InvoiceCategory.BEWERBUNGEN, null)));

        assertThat(summary.getDeductibleAboveLumpSum()).isEqualByComparingTo("0.00");
    }

    @Test
    void usesThePerYearAllowanceRatherThanTheDefault() {
        ExportSummaryResponse summary =
                assembler.summarize(
                        2022, List.of(invoice(1L, "2000.00", InvoiceCategory.UMZUG, null)));

        assertThat(summary.getLumpSumAllowance()).isEqualByComparingTo("1200.00");
        assertThat(summary.getDeductibleAboveLumpSum()).isEqualByComparingTo("800.00");
    }

    @Test
    void groupsCategoriesLargestFirstAndKeepsUncategorizedApartFromSonstigeAusgaben() {
        ExportSummaryResponse summary =
                assembler.summarize(
                        2025,
                        List.of(
                                invoice(1L, "10.00", null, null),
                                invoice(2L, "300.00", InvoiceCategory.SONSTIGE_AUSGABEN, null),
                                invoice(3L, "500.00", InvoiceCategory.ARBEITSMITTEL, null),
                                invoice(4L, "100.00", InvoiceCategory.ARBEITSMITTEL, null)));

        List<ExportCategoryTotal> categories = summary.getCategories();
        assertThat(categories).hasSize(3);

        assertThat(categories.get(0).getCategory()).isEqualTo(InvoiceCategory.ARBEITSMITTEL);
        assertThat(categories.get(0).getInvoiceCount()).isEqualTo(2);
        assertThat(categories.get(0).getTotal()).isEqualByComparingTo("600.00");

        assertThat(categories.get(1).getCategory()).isEqualTo(InvoiceCategory.SONSTIGE_AUSGABEN);
        assertThat(categories.get(1).getTotal()).isEqualByComparingTo("300.00");

        // Uncategorized sorts last even though a real category has a smaller total elsewhere.
        assertThat(categories.get(2).getCategory()).isNull();
        assertThat(categories.get(2).getTotal()).isEqualByComparingTo("10.00");
    }

    @Test
    void availableYearsAreDistinctDescendingAndIgnoreUndatedInvoices() {
        when(invoiceServiceClient.fetchAcceptedInvoices(USER, null))
                .thenReturn(
                        List.of(
                                invoice(1L, "1.00", null, LocalDate.of(2024, 3, 1)),
                                invoice(2L, "1.00", null, LocalDate.of(2025, 7, 9)),
                                invoice(3L, "1.00", null, LocalDate.of(2024, 11, 2)),
                                invoice(4L, "1.00", null, null)));

        assertThat(assembler.availableYears(USER)).containsExactly(2025, 2024);
    }

    @Test
    void requestsEachReferencedReceiptOnceEvenWhenSeveralInvoicesShareIt() {
        InvoiceResponse first = invoice(1L, "10.00", null, LocalDate.of(2025, 1, 1)).documentId(7L);
        InvoiceResponse second =
                invoice(2L, "20.00", null, LocalDate.of(2025, 1, 2)).documentId(7L);
        InvoiceResponse third = invoice(3L, "30.00", null, LocalDate.of(2025, 1, 3)).documentId(8L);
        // Only the distinct referenced ids go over the wire; invoice-service filters to them.
        when(invoiceServiceClient.fetchDocuments(USER, Set.of(7L, 8L)))
                .thenReturn(List.of(document(7L, "hotel.pdf"), document(8L, "train.pdf")));

        Map<Long, DocumentResponse> documents =
                assembler.referencedDocuments(USER, List.of(first, second, third));

        assertThat(documents).containsOnlyKeys(7L, 8L);
    }

    @Test
    void skipsTheDocumentLookupWhenNoInvoiceReferencesAReceipt() {
        Map<Long, DocumentResponse> documents =
                assembler.referencedDocuments(
                        USER, List.of(invoice(1L, "10.00", null, LocalDate.of(2025, 1, 1))));

        assertThat(documents).isEmpty();
        verifyNoInteractions(invoiceServiceClient);
    }

    @Test
    void ordersInvoicesByDateWithUndatedOnesLast() {
        when(invoiceServiceClient.fetchAcceptedInvoices(USER, 2025))
                .thenReturn(
                        List.of(
                                invoice(1L, "1.00", null, null),
                                invoice(2L, "1.00", null, LocalDate.of(2025, 9, 9)),
                                invoice(3L, "1.00", null, LocalDate.of(2025, 2, 2))));

        assertThat(assembler.assemble(USER, 2025).invoices())
                .extracting(InvoiceResponse::getId)
                .containsExactly(3L, 2L, 1L);
    }

    @Test
    void summarizingDoesNotCallInvoiceService() {
        assembler.summarize(2025, List.of());
        verifyNoInteractions(invoiceServiceClient);
    }

    private static InvoiceResponse invoice(
            Long id, String price, InvoiceCategory category, LocalDate date) {
        return new InvoiceResponse()
                .id(id)
                .itemName("item-" + id)
                .company("company-" + id)
                .price(new BigDecimal(price))
                .category(category)
                .invoiceDate(date);
    }

    private static DocumentResponse document(Long id, String filename) {
        return new DocumentResponse().id(id).filename(filename).contentType("application/pdf");
    }
}
