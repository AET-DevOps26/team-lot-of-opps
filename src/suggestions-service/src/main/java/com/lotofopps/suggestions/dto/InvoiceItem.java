package com.lotofopps.suggestions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Subset of the invoice-service InvoiceResponse returned by
 * GET /internal/invoices/latest.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record InvoiceItem(
        Long id,
        String itemName,
        String company,
        BigDecimal price,
        String category,
        LocalDate invoiceDate,
        LocalDateTime createdAt) {
}
