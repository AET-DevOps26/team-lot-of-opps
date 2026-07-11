package com.lotofopps.suggestions.service;

import com.lotofopps.backend.grpc.GetLatestInvoicesRequest;
import com.lotofopps.backend.grpc.InternalInvoiceServiceGrpc;
import com.lotofopps.suggestions.client.model.InvoiceCategory;
import com.lotofopps.suggestions.client.model.InvoiceResponse;
import com.lotofopps.suggestions.client.model.InvoiceStatus;
import io.grpc.StatusRuntimeException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class InvoiceClient {

    private final InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub;

    public InvoiceClient(
            InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub) {
        this.invoiceStub = invoiceStub;
    }

    public List<InvoiceResponse> fetchLatestInvoices(String userId, int limit) {
        try {
            return invoiceStub
                    .getLatestInvoices(
                            GetLatestInvoicesRequest.newBuilder()
                                    .setUserId(userId)
                                    .setLimit(limit)
                                    .build())
                    .getInvoicesList()
                    .stream()
                    .map(InvoiceClient::fromProto)
                    .toList();
        } catch (StatusRuntimeException e) {
            throw new RuntimeException("invoice-service gRPC call for latest invoices failed", e);
        }
    }

    // Map the proto Invoice back onto the OpenAPI-generated model that SuggestionService consumes.
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
}
