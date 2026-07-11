package com.lotofopps.backend.grpc;

import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.InvoiceRepository;
import io.grpc.stub.StreamObserver;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class InternalInvoiceGrpcService
        extends InternalInvoiceServiceGrpc.InternalInvoiceServiceImplBase {

    private final InvoiceRepository invoiceRepository;

    public InternalInvoiceGrpcService(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    public void getLatestInvoices(
            GetLatestInvoicesRequest request,
            StreamObserver<GetLatestInvoicesResponse> responseObserver) {
        Pageable pageable =
                PageRequest.of(0, request.getLimit(), Sort.by(Sort.Direction.DESC, "createdAt"));
        // Only accepted invoices feed chat context and tax suggestions — invoices still
        // under review must not influence downstream services.
        GetLatestInvoicesResponse.Builder response = GetLatestInvoicesResponse.newBuilder();
        invoiceRepository
                .findByUserIdAndStatus(request.getUserId(), InvoiceStatus.ACCEPTED, pageable)
                .stream()
                .map(InvoiceResponse::from)
                .map(InternalInvoiceGrpcService::toProto)
                .forEach(response::addInvoices);
        responseObserver.onNext(response.build());
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

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }
}
