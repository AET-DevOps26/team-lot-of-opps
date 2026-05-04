package com.lotofopps.backend.dto;

public class UploadResponse {

    private String message;
    private String filename;
    private Long documentId;
    private Long invoiceId;

    public UploadResponse(String message, String filename, Long documentId, Long invoiceId) {
        this.message = message;
        this.filename = filename;
        this.documentId = documentId;
        this.invoiceId = invoiceId;
    }

    public String getMessage() { return message; }
    public String getFilename() { return filename; }
    public Long getDocumentId() { return documentId; }
    public Long getInvoiceId() { return invoiceId; }
}
