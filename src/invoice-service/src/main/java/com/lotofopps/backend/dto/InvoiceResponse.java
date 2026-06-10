package com.lotofopps.backend.dto;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceCategory;

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

    public InvoiceResponse(Long id, String itemName, String company, BigDecimal price,
                           InvoiceCategory category, String userId, LocalDate invoiceDate,
                           LocalDateTime createdAt, Long documentId) {
        this.id = id;
        this.itemName = itemName;
        this.company = company;
        this.price = price;
        this.category = category;
        this.userId = userId;
        this.invoiceDate = invoiceDate;
        this.createdAt = createdAt;
        this.documentId = documentId;
    }

    public static InvoiceResponse from(Invoice i) {
        Long documentId = i.getDocument() != null ? i.getDocument().getId() : null;
        return new InvoiceResponse(
                i.getId(), i.getItemName(), i.getCompany(), i.getPrice(),
                i.getCategory(), i.getUserId(), i.getInvoiceDate(),
                i.getCreatedAt(), documentId);
    }

    public Long getId() { return id; }
    public String getItemName() { return itemName; }
    public String getCompany() { return company; }
    public BigDecimal getPrice() { return price; }
    public InvoiceCategory getCategory() { return category; }
    public String getUserId() { return userId; }
    public LocalDate getInvoiceDate() { return invoiceDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getDocumentId() { return documentId; }
}
