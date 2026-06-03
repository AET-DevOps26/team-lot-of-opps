package com.lotofopps.backend.dto;

public class RagStatusResponse {

    private boolean embeddingsReady;
    private int totalEmbeddings;
    private String message;

    public RagStatusResponse(boolean embeddingsReady, int totalEmbeddings, String message) {
        this.embeddingsReady = embeddingsReady;
        this.totalEmbeddings = totalEmbeddings;
        this.message = message;
    }

    public boolean isEmbeddingsReady() { return embeddingsReady; }
    public int getTotalEmbeddings() { return totalEmbeddings; }
    public String getMessage() { return message; }
}
