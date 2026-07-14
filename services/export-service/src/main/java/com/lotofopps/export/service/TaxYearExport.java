package com.lotofopps.export.service;

import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceResponse;
import java.util.List;

/**
 * Everything one tax year's summary, CSV and PDF are rendered from. The zip additionally needs the
 * referenced receipt documents; only that path fetches them (see {@link
 * ExportAssembler#referencedDocuments}).
 */
public record TaxYearExport(
        int year, ExportSummaryResponse summary, List<InvoiceResponse> invoices) {}
