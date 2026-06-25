package com.lotofopps.suggestions.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lotofopps.suggestions.client.model.InvoiceCategory;
import com.lotofopps.suggestions.client.model.InvoiceResponse;
import com.lotofopps.suggestions.dto.SuggestionResponse;
import com.lotofopps.suggestions.model.Suggestion;
import com.lotofopps.suggestions.repository.SuggestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SuggestionServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String USER_ID = "test-user";
    private static final String LLM_RESPONSE = """
            {"choices": [{"message": {"content": "{\\"suggestions\\": [\\"Upload your train ticket for the Berlin hotel.\\"]}"}}]}""";

    @Mock
    private SuggestionRepository suggestionRepository;

    @Mock
    private InvoiceClient invoiceClient;

    @Mock
    private RestTemplate restTemplate;

    private SuggestionService service;

    @BeforeEach
    void setUp() {
        service = new SuggestionService("http://localhost:9999", "test-model", "EMPTY", 5,
                suggestionRepository, invoiceClient, restTemplate);
    }

    private InvoiceResponse invoice(LocalDateTime createdAt) {
        return new InvoiceResponse()
                .id(1L)
                .itemName("Hotel Berlin")
                .company("Ibis")
                .price(new BigDecimal("200.00"))
                .category(InvoiceCategory.REISEKOSTEN)
                .invoiceDate(LocalDate.of(2026, 5, 1))
                .createdAt(createdAt);
    }

    private Suggestion storedSuggestion(LocalDateTime createdAt) {
        return storedSuggestion(createdAt, "en");
    }

    private Suggestion storedSuggestion(LocalDateTime createdAt, String language) {
        Suggestion s = new Suggestion(USER_ID, "Stored suggestion", language);
        ReflectionTestUtils.setField(s, "createdAt", createdAt);
        return s;
    }

    @Test
    void returnsEmptyListWhenUserHasNoInvoices() {
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5)).thenReturn(List.of());

        assertThat(service.getSuggestions(USER_ID, "en")).isEmpty();
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    void generatesAndStoresSuggestionWhenNoneExists() {
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(LocalDateTime.now())));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.empty());
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(LLM_RESPONSE));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID))
                .thenReturn(List.of(storedSuggestion(LocalDateTime.now())));

        List<SuggestionResponse> result = service.getSuggestions(USER_ID, "en");

        assertThat(result).hasSize(1);
        verify(suggestionRepository).save(any(Suggestion.class));
    }

    @Test
    void storesEachStructuredSuggestionAsSeparateRowAndReplacesOldSet() {
        String content = "{\"suggestions\": ["
                + "\"Upload your train ticket for the Berlin hotel.\","
                + "\"Add the internet bill for your home office claim.\"]}";
        String twoSuggestions = MAPPER.createObjectNode().set("choices",
                MAPPER.createArrayNode().add(MAPPER.createObjectNode().set("message",
                        MAPPER.createObjectNode().put("content", content)))).toString();
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(LocalDateTime.now())));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.empty());
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(twoSuggestions));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID)).thenReturn(List.of());

        service.getSuggestions(USER_ID, "en");

        verify(suggestionRepository).deleteByUserId(USER_ID);
        ArgumentCaptor<Suggestion> captor = ArgumentCaptor.forClass(Suggestion.class);
        verify(suggestionRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(Suggestion::getSuggestion)
                .containsExactly("Upload your train ticket for the Berlin hotel.",
                        "Add the internet bill for your home office claim.");
    }

    @Test
    void skipsGenerationWhenSuggestionNewerThanInvoices() {
        LocalDateTime invoiceTime = LocalDateTime.now().minusDays(1);
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(invoiceTime)));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.of(storedSuggestion(LocalDateTime.now())));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID))
                .thenReturn(List.of(storedSuggestion(LocalDateTime.now())));

        List<SuggestionResponse> result = service.getSuggestions(USER_ID, "en");

        assertThat(result).hasSize(1);
        verify(restTemplate, never()).exchange(anyString(), any(HttpMethod.class), any(), eq(String.class));
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    void regeneratesWhenInvoicesNewerThanSuggestion() {
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(LocalDateTime.now())));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.of(storedSuggestion(LocalDateTime.now().minusDays(1))));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(LLM_RESPONSE));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID))
                .thenReturn(List.of(storedSuggestion(LocalDateTime.now())));

        service.getSuggestions(USER_ID, "en");

        verify(suggestionRepository).save(any(Suggestion.class));
    }

    @Test
    void regeneratesWhenStoredLanguageDiffersFromRequested() {
        // Invoices are older than the stored suggestion, so without the language
        // check no regeneration would happen — but the user switched to German.
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(LocalDateTime.now().minusDays(1))));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.of(storedSuggestion(LocalDateTime.now(), "en")));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(LLM_RESPONSE));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID))
                .thenReturn(List.of(storedSuggestion(LocalDateTime.now(), "de")));

        service.getSuggestions(USER_ID, "de");

        ArgumentCaptor<Suggestion> captor = ArgumentCaptor.forClass(Suggestion.class);
        verify(suggestionRepository).save(captor.capture());
        assertThat(captor.getValue().getLanguage()).isEqualTo("de");
    }

    @Test
    void fallsBackToStoredSuggestionsWhenLlmFails() {
        when(invoiceClient.fetchLatestInvoices(USER_ID, 5))
                .thenReturn(List.of(invoice(LocalDateTime.now())));
        when(suggestionRepository.findFirstByUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(Optional.of(storedSuggestion(LocalDateTime.now().minusDays(1))));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("LLM down"));
        when(suggestionRepository.findByUserIdOrderByIdAsc(USER_ID))
                .thenReturn(List.of(storedSuggestion(LocalDateTime.now().minusDays(1))));

        List<SuggestionResponse> result = service.getSuggestions(USER_ID, "en");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSuggestion()).isEqualTo("Stored suggestion");
        verify(suggestionRepository, never()).save(any());
    }
}
