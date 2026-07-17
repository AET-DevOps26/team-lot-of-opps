package com.lotofopps.backend.grpc;

import com.google.protobuf.ByteString;
import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import com.lotofopps.backend.service.LlmChatEmbeddingService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class InternalInvoiceGrpcService
        extends InternalInvoiceServiceGrpc.InternalInvoiceServiceImplBase {

    private final InvoiceRepository invoiceRepository;
    private final DocumentRepository documentRepository;
    private final DocumentStorageService documentStorageService;
    private final LlmChatEmbeddingService embeddingService;

    public InternalInvoiceGrpcService(
            InvoiceRepository invoiceRepository,
            DocumentRepository documentRepository,
            DocumentStorageService documentStorageService,
            LlmChatEmbeddingService embeddingService) {
        this.invoiceRepository = invoiceRepository;
        this.documentRepository = documentRepository;
        this.documentStorageService = documentStorageService;
        this.embeddingService = embeddingService;
    }

    @Override
    public void getLatestInvoices(
            GetLatestInvoicesRequest request,
            StreamObserver<GetLatestInvoicesResponse> responseObserver) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        // limit <= 0 (including the proto3 default 0) means "all" — a caller that wants
        // every invoice, like export-service, must not have to guess a large-enough cap.
        Pageable pageable =
                request.getLimit() <= 0
                        ? Pageable.unpaged(sort)
                        : PageRequest.of(0, request.getLimit(), sort);
        // Only accepted invoices feed chat context, tax suggestions and exports — invoices
        // still under review must not influence downstream services.
        var invoices =
                request.hasInvoiceYear()
                        ? invoiceRepository.findByUserIdAndStatusAndInvoiceDateYear(
                                request.getUserId(),
                                InvoiceStatus.ACCEPTED,
                                request.getInvoiceYear(),
                                pageable)
                        : invoiceRepository.findByUserIdAndStatus(
                                request.getUserId(), InvoiceStatus.ACCEPTED, pageable);
        GetLatestInvoicesResponse.Builder response = GetLatestInvoicesResponse.newBuilder();
        invoices.stream()
                .map(InvoiceResponse::from)
                .map(InternalInvoiceGrpcService::toProto)
                .forEach(response::addInvoices);
        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getDocuments(
            GetDocumentsRequest request, StreamObserver<GetDocumentsResponse> responseObserver) {
        GetDocumentsResponse.Builder response = GetDocumentsResponse.newBuilder();
        // Scoped by user AND requested ids server-side, so a caller never transfers (or
        // sees) documents it did not ask for or does not own.
        documentRepository
                .findByUserIdAndIdIn(request.getUserId(), request.getDocumentIdsList())
                .stream()
                .map(InternalInvoiceGrpcService::toProto)
                .forEach(response::addDocuments);
        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getDocumentContent(
            GetDocumentContentRequest request,
            StreamObserver<GetDocumentContentResponse> responseObserver) {
        Document document = documentRepository.findById(request.getDocumentId()).orElse(null);
        // One NOT_FOUND for both missing and foreign documents: no existence oracle.
        if (document == null || !request.getUserId().equals(document.getUserId())) {
            responseObserver.onError(
                    Status.NOT_FOUND
                            .withDescription("document " + request.getDocumentId())
                            .asRuntimeException());
            return;
        }
        byte[] content = documentStorageService.loadBytes(document.getStoragePath());
        responseObserver.onNext(
                GetDocumentContentResponse.newBuilder()
                        .setContent(ByteString.copyFrom(content))
                        .build());
        responseObserver.onCompleted();
    }

    @Override
    public void updateInvoice(
            UpdateInvoiceRequest request, StreamObserver<UpdateInvoiceResponse> responseObserver) {
        com.lotofopps.backend.model.Invoice invoice =
                invoiceRepository.findById(request.getInvoiceId()).orElse(null);
        // One NOT_FOUND for both missing and foreign invoices: no existence oracle.
        if (invoice == null || !request.getUserId().equals(invoice.getUserId())) {
            responseObserver.onError(
                    Status.NOT_FOUND
                            .withDescription("invoice " + request.getInvoiceId())
                            .asRuntimeException());
            return;
        }
        if (request.hasItemName()) {
            invoice.setItemName(request.getItemName());
        }
        if (request.hasPrice()) {
            try {
                invoice.setPrice(new BigDecimal(request.getPrice()));
            } catch (NumberFormatException e) {
                responseObserver.onError(
                        Status.INVALID_ARGUMENT
                                .withDescription("invalid price: " + request.getPrice())
                                .asRuntimeException());
                return;
            }
        }
        if (request.hasCategory()) {
            try {
                invoice.setCategory(InvoiceCategory.valueOf(request.getCategory()));
            } catch (IllegalArgumentException e) {
                responseObserver.onError(
                        Status.INVALID_ARGUMENT
                                .withDescription("invalid category: " + request.getCategory())
                                .asRuntimeException());
                return;
            }
        }
        com.lotofopps.backend.model.Invoice saved = invoiceRepository.save(invoice);
        // Only accepted invoices belong in the chat vector store (same rule as the REST
        // PUT endpoint) — re-embed so an agent-driven edit is reflected in chat context.
        if (saved.getStatus() == InvoiceStatus.ACCEPTED) {
            embeddingService.embedInvoice(saved);
        }
        responseObserver.onNext(
                UpdateInvoiceResponse.newBuilder()
                        .setInvoice(toProto(InvoiceResponse.from(saved)))
                        .build());
        responseObserver.onCompleted();
    }

    @Override
    public void findPotentialDuplicates(
            FindPotentialDuplicatesRequest request,
            StreamObserver<FindPotentialDuplicatesResponse> responseObserver) {
        BigDecimal price;
        try {
            price = new BigDecimal(request.getPrice());
        } catch (NumberFormatException e) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT
                            .withDescription("invalid price: " + request.getPrice())
                            .asRuntimeException());
            return;
        }
        var candidates =
                invoiceRepository.findByUserIdAndCompanyIgnoreCaseAndPrice(
                        request.getUserId(), request.getCompany(), price);
        FindPotentialDuplicatesResponse.Builder response =
                FindPotentialDuplicatesResponse.newBuilder();
        candidates.stream()
                .filter(
                        i ->
                                !request.hasInvoiceDate()
                                        || request.getInvoiceDate()
                                                .equals(
                                                        i.getInvoiceDate() != null
                                                                ? i.getInvoiceDate().toString()
                                                                : null))
                .map(InvoiceResponse::from)
                .map(InternalInvoiceGrpcService::toProto)
                .forEach(response::addInvoices);
        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    @Override
    public void createInvoice(
            CreateInvoiceRequest request, StreamObserver<CreateInvoiceResponse> responseObserver) {
        BigDecimal price;
        try {
            price = new BigDecimal(request.getPrice());
        } catch (NumberFormatException e) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT
                            .withDescription("invalid price: " + request.getPrice())
                            .asRuntimeException());
            return;
        }
        InvoiceCategory category;
        try {
            category = InvoiceCategory.valueOf(request.getCategory());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT
                            .withDescription("invalid category: " + request.getCategory())
                            .asRuntimeException());
            return;
        }
        com.lotofopps.backend.model.Invoice invoice =
                new com.lotofopps.backend.model.Invoice(
                        request.getItemName(), request.getCompany(), price);
        invoice.setUserId(request.getUserId());
        invoice.setCategory(category);
        if (request.hasInvoiceDate()) {
            try {
                invoice.setInvoiceDate(LocalDate.parse(request.getInvoiceDate()));
            } catch (DateTimeParseException e) {
                responseObserver.onError(
                        Status.INVALID_ARGUMENT
                                .withDescription("invalid date: " + request.getInvoiceDate())
                                .asRuntimeException());
                return;
            }
        }
        invoice.setStatus(InvoiceStatus.ACCEPTED);
        com.lotofopps.backend.model.Invoice saved = invoiceRepository.save(invoice);
        embeddingService.embedInvoice(saved);
        responseObserver.onNext(
                CreateInvoiceResponse.newBuilder()
                        .setInvoice(toProto(InvoiceResponse.from(saved)))
                        .build());
        responseObserver.onCompleted();
    }

    private static Invoice toProto(InvoiceResponse r) {
        Invoice.Builder b =
                Invoice.newBuilder()
                        .setId(r.getId())
                        .setItemName(nullToEmpty(r.getItemName()))
                        .setCompany(nullToEmpty(r.getCompany()))
                        .setPrice(r.getPrice() != null ? r.getPrice().toPlainString() : "")
                        .setCategory(r.getCategory() != null ? r.getCategory().name() : "")
                        .setUserId(nullToEmpty(r.getUserId()))
                        .setStatus(r.getStatus() != null ? r.getStatus().name() : "");
        if (r.getInvoiceDate() != null) {
            b.setInvoiceDate(r.getInvoiceDate().toString());
        }
        if (r.getCreatedAt() != null) {
            b.setCreatedAt(r.getCreatedAt().toString());
        }
        if (r.getDocumentId() != null) {
            b.setDocumentId(r.getDocumentId());
        }
        return b.build();
    }

    private static com.lotofopps.backend.grpc.Document toProto(Document d) {
        return com.lotofopps.backend.grpc.Document.newBuilder()
                .setId(d.getId())
                .setFilename(nullToEmpty(d.getFilename()))
                .setContentType(nullToEmpty(d.getContentType()))
                .setSizeBytes(d.getSizeBytes() != null ? d.getSizeBytes() : 0)
                .setUploadedAt(d.getUploadedAt() != null ? d.getUploadedAt().toString() : "")
                .setUserId(nullToEmpty(d.getUserId()))
                .build();
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }
}
