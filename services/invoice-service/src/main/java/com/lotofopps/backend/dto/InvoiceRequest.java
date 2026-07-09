package com.lotofopps.backend.dto;

import com.lotofopps.backend.model.InvoiceCategory;
import java.math.BigDecimal;
import java.time.LocalDate;

public class InvoiceRequest {
    private String itemName;
    private String company;
    private BigDecimal price;
    private InvoiceCategory category;
    private LocalDate invoiceDate;

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public InvoiceCategory getCategory() {
        return category;
    }

    public void setCategory(InvoiceCategory category) {
        this.category = category;
    }

    public LocalDate getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(LocalDate invoiceDate) {
        this.invoiceDate = invoiceDate;
    }
}
