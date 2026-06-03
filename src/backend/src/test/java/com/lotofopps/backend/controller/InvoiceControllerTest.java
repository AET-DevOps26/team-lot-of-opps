package com.lotofopps.backend.controller;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.AiBackendService;
import com.lotofopps.backend.service.DocumentStorageService;
import com.lotofopps.backend.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InvoiceController.class)
@WithMockUser
class InvoiceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InvoiceRepository invoiceRepository;

    @MockitoBean
    private DocumentRepository documentRepository;

    @MockitoBean
    private AiBackendService aiBackendService;

    @MockitoBean
    private DocumentStorageService documentStorageService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void listInvoicesReturnsInvoiceResponseFields() throws Exception {
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));
        when(invoiceRepository.findByUserId(anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(invoice)));

        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemName").value("Laptop"))
                .andExpect(jsonPath("$[0].company").value("Apple"))
                .andExpect(jsonPath("$[0].price").value(1299.99))
                .andExpect(jsonPath("$[0].storagePath").doesNotExist());
    }

    @Test
    void listInvoicesAcceptsYearQueryParam() throws Exception {
        when(invoiceRepository.findByUserIdAndInvoiceDateYear(anyString(), anyInt(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/invoices").param("invoiceYear", "2023"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void listInvoicesRespectsLimitParam() throws Exception {
        when(invoiceRepository.findByUserId(anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/invoices").param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void deleteInvoiceReturns204WhenOwned() throws Exception {
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));
        ReflectionTestUtils.setField(invoice, "id", 1L);
        invoice.setUserId("user");
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        mockMvc.perform(delete("/api/invoices/1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteInvoiceReturns404WhenNotFound() throws Exception {
        when(invoiceRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/invoices/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteInvoiceReturns403WhenNotOwner() throws Exception {
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));
        ReflectionTestUtils.setField(invoice, "id", 1L);
        invoice.setUserId("other-user");
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

        mockMvc.perform(delete("/api/invoices/1"))
                .andExpect(status().isForbidden());
    }
}
