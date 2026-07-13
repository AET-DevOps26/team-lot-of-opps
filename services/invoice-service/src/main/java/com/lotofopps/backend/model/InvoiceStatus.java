package com.lotofopps.backend.model;

/**
 * Review state of an invoice.
 *
 * <p>Invoices extracted from an uploaded document start as {@link #PENDING}: they are not shown in
 * the main list, embedded for chat RAG, or counted towards tax suggestions until the user reviews
 * and keeps them. Manually created invoices and accepted ones are {@link #ACCEPTED}.
 */
public enum InvoiceStatus {
    PENDING,
    ACCEPTED
}
