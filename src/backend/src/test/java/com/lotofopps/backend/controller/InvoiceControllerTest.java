package com.lotofopps.backend.controller;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
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
    private JwtService jwtService;

    @Test
    void listInvoicesReturnsInvoiceResponseFields() throws Exception {
        Invoice invoice = new Invoice("Laptop", "Apple", new BigDecimal("1299.99"));
        when(invoiceRepository.findByUserId(anyString())).thenReturn(List.of(invoice));

        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemName").value("Laptop"))
                .andExpect(jsonPath("$[0].company").value("Apple"))
                .andExpect(jsonPath("$[0].price").value(1299.99))
                .andExpect(jsonPath("$[0].storagePath").doesNotExist());
    }

    @Test
    void listInvoicesAcceptsYearQueryParam() throws Exception {
        when(invoiceRepository.findByInvoiceDateYear(2023)).thenReturn(List.of());

        mockMvc.perform(get("/api/invoices").param("invoiceYear", "2023"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
