package com.lotofopps.suggestions.dto;

import com.lotofopps.suggestions.model.Suggestion;

import java.time.LocalDateTime;

public class SuggestionResponse {

    private String suggestion;
    private LocalDateTime createdAt;

    public SuggestionResponse(String suggestion, LocalDateTime createdAt) {
        this.suggestion = suggestion;
        this.createdAt = createdAt;
    }

    public static SuggestionResponse from(Suggestion s) {
        return new SuggestionResponse(s.getSuggestion(), s.getCreatedAt());
    }

    public String getSuggestion() { return suggestion; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
