package com.lotofopps.backend.dto;

public record ExtractionItem(
        String product_name,
        String company,
        double value,
        String invoice_date,
        String category
) {}
