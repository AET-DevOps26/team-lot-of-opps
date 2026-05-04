package com.lotofopps.backend.controller;

import com.lotofopps.backend.model.Document;
import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.service.AiBackendService;
import com.lotofopps.backend.service.DocumentStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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
    private AiBackendService aiBackendService;

    @Test
    void uploadDocumentReturnsUploadResponse() throws Exception {
        Document document = new Document("invoice.pdf", "application/pdf", 13L, "/uploads/some-uuid.pdf");
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));

        when(documentStorageService.store(any())).thenReturn(document);
        when(aiBackendService.extractAndStore(any())).thenReturn(invoice);

        MockMultipartFile file = new MockMultipartFile(
                "file", "invoice.pdf", "application/pdf", "dummy content".getBytes());

        mockMvc.perform(multipart("/api/documents/upload").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Document received"))
                .andExpect(jsonPath("$.filename").value("invoice.pdf"))
                .andExpect(jsonPath("$.documentId").exists())
                .andExpect(jsonPath("$.invoiceId").exists());
    }

    @Test
    void uploadEmptyFileReturnsBadRequest() throws Exception {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        mockMvc.perform(multipart("/api/documents/upload").file(emptyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("No file provided"));
    }

    @Test
    void listDocumentsReturnsDocumentResponseFields() throws Exception {
        Document document = new Document("report.pdf", "application/pdf", 42L, "/uploads/report.pdf");
        when(documentRepository.findAll()).thenReturn(List.of(document));

        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].filename").value("report.pdf"))
                .andExpect(jsonPath("$[0].contentType").value("application/pdf"))
                .andExpect(jsonPath("$[0].storagePath").doesNotExist());
    }
}
