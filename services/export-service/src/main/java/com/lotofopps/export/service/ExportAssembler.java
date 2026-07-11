package com.lotofopps.export.service;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.ExportCategoryTotal;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.api.model.InvoiceResponse;
import com.lotofopps.export.client.InvoiceServiceClient;
import com.lotofopps.export.config.PauschbetragTable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Fetches a user's accepted invoices for one tax year and derives the summary figures. */
@Service
public class ExportAssembler {

    private final InvoiceServiceClient invoiceServiceClient;
    private final PauschbetragTable pauschbetragTable;

    public ExportAssembler(
            InvoiceServiceClient invoiceServiceClient, PauschbetragTable pauschbetragTable) {
        this.invoiceServiceClient = invoiceServiceClient;
        this.pauschbetragTable = pauschbetragTable;
    }

    /** Years the user has at least one accepted, dated invoice in, most recent first. */
    public List<Integer> availableYears(String userId) {
        return invoiceServiceClient.fetchAcceptedInvoices(userId, null).stream()
                .map(InvoiceResponse::getInvoiceDate)
                .filter(Objects::nonNull)
                .map(LocalDate::getYear)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    public TaxYearExport assemble(String userId, int year) {
        List<InvoiceResponse> invoices = invoiceServiceClient.fetchAcceptedInvoices(userId, year);
        List<InvoiceResponse> ordered =
                invoices.stream()
                        .sorted(
                                Comparator.comparing(
                                                InvoiceResponse::getInvoiceDate,
                                                Comparator.nullsLast(Comparator.naturalOrder()))
                                        .thenComparing(
                                                InvoiceResponse::getId,
                                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();
        return new TaxYearExport(year, summarize(year, ordered), ordered);
    }

    public ExportSummaryResponse summarize(int year, List<InvoiceResponse> invoices) {
        BigDecimal total =
                invoices.stream()
                        .map(ExportAssembler::price)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal lumpSum = scale(pauschbetragTable.forYear(year));
        // Only what exceeds the automatic allowance is worth collecting receipts for; below it,
        // the export documents zero extra deduction rather than a negative one.
        BigDecimal aboveLumpSum = scale(total).subtract(lumpSum).max(BigDecimal.ZERO);

        return new ExportSummaryResponse()
                .year(year)
                .invoiceCount(invoices.size())
                .totalExpenses(scale(total))
                .lumpSumAllowance(lumpSum)
                .deductibleAboveLumpSum(aboveLumpSum)
                .categories(categoryTotals(invoices));
    }

    /**
     * Totals per deduction category, largest first. Invoices the AI could not categorize group
     * under a null category and always sort last, so they read as a remainder rather than as a
     * rival to the real SONSTIGE_AUSGABEN bucket.
     *
     * <p>Grouped by hand because {@code Collectors.groupingBy} rejects the null key.
     */
    private static List<ExportCategoryTotal> categoryTotals(List<InvoiceResponse> invoices) {
        Map<InvoiceCategory, List<InvoiceResponse>> grouped = new LinkedHashMap<>();
        for (InvoiceResponse invoice : invoices) {
            grouped.computeIfAbsent(invoice.getCategory(), k -> new ArrayList<>()).add(invoice);
        }

        Comparator<ExportCategoryTotal> uncategorizedLastThenLargestFirst =
                Comparator.comparing((ExportCategoryTotal c) -> c.getCategory() == null)
                        .thenComparing(ExportCategoryTotal::getTotal, Comparator.reverseOrder());

        return grouped.entrySet().stream()
                .map(
                        e ->
                                new ExportCategoryTotal()
                                        .category(e.getKey())
                                        .invoiceCount(e.getValue().size())
                                        .total(
                                                scale(
                                                        e.getValue().stream()
                                                                .map(ExportAssembler::price)
                                                                .reduce(
                                                                        BigDecimal.ZERO,
                                                                        BigDecimal::add))))
                .sorted(uncategorizedLastThenLargestFirst)
                .toList();
    }

    /**
     * The receipts the given invoices actually reference, keyed by document id. Only the zip
     * rendering needs these; summary, CSV and PDF never trigger a documents call. invoice-service
     * filters to the requested ids server-side.
     */
    public Map<Long, DocumentResponse> referencedDocuments(
            String userId, List<InvoiceResponse> invoices) {
        Set<Long> referenced =
                invoices.stream()
                        .map(InvoiceResponse::getDocumentId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
        if (referenced.isEmpty()) {
            return Map.of();
        }
        return invoiceServiceClient.fetchDocuments(userId, referenced).stream()
                .collect(
                        Collectors.toMap(
                                DocumentResponse::getId,
                                Function.identity(),
                                (a, b) -> a,
                                LinkedHashMap::new));
    }

    private static BigDecimal price(InvoiceResponse invoice) {
        return invoice.getPrice() == null ? BigDecimal.ZERO : invoice.getPrice();
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
