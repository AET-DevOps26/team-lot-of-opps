package com.lotofopps.backend.exception;

import com.lotofopps.backend.model.Document;

public class DuplicateDocumentException extends RuntimeException {

    private final Document existing;

    public DuplicateDocumentException(Document existing) {
        super("Duplicate document");
        this.existing = existing;
    }

    public Document getExisting() {
        return existing;
    }
}
