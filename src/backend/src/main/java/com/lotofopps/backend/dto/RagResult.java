package com.lotofopps.backend.dto;

import com.lotofopps.backend.model.InvoiceCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

public class RagResult {

    private Long invoiceId;
    private String itemName;
    private String company;
    private BigDecimal price;
    private InvoiceCategory category;
    private LocalDate invoiceDate;
    private double relevanceScore;
    private String snippet;

    public RagResult(Long invoiceId, String itemName, String company, BigDecimal price,
                     InvoiceCategory category, LocalDate invoiceDate, double relevanceScore, String snippet) {
        this.invoiceId = invoiceId;
        this.itemName = itemName;
        this.company = company;
        this.price = price;
        this.category = category;
        this.invoiceDate = invoiceDate;
        this.relevanceScore = relevanceScore;
        this.snippet = snippet;
    }

    public Long getInvoiceId() { return invoiceId; }
    public String getItemName() { return itemName; }
    public String getCompany() { return company; }
    public BigDecimal getPrice() { return price; }
    public InvoiceCategory getCategory() { return category; }
    public LocalDate getInvoiceDate() { return invoiceDate; }
    public double getRelevanceScore() { return relevanceScore; }
    public String getSnippet() { return snippet; }
}
