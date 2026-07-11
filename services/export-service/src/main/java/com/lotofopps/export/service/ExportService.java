package com.lotofopps.export.service;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.client.InvoiceServiceClient;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Produces the downloadable renderings of one user's tax year. */
@Service
public class ExportService {

    private final InvoiceServiceClient invoiceServiceClient;
    private final ExportAssembler assembler;
    private final CsvWriter csvWriter;
    private final PdfSummaryWriter pdfSummaryWriter;
    private final ZipPackager zipPackager;
    private final ObjectMapper objectMapper;

    public ExportService(
            InvoiceServiceClient invoiceServiceClient,
            ExportAssembler assembler,
            CsvWriter csvWriter,
            PdfSummaryWriter pdfSummaryWriter,
            ZipPackager zipPackager,
            ObjectMapper objectMapper) {
        this.invoiceServiceClient = invoiceServiceClient;
        this.assembler = assembler;
        this.csvWriter = csvWriter;
        this.pdfSummaryWriter = pdfSummaryWriter;
        this.zipPackager = zipPackager;
        this.objectMapper = objectMapper;
    }

    public List<Integer> availableYears(String userId) {
        return assembler.availableYears(userId);
    }

    public ExportSummaryResponse summary(String userId, int year) {
        return assembler.assemble(userId, year).summary();
    }

    public byte[] csv(String userId, int year) {
        return csvWriter.toCsv(assembler.assemble(userId, year).invoices());
    }

    public byte[] pdf(String userId, int year) {
        return pdfSummaryWriter.render(assembler.assemble(userId, year));
    }

    public byte[] zip(String userId, int year) {
        TaxYearExport export = assembler.assemble(userId, year);
        // Only the zip ships receipts, so only the zip fetches their metadata.
        Map<Long, DocumentResponse> documents =
                assembler.referencedDocuments(userId, export.invoices());
        return zipPackager.pack(
                export,
                documents,
                pdfSummaryWriter.render(export),
                csvWriter.toCsv(export.invoices()),
                json(export, documents),
                documentId -> invoiceServiceClient.fetchDocumentContent(userId, documentId));
    }

    /** The portability rendering: the year's figures and every invoice field, as stored. */
    private byte[] json(TaxYearExport export, Map<Long, DocumentResponse> documents) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("generatedAt", Instant.now().toString());
        bundle.put("year", export.year());
        bundle.put("summary", export.summary());
        bundle.put("invoices", export.invoices());
        bundle.put("documents", documents.values());
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(bundle);
    }
}
