package com.lotofopps.suggestions.controller;

import com.lotofopps.suggestions.dto.SuggestionResponse;
import com.lotofopps.suggestions.service.SuggestionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SuggestionsController.class)
class SuggestionsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SuggestionService suggestionService;

    @Test
    void getSuggestionsReturnsSuggestionFields() throws Exception {
        when(suggestionService.getSuggestions("test-user", "en")).thenReturn(List.of(
                new SuggestionResponse("Upload your train ticket", LocalDateTime.of(2026, 6, 12, 10, 0))));

        mockMvc.perform(get("/api/suggestions")
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].suggestion").value("Upload your train ticket"))
                .andExpect(jsonPath("$[0].createdAt").exists());
    }

    @Test
    void getSuggestionsForwardsLanguageQueryParam() throws Exception {
        when(suggestionService.getSuggestions("test-user", "de")).thenReturn(List.of(
                new SuggestionResponse("Lade deine Zugfahrkarte hoch", LocalDateTime.of(2026, 6, 12, 10, 0))));

        mockMvc.perform(get("/api/suggestions")
                        .param("language", "de")
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].suggestion").value("Lade deine Zugfahrkarte hoch"));

        verify(suggestionService).getSuggestions("test-user", "de");
    }

    @Test
    void getSuggestionsReturnsEmptyListWhenNoInvoices() throws Exception {
        when(suggestionService.getSuggestions("test-user", "en")).thenReturn(List.of());

        mockMvc.perform(get("/api/suggestions")
                        .header("X-User-Sub", "test-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getSuggestionsReturns401WithoutUserHeader() throws Exception {
        mockMvc.perform(get("/api/suggestions"))
                .andExpect(status().isUnauthorized());

        verify(suggestionService, never()).getSuggestions(anyString(), anyString());
    }
}
