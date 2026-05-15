package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.repository.InvoiceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
@Tag(name = "Invoices")
public class InvoiceController {

    private final InvoiceRepository invoiceRepository;

    public InvoiceController(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @GetMapping("/health")
    @Operation(summary = "Health check", responses = {
        @ApiResponse(responseCode = "200", description = "Service is up")
    })
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    @GetMapping
    @Operation(summary = "List invoices for the authenticated user, optionally filtered by year", responses = {
        @ApiResponse(responseCode = "200", description = "List of invoices")
    })
    public ResponseEntity<List<InvoiceResponse>> listInvoices(
            @RequestParam(required = false) Integer invoiceYear) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        List<InvoiceResponse> results = (invoiceYear != null)
                ? invoiceRepository.findByUserIdAndInvoiceDateYear(userId, invoiceYear).stream().map(InvoiceResponse::from).toList()
                : invoiceRepository.findByUserId(userId).stream().map(InvoiceResponse::from).toList();
        return ResponseEntity.ok(results);
    }
    // TODO: Custom Post method

}
