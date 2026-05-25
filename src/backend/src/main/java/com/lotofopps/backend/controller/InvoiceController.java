package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/invoices")
@Tag(name = "Invoices")
public class InvoiceController {

    private final InvoiceRepository invoiceRepository;
    private final DocumentRepository documentRepository;
    private final DocumentStorageService documentStorageService;

    public InvoiceController(InvoiceRepository invoiceRepository, DocumentRepository documentRepository, DocumentStorageService documentStorageService) {
        this.invoiceRepository = invoiceRepository;
        this.documentRepository = documentRepository;
        this.documentStorageService = documentStorageService;
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
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an invoice and its associated document", responses = {
        @ApiResponse(responseCode = "204", description = "Deleted"),
        @ApiResponse(responseCode = "403", description = "Forbidden"),
        @ApiResponse(responseCode = "404", description = "Not found")
    })
    public ResponseEntity<Void> deleteInvoice(@PathVariable Long id) throws IOException {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        Invoice invoice = invoiceRepository.findById(id).orElse(null);
        if (invoice == null) return ResponseEntity.notFound().build();
        if (!userId.equals(invoice.getUserId())) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        Document doc = invoice.getDocument();
        invoiceRepository.delete(invoice);
        if (doc != null && invoiceRepository.findByDocumentId(doc.getId()).isEmpty()) {
            documentRepository.delete(doc);
            documentStorageService.deleteFile(doc.getStoragePath());
        }
        return ResponseEntity.noContent().build();
    }

}
