package com.lotofopps.backend.controller;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.DocumentStorageService;
import com.lotofopps.backend.service.ExtractionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DocumentController.class)
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DocumentStorageService documentStorageService;

    @MockitoBean
    private DocumentRepository documentRepository;

    @MockitoBean
    private InvoiceRepository invoiceRepository;

    @MockitoBean
    private ExtractionService extractionService;

    @Test
    void uploadDocumentReturnsUploadResponse() throws Exception {
        Document document = new Document("invoice.pdf", "application/pdf", 13L, "/uploads/some-uuid.pdf");
        ReflectionTestUtils.setField(document, "id", 1L);
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));
        ReflectionTestUtils.setField(invoice, "id", 1L);

        when(documentStorageService.store(any(), any())).thenReturn(document);
        when(extractionService.extractAndStore(any())).thenReturn(List.of(invoice));

        MockMultipartFile file = new MockMultipartFile(
                "file", "invoice.pdf", "application/pdf", "dummy content".getBytes());

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(file)
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Document received"))
                .andExpect(jsonPath("$.filename").value("invoice.pdf"))
                .andExpect(jsonPath("$.documentId").exists())
                .andExpect(jsonPath("$.invoiceIds").isArray());
    }

    @Test
    void uploadEmptyFileReturnsBadRequest() throws Exception {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(emptyFile)
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("No file provided"));
    }

    @Test
    void uploadUnsupportedFileTypeReturnsBadRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "document.txt", "text/plain", "some text".getBytes());

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(file)
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, TIFF"));
    }

    @Test
    void uploadOversizedFileReturnsBadRequest() throws Exception {
        byte[] largeContent = new byte[11 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile(
                "file", "big.pdf", "application/pdf", largeContent);

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(file)
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("File exceeds maximum allowed size of 10 MB"));
    }

    @Test
    void uploadReturns500WhenExtractionFails() throws Exception {
        Document document = new Document("invoice.pdf", "application/pdf", 13L, "/uploads/some-uuid.pdf");

        when(documentStorageService.store(any(), any())).thenReturn(document);
        when(extractionService.extractAndStore(any())).thenThrow(new RuntimeException("LLM unavailable"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "invoice.pdf", "application/pdf", "dummy content".getBytes());

        mockMvc.perform(multipart("/api/documents/upload")
                        .file(file)
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Extraction failed: LLM unavailable"));
    }

    @Test
    void listDocumentsReturnsDocumentResponseFields() throws Exception {
        Document document = new Document("report.pdf", "application/pdf", 42L, "/uploads/report.pdf");
        when(documentRepository.findByUserId(any())).thenReturn(List.of(document));

        mockMvc.perform(get("/api/documents")
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].filename").value("report.pdf"))
                .andExpect(jsonPath("$[0].contentType").value("application/pdf"))
                .andExpect(jsonPath("$[0].storagePath").doesNotExist());
    }
}
