package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.SuggestionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/suggestions")
@Tag(name = "Suggestions")
public class SuggestionsController {

    private static final List<SuggestionResponse> DUMMY_SUGGESTIONS = List.of(
        new SuggestionResponse(
            "Sie haben eine Hotelrechnung hochgeladen – fehlt noch der Zug- oder Flugbeleg? Reisekosten erfordern in der Regel beide Belege.",
            "2025-06-01T10:00:00"),
        new SuggestionResponse(
            "Internetkosten sind anteilig absetzbar – haben Sie alle Monatsrechnungen für das gesamte Jahr erfasst?",
            "2025-05-15T09:30:00"),
        new SuggestionResponse(
            "Für Arbeitsmittel wie Laptop oder Schreibtisch können Sie Belege nachreichen, sofern diese beruflich genutzt werden.",
            "2025-05-10T14:00:00"),
        new SuggestionResponse(
            "Bei Fortbildungskosten sollten auch die Fahrtkosten zur Schulung angegeben werden.",
            "2025-04-22T11:15:00")
    );

    @GetMapping
    @Operation(summary = "Get proactive tax suggestions for the authenticated user", responses = {
        @ApiResponse(responseCode = "200", description = "List of suggestions"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<List<SuggestionResponse>> getSuggestions() {
        return ResponseEntity.ok(DUMMY_SUGGESTIONS);
    }
}
