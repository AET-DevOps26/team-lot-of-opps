package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.SuggestionResponse;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.AiBackendService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/suggestions")
@Tag(name = "Suggestions")
public class SuggestionsController {

    private final AiBackendService aiBackendService;
    private final InvoiceRepository invoiceRepository;

    public SuggestionsController(AiBackendService aiBackendService, InvoiceRepository invoiceRepository) {
        this.aiBackendService = aiBackendService;
        this.invoiceRepository = invoiceRepository;
    }

    @GetMapping
    @Operation(summary = "Get proactive tax suggestions based on the last 5 uploaded invoices", responses = {
        @ApiResponse(responseCode = "200", description = "List of suggestions"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<List<SuggestionResponse>> getSuggestions() {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        List<Invoice> recent = invoiceRepository.findTop5ByUserIdOrderByCreatedAtDesc(userId);
        if (recent.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        String answer = aiBackendService.getSuggestions(userId, recent);
        return ResponseEntity.ok(List.of(new SuggestionResponse(answer, LocalDateTime.now().toString())));
    }
}
