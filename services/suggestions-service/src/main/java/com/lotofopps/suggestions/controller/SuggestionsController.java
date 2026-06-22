package com.lotofopps.suggestions.controller;

import com.lotofopps.suggestions.dto.SuggestionResponse;
import com.lotofopps.suggestions.service.SuggestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/suggestions")
@Tag(name = "Suggestions")
public class SuggestionsController {

    private final SuggestionService suggestionService;

    public SuggestionsController(SuggestionService suggestionService) {
        this.suggestionService = suggestionService;
    }

    private String currentUserId(HttpServletRequest request) {
        return request.getHeader("X-User-Sub");
    }

    @GetMapping
    @Operation(summary = "Get proactive tax suggestions based on the user's most recent invoices", responses = {
        @ApiResponse(responseCode = "200", description = "List of suggestions, most recent first"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<List<SuggestionResponse>> getSuggestions(
            HttpServletRequest request,
            @RequestParam(name = "language", defaultValue = "en") String language) {
        String userId = currentUserId(request);
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(suggestionService.getSuggestions(userId, language));
    }
}
