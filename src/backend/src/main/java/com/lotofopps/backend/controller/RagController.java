package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.RagQueryRequest;
import com.lotofopps.backend.dto.RagQueryResponse;
import com.lotofopps.backend.dto.RagResult;
import com.lotofopps.backend.dto.RagStatusResponse;
import com.lotofopps.backend.model.InvoiceCategory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/rag")
@Tag(name = "RAG")
public class RagController {

    private static final List<RagResult> DUMMY_RESULTS = List.of(
        new RagResult(1L, "Tankrechnung", "ARAL", new BigDecimal("87.50"),
            InvoiceCategory.WEGE_ZUR_ARBEIT, LocalDate.of(2024, 3, 15), 0.92,
            "Fuel expense at ARAL on 2024-03-15"),
        new RagResult(2L, "Notebook Ladekabel", "Amazon", new BigDecimal("24.99"),
            InvoiceCategory.ARBEITSMITTEL, LocalDate.of(2024, 2, 8), 0.78,
            "Work equipment purchase at Amazon on 2024-02-08"),
        new RagResult(3L, "Bahnticket Berlin", "Deutsche Bahn", new BigDecimal("54.00"),
            InvoiceCategory.REISEKOSTEN, LocalDate.of(2024, 1, 22), 0.71,
            "Business travel to Berlin on 2024-01-22"),
        new RagResult(4L, "Internetanschluss Januar", "Telekom", new BigDecimal("39.99"),
            InvoiceCategory.INTERNET_UND_TELEFON, LocalDate.of(2024, 1, 5), 0.65,
            "Monthly internet subscription at Telekom on 2024-01-05"),
        new RagResult(5L, "Fachliteratur Java", "Thalia", new BigDecimal("49.90"),
            InvoiceCategory.FORTBILDUNGEN, LocalDate.of(2023, 12, 18), 0.58,
            "Professional development book at Thalia on 2023-12-18")
    );

    @PostMapping("/query")
    @Operation(summary = "Semantic search over invoices using natural language", responses = {
        @ApiResponse(responseCode = "200", description = "Query results"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<RagQueryResponse> query(@RequestBody RagQueryRequest request) {
        int limit = request.getLimit() > 0 ? Math.min(request.getLimit(), DUMMY_RESULTS.size()) : DUMMY_RESULTS.size();
        List<RagResult> results = DUMMY_RESULTS.subList(0, limit);
        return ResponseEntity.ok(new RagQueryResponse(request.getQuery(), results, results.size()));
    }

    @GetMapping("/status")
    @Operation(summary = "Get RAG pipeline status", responses = {
        @ApiResponse(responseCode = "200", description = "Pipeline status"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<RagStatusResponse> status() {
        return ResponseEntity.ok(new RagStatusResponse(false, 0, "RAG pipeline not yet connected — dummy mode active"));
    }
}
