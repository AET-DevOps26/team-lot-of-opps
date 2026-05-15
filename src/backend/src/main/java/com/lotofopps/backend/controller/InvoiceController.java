package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.repository.InvoiceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invoices")
@Tag(name = "Invoices")
public class InvoiceController {

    private final InvoiceRepository invoiceRepository;

    public InvoiceController(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @GetMapping
    @Operation(summary = "List invoices for the authenticated user, optionally filtered by year and/or limited to the most recent N results", responses = {
        @ApiResponse(responseCode = "200", description = "List of invoices")
    })
    public ResponseEntity<List<InvoiceResponse>> listInvoices(
            @RequestParam(required = false) Integer invoiceYear,
            @RequestParam(required = false) Integer limit) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        Sort sort = Sort.by(Sort.Direction.DESC, "invoiceDate", "createdAt");
        Pageable pageable = (limit != null)
                ? PageRequest.of(0, limit, sort)
                : Pageable.unpaged(sort);
        List<InvoiceResponse> results = (invoiceYear != null)
                ? invoiceRepository.findByUserIdAndInvoiceDateYear(userId, invoiceYear, pageable).stream().map(InvoiceResponse::from).toList()
                : invoiceRepository.findByUserId(userId, pageable).stream().map(InvoiceResponse::from).toList();
        return ResponseEntity.ok(results);
    }
    // TODO: Custom Post method

}
