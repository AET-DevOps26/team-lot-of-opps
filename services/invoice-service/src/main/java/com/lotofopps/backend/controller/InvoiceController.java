package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.InvoiceRequest;
import com.lotofopps.backend.dto.InvoiceResponse;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import com.lotofopps.backend.service.LlmChatEmbeddingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/invoices")
@Tag(name = "Invoices")
public class InvoiceController {

    private static final Logger log = LoggerFactory.getLogger(InvoiceController.class);

    private final InvoiceRepository invoiceRepository;
    private final DocumentRepository documentRepository;
    private final DocumentStorageService documentStorageService;
    private final LlmChatEmbeddingService embeddingService;

    public InvoiceController(
            InvoiceRepository invoiceRepository,
            DocumentRepository documentRepository,
            DocumentStorageService documentStorageService,
            LlmChatEmbeddingService embeddingService) {
        this.invoiceRepository = invoiceRepository;
        this.documentRepository = documentRepository;
        this.documentStorageService = documentStorageService;
        this.embeddingService = embeddingService;
    }

    private String currentUserId(HttpServletRequest request) {
        return request.getHeader("X-User-Sub");
    }

    @GetMapping
    @Operation(
            summary =
                    "List invoices for the authenticated user, optionally filtered by review status and/or year and/or limited to the most recent N results. Defaults to ACCEPTED invoices so documents still under review stay hidden.",
            responses = {@ApiResponse(responseCode = "200", description = "List of invoices")})
    public ResponseEntity<List<InvoiceResponse>> listInvoices(
            @RequestParam(required = false) Integer invoiceYear,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) InvoiceStatus status,
            HttpServletRequest request) {
        String userId = currentUserId(request);
        InvoiceStatus effectiveStatus = (status != null) ? status : InvoiceStatus.ACCEPTED;
        Sort sort = Sort.by(Sort.Direction.DESC, "invoiceDate", "createdAt");
        Pageable pageable =
                (limit != null) ? PageRequest.of(0, limit, sort) : Pageable.unpaged(sort);
        List<InvoiceResponse> results =
                (invoiceYear != null)
                        ? invoiceRepository
                                .findByUserIdAndStatusAndInvoiceDateYear(
                                        userId, effectiveStatus, invoiceYear, pageable)
                                .stream()
                                .map(InvoiceResponse::from)
                                .toList()
                        : invoiceRepository
                                .findByUserIdAndStatus(userId, effectiveStatus, pageable)
                                .stream()
                                .map(InvoiceResponse::from)
                                .toList();
        return ResponseEntity.ok(results);
    }

    @PostMapping
    @Operation(
            summary = "Manually create a new invoice",
            responses = {
                @ApiResponse(responseCode = "201", description = "Created"),
                @ApiResponse(responseCode = "400", description = "Bad request")
            })
    public ResponseEntity<InvoiceResponse> createInvoice(
            @RequestBody InvoiceRequest req, HttpServletRequest request) {
        String userId = currentUserId(request);
        Invoice invoice = new Invoice(req.getItemName(), req.getCompany(), req.getPrice());
        invoice.setUserId(userId);
        invoice.setCategory(req.getCategory());
        invoice.setInvoiceDate(req.getInvoiceDate());
        // Manually entered invoices need no review — they are accepted (and embedded) directly.
        invoice.setStatus(InvoiceStatus.ACCEPTED);
        Invoice saved = invoiceRepository.save(invoice);
        embeddingService.embedInvoice(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(InvoiceResponse.from(saved));
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update an existing invoice",
            responses = {
                @ApiResponse(responseCode = "200", description = "Updated"),
                @ApiResponse(responseCode = "403", description = "Forbidden"),
                @ApiResponse(responseCode = "404", description = "Not found")
            })
    public ResponseEntity<InvoiceResponse> updateInvoice(
            @PathVariable Long id, @RequestBody InvoiceRequest req, HttpServletRequest request) {
        String userId = currentUserId(request);
        Invoice invoice = invoiceRepository.findById(id).orElse(null);
        if (invoice == null) return ResponseEntity.notFound().build();
        if (!userId.equals(invoice.getUserId()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        invoice.setItemName(req.getItemName());
        invoice.setCompany(req.getCompany());
        invoice.setPrice(req.getPrice());
        invoice.setCategory(req.getCategory());
        invoice.setInvoiceDate(req.getInvoiceDate());
        Invoice saved = invoiceRepository.save(invoice);
        // Only accepted invoices belong in the chat vector store. Editing a still-pending
        // invoice (during review) must not embed it early — it is embedded on accept.
        if (saved.getStatus() == InvoiceStatus.ACCEPTED) {
            embeddingService.embedInvoice(saved);
        }
        return ResponseEntity.ok(InvoiceResponse.from(saved));
    }

    @PostMapping("/{id}/accept")
    @Operation(
            summary =
                    "Keep (accept) an invoice that is under review. Makes it visible in the list and embeds it for chat.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Accepted"),
                @ApiResponse(responseCode = "403", description = "Forbidden"),
                @ApiResponse(responseCode = "404", description = "Not found")
            })
    public ResponseEntity<InvoiceResponse> acceptInvoice(
            @PathVariable Long id, HttpServletRequest request) {
        String userId = currentUserId(request);
        Invoice invoice = invoiceRepository.findById(id).orElse(null);
        if (invoice == null) return ResponseEntity.notFound().build();
        if (!userId.equals(invoice.getUserId()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        invoice.setStatus(InvoiceStatus.ACCEPTED);
        Invoice saved = invoiceRepository.save(invoice);
        embeddingService.embedInvoice(saved);
        return ResponseEntity.ok(InvoiceResponse.from(saved));
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary =
                    "Delete an invoice and its associated document if no other invoices reference it",
            responses = {
                @ApiResponse(responseCode = "204", description = "Deleted"),
                @ApiResponse(responseCode = "403", description = "Forbidden"),
                @ApiResponse(responseCode = "404", description = "Not found")
            })
    public ResponseEntity<Void> deleteInvoice(@PathVariable Long id, HttpServletRequest request)
            throws IOException {
        String userId = currentUserId(request);
        Invoice invoice = invoiceRepository.findById(id).orElse(null);
        if (invoice == null) return ResponseEntity.notFound().build();
        if (!userId.equals(invoice.getUserId()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        Long invoiceId = invoice.getId();
        Document doc = invoice.getDocument();
        invoiceRepository.delete(invoice);
        embeddingService.deleteEmbedding(invoiceId);
        if (doc != null && invoiceRepository.findByDocumentId(doc.getId()).isEmpty()) {
            documentRepository.delete(doc);
            documentStorageService.deleteFile(doc.getStoragePath());
        }
        return ResponseEntity.noContent().build();
    }
}
