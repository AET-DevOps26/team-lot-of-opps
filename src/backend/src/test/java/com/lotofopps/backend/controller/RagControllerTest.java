package com.lotofopps.backend.controller;

import com.lotofopps.backend.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RagController.class)
@WithMockUser
class RagControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtService jwtService;

    // --- POST /api/rag/query ---

    @Test
    void queryReturnsResultsArray() throws Exception {
        mockMvc.perform(post("/api/rag/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"query": "car expenses", "limit": 5}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results").isArray())
                .andExpect(jsonPath("$.totalFound").value(5));
    }

    @Test
    void queryEchoesQueryField() throws Exception {
        mockMvc.perform(post("/api/rag/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"query": "internet bill", "limit": 5}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query").value("internet bill"));
    }

    @Test
    void queryReturnsExpectedFields() throws Exception {
        mockMvc.perform(post("/api/rag/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"query": "fuel", "limit": 1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].invoiceId").exists())
                .andExpect(jsonPath("$.results[0].itemName").exists())
                .andExpect(jsonPath("$.results[0].company").exists())
                .andExpect(jsonPath("$.results[0].price").exists())
                .andExpect(jsonPath("$.results[0].category").exists())
                .andExpect(jsonPath("$.results[0].invoiceDate").exists())
                .andExpect(jsonPath("$.results[0].relevanceScore").exists())
                .andExpect(jsonPath("$.results[0].snippet").exists());
    }

    @Test
    void queryRespectsLimit() throws Exception {
        mockMvc.perform(post("/api/rag/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"query": "anything", "limit": 2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(2))
                .andExpect(jsonPath("$.totalFound").value(2));
    }

    @Test
    void queryWithDefaultLimitReturnsAllDummyResults() throws Exception {
        mockMvc.perform(post("/api/rag/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"query": "all invoices"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(5));
    }

    // --- GET /api/rag/status ---

    @Test
    void statusReturnsEmbeddingsReadyFalse() throws Exception {
        mockMvc.perform(get("/api/rag/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.embeddingsReady").value(false));
    }

    @Test
    void statusReturnsTotalEmbeddingsZero() throws Exception {
        mockMvc.perform(get("/api/rag/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalEmbeddings").value(0));
    }

    @Test
    void statusReturnsMessage() throws Exception {
        mockMvc.perform(get("/api/rag/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

}
