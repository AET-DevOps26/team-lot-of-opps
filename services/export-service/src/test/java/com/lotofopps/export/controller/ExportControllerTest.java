package com.lotofopps.export.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lotofopps.export.api.model.ExportCategoryTotal;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceCategory;
import com.lotofopps.export.service.ExportService;
import java.math.BigDecimal;
import java.time.Year;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClientException;

@WebMvcTest(ExportController.class)
class ExportControllerTest {

    private static final String USER = "test-user";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private ExportService exportService;

    @Test
    void listsTheYearsTheUserHasInvoicesFor() throws Exception {
        when(exportService.availableYears(USER)).thenReturn(List.of(2025, 2024));

        mockMvc.perform(get("/api/v1/exports/years").header("X-User-Sub", USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value(2025))
                .andExpect(jsonPath("$[1]").value(2024));
    }

    @Test
    void returnsTheSummaryFigures() throws Exception {
        when(exportService.summary(USER, 2025))
                .thenReturn(
                        new ExportSummaryResponse()
                                .year(2025)
                                .invoiceCount(2)
                                .totalExpenses(new BigDecimal("1400.50"))
                                .lumpSumAllowance(new BigDecimal("1230.00"))
                                .deductibleAboveLumpSum(new BigDecimal("170.50"))
                                .categories(
                                        List.of(
                                                new ExportCategoryTotal()
                                                        .category(InvoiceCategory.ARBEITSMITTEL)
                                                        .invoiceCount(1)
                                                        .total(new BigDecimal("999.99")))));

        mockMvc.perform(
                        get("/api/v1/exports/summary")
                                .param("year", "2025")
                                .header("X-User-Sub", USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2025))
                .andExpect(jsonPath("$.deductibleAboveLumpSum").value(170.50))
                .andExpect(jsonPath("$.categories[0].category").value("ARBEITSMITTEL"));
    }

    @Test
    void servesTheCsvAsADownloadableAttachment() throws Exception {
        when(exportService.csv(USER, 2025)).thenReturn("id\r\n".getBytes());

        mockMvc.perform(get("/api/v1/exports/csv").param("year", "2025").header("X-User-Sub", USER))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/csv"))
                .andExpect(
                        header().string(
                                        "Content-Disposition",
                                        "attachment; filename=\"taxforward-export-2025.csv\""));
    }

    @Test
    void servesThePdfAsADownloadableAttachment() throws Exception {
        when(exportService.pdf(USER, 2025)).thenReturn("%PDF".getBytes());

        mockMvc.perform(get("/api/v1/exports/pdf").param("year", "2025").header("X-User-Sub", USER))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(
                        header().string(
                                        "Content-Disposition",
                                        "attachment; filename=\"taxforward-export-2025.pdf\""));
    }

    @Test
    void servesTheZipAsADownloadableAttachment() throws Exception {
        when(exportService.zip(USER, 2025)).thenReturn(new byte[] {0x50, 0x4B});

        mockMvc.perform(get("/api/v1/exports/zip").param("year", "2025").header("X-User-Sub", USER))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/zip"))
                .andExpect(
                        header().string(
                                        "Content-Disposition",
                                        "attachment; filename=\"taxforward-export-2025.zip\""));
    }

    @Test
    void rejectsEveryExportWithoutTheGatewayResolvedUserHeader() throws Exception {
        mockMvc.perform(get("/api/v1/exports/years")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/exports/summary").param("year", "2025"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/exports/csv").param("year", "2025"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/exports/pdf").param("year", "2025"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/exports/zip").param("year", "2025"))
                .andExpect(status().isUnauthorized());

        verify(exportService, never()).csv(anyString(), anyInt());
        verify(exportService, never()).pdf(anyString(), anyInt());
        verify(exportService, never()).zip(anyString(), anyInt());
        verify(exportService, never()).summary(anyString(), anyInt());
        verify(exportService, never()).availableYears(anyString());
    }

    @Test
    void rejectsYearsOutsideThePlausibleRange() throws Exception {
        mockMvc.perform(get("/api/v1/exports/zip").param("year", "1999").header("X-User-Sub", USER))
                .andExpect(status().isBadRequest());

        int tooFarAhead = Year.now().getValue() + 2;
        mockMvc.perform(
                        get("/api/v1/exports/pdf")
                                .param("year", String.valueOf(tooFarAhead))
                                .header("X-User-Sub", USER))
                .andExpect(status().isBadRequest());

        verify(exportService, never()).zip(anyString(), anyInt());
        verify(exportService, never()).pdf(anyString(), anyInt());
    }

    @Test
    void reportsABadGatewayRatherThanAnEmptyExportWhenInvoiceServiceIsDown() throws Exception {
        when(exportService.zip(USER, 2025))
                .thenThrow(new RestClientException("connection refused"));

        mockMvc.perform(get("/api/v1/exports/zip").param("year", "2025").header("X-User-Sub", USER))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").exists());
    }
}
