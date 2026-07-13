package com.lotofopps.backend.dto;

import com.lotofopps.backend.model.Document;
import java.time.LocalDateTime;

public class DocumentResponse {

    private Long id;
    private String filename;
    private String contentType;
    private Long sizeBytes;
    private LocalDateTime uploadedAt;
    private String userId;

    public DocumentResponse(
            Long id,
            String filename,
            String contentType,
            Long sizeBytes,
            LocalDateTime uploadedAt,
            String userId) {
        this.id = id;
        this.filename = filename;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.uploadedAt = uploadedAt;
        this.userId = userId;
    }

    public static DocumentResponse from(Document d) {
        return new DocumentResponse(
                d.getId(),
                d.getFilename(),
                d.getContentType(),
                d.getSizeBytes(),
                d.getUploadedAt(),
                d.getUserId());
    }

    public Long getId() {
        return id;
    }

    public String getFilename() {
        return filename;
    }

    public String getContentType() {
        return contentType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public String getUserId() {
        return userId;
    }
}
