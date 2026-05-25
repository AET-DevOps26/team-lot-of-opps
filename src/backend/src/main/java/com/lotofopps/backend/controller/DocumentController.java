package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.DocumentResponse;
import com.lotofopps.backend.dto.UploadResponse;
import com.lotofopps.backend.exception.DuplicateDocumentException;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.service.AiBackendService;
import com.lotofopps.backend.service.DocumentStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/documents")
@Tag(name = "Documents")
public class DocumentController {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"
    );

    private final DocumentStorageService documentStorageService;
    private final DocumentRepository documentRepository;
    private final AiBackendService aiBackendService;
    private final long maxSizeBytes;

    public DocumentController(
            DocumentStorageService documentStorageService,
            DocumentRepository documentRepository,
            AiBackendService aiBackendService,
            @Value("${upload.max-size-bytes:10485760}") long maxSizeBytes) {
        this.documentStorageService = documentStorageService;
        this.documentRepository = documentRepository;
        this.aiBackendService = aiBackendService;
        this.maxSizeBytes = maxSizeBytes;
    }

    private String currentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    @PostMapping("/upload")
    @Operation(summary = "Upload a document", responses = {
        @ApiResponse(responseCode = "200", description = "Document received and processed"),
        @ApiResponse(responseCode = "400", description = "No file provided, invalid type, or file too large"),
        @ApiResponse(responseCode = "500", description = "Failed to store file"),
        @ApiResponse(responseCode = "502", description = "AI backend unavailable")
    })
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }
        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, TIFF"));
        }
        if (file.getSize() > maxSizeBytes) {
            return ResponseEntity.badRequest().body(Map.of("error", "File exceeds maximum allowed size of " + maxSizeBytes / (1024 * 1024) + " MB"));
        }
        try {
            Document document = documentStorageService.store(file, currentUserId());
            List<Invoice> invoices = aiBackendService.extractAndStore(document);
            List<Long> invoiceIds = invoices.stream().map(Invoice::getId).toList();
            return ResponseEntity.ok(new UploadResponse(
                    "Document received", file.getOriginalFilename(),
                    document.getId(), invoiceIds));
        } catch (DuplicateDocumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Duplicate document",
                    "documentId", e.getExisting().getId()
            ));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to store file"));
        } catch (RestClientException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "AI service unavailable"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "AI processing failed: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/content")
    @Operation(summary = "Download document content", responses = {
        @ApiResponse(responseCode = "200", description = "File content"),
        @ApiResponse(responseCode = "403", description = "Document belongs to another user"),
        @ApiResponse(responseCode = "404", description = "Document not found")
    })
    public ResponseEntity<Resource> downloadDocument(@PathVariable Long id) {
        Document document = documentRepository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!currentUserId().equals(document.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            Resource resource = documentStorageService.load(document.getStoragePath());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(document.getContentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + document.getFilename() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping
    @Operation(summary = "List documents for the authenticated user", responses = {
        @ApiResponse(responseCode = "200", description = "List of documents")
    })
    public ResponseEntity<List<DocumentResponse>> listDocuments() {
        return ResponseEntity.ok(documentRepository.findByUserId(currentUserId()).stream()
                .map(DocumentResponse::from)
                .toList());
    }
}
