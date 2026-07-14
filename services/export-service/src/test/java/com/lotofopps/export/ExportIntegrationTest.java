package com.lotofopps.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.google.protobuf.ByteString;
import com.lotofopps.backend.grpc.GetDocumentContentRequest;
import com.lotofopps.backend.grpc.GetDocumentContentResponse;
import com.lotofopps.backend.grpc.GetDocumentsRequest;
import com.lotofopps.backend.grpc.GetDocumentsResponse;
import com.lotofopps.backend.grpc.GetLatestInvoicesRequest;
import com.lotofopps.backend.grpc.GetLatestInvoicesResponse;
import com.lotofopps.backend.grpc.InternalInvoiceServiceGrpc;
import com.lotofopps.backend.grpc.Invoice;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Drives a whole export through the real controller, assembler, client mapping and writers,
 * stubbing only invoice-service's gRPC stub — the one boundary this service does not own. The proto
 * requests are matched exactly, so a wrong user id, year or document id fails the test.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ExportIntegrationTest {

    private static final String USER = "user-42";
    private static final String ROOT = "taxforward-export-2025/";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub;

    @BeforeEach
    void stubInvoiceService() {
        // The client re-derives a per-call deadline; the mock must return itself for the chain.
        when(invoiceStub.withDeadlineAfter(anyLong(), any())).thenReturn(invoiceStub);

        // Two line items extracted from the same uploaded receipt (document 7).
        when(invoiceStub.getLatestInvoices(
                        GetLatestInvoicesRequest.newBuilder()
                                .setUserId(USER)
                                .setInvoiceYear(2025)
                                .build()))
                .thenReturn(
                        GetLatestInvoicesResponse.newBuilder()
                                .addInvoices(invoice(1, "Laptop", "999.99"))
                                .addInvoices(invoice(2, "Maus", "400.51"))
                                .build());

        // Asked for exactly the referenced document; the server owns the ownership filter.
        when(invoiceStub.getDocuments(
                        GetDocumentsRequest.newBuilder()
                                .setUserId(USER)
                                .addDocumentIds(7L)
                                .build()))
                .thenReturn(
                        GetDocumentsResponse.newBuilder()
                                .addDocuments(
                                        com.lotofopps.backend.grpc.Document.newBuilder()
                                                .setId(7L)
                                                .setFilename("rechnung media markt.pdf")
                                                .setContentType("application/pdf")
                                                .setSizeBytes(1234)
                                                .setUploadedAt("2025-03-05T09:59:00")
                                                .setUserId(USER))
                                .build());

        when(invoiceStub.getDocumentContent(
                        GetDocumentContentRequest.newBuilder()
                                .setUserId(USER)
                                .setDocumentId(7L)
                                .build()))
                .thenReturn(
                        GetDocumentContentResponse.newBuilder()
                                .setContent(ByteString.copyFromUtf8("%PDF-1.4 scanned receipt"))
                                .build());
    }

    @Test
    void buildsAZipHoldingTheSummaryTheRenderingsAndOneCopyOfTheSharedReceipt() throws Exception {
        MockHttpServletResponse response = download("/api/v1/exports/zip");

        assertThat(response.getStatus()).isEqualTo(200);
        Map<String, byte[]> entries = unzip(response.getContentAsByteArray());

        assertThat(entries.keySet())
                .containsExactlyInAnyOrder(
                        ROOT + "summary.pdf",
                        ROOT + "invoices.csv",
                        ROOT + "invoices.json",
                        ROOT + "README.txt",
                        // Both invoices came from document 7, so the receipt is written once.
                        ROOT + "receipts/7-rechnung_media_markt.pdf");

        // 999.99 + 400.51 = 1400.50, minus the 2025 allowance of 1230.00.
        assertThat(pdfText(entries.get(ROOT + "summary.pdf")))
                .contains("Werbungskosten 2025")
                .contains("1.400,50")
                .contains("170,50")
                .contains("Arbeitsmittel");

        assertThat(new String(entries.get(ROOT + "invoices.csv"), StandardCharsets.UTF_8))
                .startsWith("\uFEFFid,invoiceDate")
                .contains("1,2025-03-04,Laptop,Media Markt,ARBEITSMITTEL,999.99,7,");

        assertThat(new String(entries.get(ROOT + "invoices.json"), StandardCharsets.UTF_8))
                .contains("\"deductibleAboveLumpSum\" : 170.50")
                .contains("\"itemName\" : \"Laptop\"");
    }

    @Test
    void servesThePdfOnItsOwnAsAnAttachment() throws Exception {
        MockHttpServletResponse response = download("/api/v1/exports/pdf");

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader("Content-Disposition"))
                .isEqualTo("attachment; filename=\"taxforward-export-2025.pdf\"");
        assertThat(pdfText(response.getContentAsByteArray())).contains("Werbungskosten 2025");
    }

    private static Invoice invoice(long id, String itemName, String price) {
        return Invoice.newBuilder()
                .setId(id)
                .setItemName(itemName)
                .setCompany("Media Markt")
                .setPrice(price)
                .setCategory("ARBEITSMITTEL")
                .setUserId(USER)
                .setInvoiceDate("2025-03-04")
                .setCreatedAt("2025-03-05T10:00:00")
                .setDocumentId(7L)
                .setStatus("ACCEPTED")
                .build();
    }

    private MockHttpServletResponse download(String path) throws Exception {
        return mockMvc.perform(get(path).param("year", "2025").header("X-User-Sub", USER))
                .andReturn()
                .getResponse();
    }

    private static String pdfText(byte[] pdf) throws IOException {
        PdfReader reader = new PdfReader(pdf);
        try {
            return new PdfTextExtractor(reader).getTextFromPage(1);
        } finally {
            reader.close();
        }
    }

    private static Map<String, byte[]> unzip(byte[] archive) throws IOException {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zip =
                new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), zip.readAllBytes());
            }
        }
        return entries;
    }
}
