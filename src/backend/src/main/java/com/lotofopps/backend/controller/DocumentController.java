package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.DocumentResponse;
import com.lotofopps.backend.dto.UploadResponse;
import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.service.AiBackendService;
import com.lotofopps.backend.service.DocumentStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@Tag(name = "Documents")
public class DocumentController {

    private final DocumentStorageService documentStorageService;
    private final DocumentRepository documentRepository;
    private final AiBackendService aiBackendService;

    public DocumentController(
            DocumentStorageService documentStorageService,
            DocumentRepository documentRepository,
            AiBackendService aiBackendService) {
        this.documentStorageService = documentStorageService;
        this.documentRepository = documentRepository;
        this.aiBackendService = aiBackendService;
    }

    @PostMapping("/upload")
    @Operation(summary = "Upload a document", responses = {
        @ApiResponse(responseCode = "200", description = "Document received and processed"),
        @ApiResponse(responseCode = "400", description = "No file provided"),
        @ApiResponse(responseCode = "500", description = "Failed to store file"),
        @ApiResponse(responseCode = "502", description = "AI backend call failed")
    })
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }
        try {
            Document document = documentStorageService.store(file);
            Invoice invoice = aiBackendService.extractAndStore(document);
            return ResponseEntity.ok(new UploadResponse(
                    "Document received", file.getOriginalFilename(),
                    document.getId(), invoice.getId()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to store file"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "AI processing failed: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/content")
    @Operation(summary = "Download document content", responses = {
        @ApiResponse(responseCode = "200", description = "File content"),
        @ApiResponse(responseCode = "404", description = "Document not found")
    })
    public ResponseEntity<Resource> downloadDocument(@PathVariable Long id) {
        Document document = documentRepository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
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
    @Operation(summary = "List all documents", responses = {
        @ApiResponse(responseCode = "200", description = "List of documents")
    })
    public ResponseEntity<List<DocumentResponse>> listDocuments() {
        return ResponseEntity.ok(documentRepository.findAll().stream()
                .map(DocumentResponse::from)
                .toList());
    }
}
