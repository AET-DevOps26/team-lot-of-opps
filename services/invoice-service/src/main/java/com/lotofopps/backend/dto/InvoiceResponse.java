package com.lotofopps.backend.dto;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;
import com.lotofopps.backend.model.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class InvoiceResponse {

    private Long id;
    private String itemName;
    private String company;
    private BigDecimal price;
    private InvoiceCategory category;
    private String userId;
    private LocalDate invoiceDate;
    private LocalDateTime createdAt;
    private Long documentId;
    private InvoiceStatus status;

    public InvoiceResponse(
            Long id,
            String itemName,
            String company,
            BigDecimal price,
            InvoiceCategory category,
            String userId,
            LocalDate invoiceDate,
            LocalDateTime createdAt,
            Long documentId,
            InvoiceStatus status) {
        this.id = id;
        this.itemName = itemName;
        this.company = company;
        this.price = price;
        this.category = category;
        this.userId = userId;
        this.invoiceDate = invoiceDate;
        this.createdAt = createdAt;
        this.documentId = documentId;
        this.status = status;
    }

    public static InvoiceResponse from(Invoice i) {
        Long documentId = i.getDocument() != null ? i.getDocument().getId() : null;
        // Legacy rows may still be null until the startup backfill runs — treat as accepted.
        InvoiceStatus status = i.getStatus() != null ? i.getStatus() : InvoiceStatus.ACCEPTED;
        return new InvoiceResponse(
                i.getId(),
                i.getItemName(),
                i.getCompany(),
                i.getPrice(),
                i.getCategory(),
                i.getUserId(),
                i.getInvoiceDate(),
                i.getCreatedAt(),
                documentId,
                status);
    }

    public Long getId() {
        return id;
    }

    public String getItemName() {
        return itemName;
    }

    public String getCompany() {
        return company;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public InvoiceCategory getCategory() {
        return category;
    }

    public String getUserId() {
        return userId;
    }

    public LocalDate getInvoiceDate() {
        return invoiceDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public InvoiceStatus getStatus() {
        return status;
    }
}
