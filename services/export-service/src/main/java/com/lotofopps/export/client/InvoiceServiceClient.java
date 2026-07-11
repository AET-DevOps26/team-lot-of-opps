package com.lotofopps.export.client;

import com.lotofopps.backend.grpc.GetDocumentContentRequest;
import com.lotofopps.backend.grpc.GetDocumentsRequest;
import com.lotofopps.backend.grpc.GetLatestInvoicesRequest;
import com.lotofopps.backend.grpc.InternalInvoiceServiceGrpc;
import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.api.model.InvoiceResponse;
import com.lotofopps.export.api.model.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

/**
 * Reads the user's invoices and receipts from invoice-service over gRPC ({@code
 * InternalInvoiceService}, see {@code api/proto/invoice.proto}).
 *
 * <p>The user scoping travels in-band as the {@code user_id} field — like the other internal gRPC
 * consumers — and invoice-service applies per-user filtering and document-ownership checks
 * server-side, so this service is never trusted with unscoped reads.
 */
@Service
public class InvoiceServiceClient {

    /** REST predecessor read-timeout, kept: a hung invoice-service must fail the export. */
    private static final long DEADLINE_SECONDS = 30;

    private final InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub;

    public InvoiceServiceClient(
            InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub) {
        this.invoiceStub = invoiceStub;
    }

    /** Accepted invoices only; invoices still under review must never reach a tax export. */
    public List<InvoiceResponse> fetchAcceptedInvoices(String userId, Integer year) {
        GetLatestInvoicesRequest.Builder request =
                GetLatestInvoicesRequest.newBuilder().setUserId(userId); // limit 0 = all
        if (year != null) {
            request.setInvoiceYear(year);
        }
        return stub().getLatestInvoices(request.build()).getInvoicesList().stream()
                .map(InvoiceServiceClient::fromProto)
                .toList();
    }

    /** Metadata of the given receipts; invoice-service returns only documents the user owns. */
    public List<DocumentResponse> fetchDocuments(String userId, Collection<Long> documentIds) {
        return stub()
                .getDocuments(
                        GetDocumentsRequest.newBuilder()
                                .setUserId(userId)
                                .addAllDocumentIds(documentIds)
                                .build())
                .getDocumentsList()
                .stream()
                .map(InvoiceServiceClient::fromProto)
                .toList();
    }

    /** The raw bytes of an uploaded receipt; NOT_FOUND if missing or owned by someone else. */
    public byte[] fetchDocumentContent(String userId, long documentId) {
        return stub().getDocumentContent(
                        GetDocumentContentRequest.newBuilder()
                                .setUserId(userId)
                                .setDocumentId(documentId)
                                .build())
                .getContent()
                .toByteArray();
    }

    /** Deadlines are per call by design: computed when set, so never put one on the bean. */
    private InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub stub() {
        return invoiceStub.withDeadlineAfter(DEADLINE_SECONDS, TimeUnit.SECONDS);
    }

    // Maps the proto messages back onto the OpenAPI-generated models the export pipeline
    // consumes. Mirrors suggestions-service's InvoiceClient#fromProto (models are generated
    // per-service into different packages, so the mapper cannot be shared).
    private static InvoiceResponse fromProto(com.lotofopps.backend.grpc.Invoice p) {
        InvoiceResponse r =
                new InvoiceResponse()
                        .id(p.getId())
                        .itemName(p.getItemName())
                        .company(p.getCompany())
                        .price(p.getPrice().isEmpty() ? null : new BigDecimal(p.getPrice()))
                        .category(
                                p.getCategory().isEmpty()
                                        ? null
                                        : InvoiceCategory.fromValue(p.getCategory()))
                        .userId(p.getUserId())
                        .status(
                                p.getStatus().isEmpty()
                                        ? null
                                        : InvoiceStatus.fromValue(p.getStatus()));
        if (p.hasInvoiceDate()) {
            r.invoiceDate(LocalDate.parse(p.getInvoiceDate()));
        }
        if (p.hasCreatedAt()) {
            r.createdAt(LocalDateTime.parse(p.getCreatedAt()));
        }
        if (p.hasDocumentId()) {
            r.documentId(p.getDocumentId());
        }
        return r;
    }

    private static DocumentResponse fromProto(com.lotofopps.backend.grpc.Document p) {
        DocumentResponse r =
                new DocumentResponse()
                        .id(p.getId())
                        .filename(p.getFilename())
                        .contentType(p.getContentType())
                        .sizeBytes(p.getSizeBytes())
                        .userId(p.getUserId());
        if (!p.getUploadedAt().isEmpty()) {
            r.uploadedAt(LocalDateTime.parse(p.getUploadedAt()));
        }
        return r;
    }
}
