package com.lotofopps.export.service;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceResponse;
import java.util.List;
import java.util.Map;

/**
 * Everything one tax year's export is rendered from.
 *
 * <p>{@code documentsById} holds only the receipts the year's invoices actually reference. Several
 * invoices are typically extracted from one receipt, so the map is smaller than the invoice list
 * and a receipt must be written to the archive once, not once per line item.
 */
public record TaxYearExport(
        int year,
        ExportSummaryResponse summary,
        List<InvoiceResponse> invoices,
        Map<Long, DocumentResponse> documentsById) {}
