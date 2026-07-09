package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.InvoiceRepository;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/invoices")
public class InternalInvoiceController {

    private final InvoiceRepository invoiceRepository;

    public InternalInvoiceController(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @GetMapping("/latest")
    public ResponseEntity<List<InvoiceResponse>> getLatestInvoices(
            @RequestParam String userId, @RequestParam(defaultValue = "10") int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        // Only accepted invoices feed chat context and tax suggestions — invoices still
        // under review must not influence downstream services.
        List<InvoiceResponse> results =
                invoiceRepository
                        .findByUserIdAndStatus(userId, InvoiceStatus.ACCEPTED, pageable)
                        .stream()
                        .map(InvoiceResponse::from)
                        .toList();
        return ResponseEntity.ok(results);
    }
}
