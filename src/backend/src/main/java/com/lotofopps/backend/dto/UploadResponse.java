package com.lotofopps.backend.dto;

import java.util.List;

public class UploadResponse {

    private String message;
    private String filename;
    private Long documentId;
    private List<Long> invoiceIds;

    public UploadResponse(String message, String filename, Long documentId, List<Long> invoiceIds) {
        this.message = message;
        this.filename = filename;
        this.documentId = documentId;
        this.invoiceIds = invoiceIds;
    }

    public String getMessage() { return message; }
    public String getFilename() { return filename; }
    public Long getDocumentId() { return documentId; }
    public List<Long> getInvoiceIds() { return invoiceIds; }
}
