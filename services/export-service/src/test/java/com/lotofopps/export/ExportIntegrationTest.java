package com.lotofopps.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestTemplate;

/**
 * Drives a whole export through the real controller, assembler and writers, stubbing only
 * invoice-service — the one boundary this service does not own.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ExportIntegrationTest {

    private static final String USER = "user-42";
    private static final String INVOICE_SERVICE = "http://localhost:9998";
    private static final String ROOT = "taxforward-export-2025/";

    /** Two line items extracted from the same uploaded receipt (document 7). */
    private static final String INVOICES_JSON =
            """
            [
              {"id":1,"itemName":"Laptop","company":"Media Markt","price":999.99,
               "category":"ARBEITSMITTEL","userId":"user-42","invoiceDate":"2025-03-04",
               "createdAt":"2025-03-05T10:00:00","documentId":7,"status":"ACCEPTED"},
              {"id":2,"itemName":"Maus","company":"Media Markt","price":400.51,
               "category":"ARBEITSMITTEL","userId":"user-42","invoiceDate":"2025-03-04",
               "createdAt":"2025-03-05T10:00:00","documentId":7,"status":"ACCEPTED"}
            ]
            """;

    private static final String DOCUMENTS_JSON =
            """
            [
              {"id":7,"filename":"rechnung media markt.pdf","contentType":"application/pdf",
               "sizeBytes":1234,"uploadedAt":"2025-03-05T09:59:00","userId":"user-42"},
              {"id":9,"filename":"unrelated.pdf","contentType":"application/pdf",
               "sizeBytes":10,"uploadedAt":"2025-01-01T00:00:00","userId":"user-42"}
            ]
            """;

    @Autowired private MockMvc mockMvc;

    @Autowired private RestTemplate restTemplate;

    private MockRestServiceServer invoiceService;

    @BeforeEach
    void stubInvoiceService() {
        invoiceService = MockRestServiceServer.bindTo(restTemplate).ignoreExpectOrder(true).build();

        invoiceService
                .expect(
                        requestTo(
                                INVOICE_SERVICE
                                        + "/api/v1/invoices?status=ACCEPTED&invoiceYear=2025"))
                .andExpect(header("X-User-Sub", USER))
                .andRespond(withSuccess(INVOICES_JSON, MediaType.APPLICATION_JSON));
        invoiceService
                .expect(requestTo(INVOICE_SERVICE + "/api/v1/documents"))
                .andExpect(header("X-User-Sub", USER))
                .andRespond(withSuccess(DOCUMENTS_JSON, MediaType.APPLICATION_JSON));
        invoiceService
                .expect(requestTo(INVOICE_SERVICE + "/api/v1/documents/7/content"))
                .andExpect(header("X-User-Sub", USER))
                .andRespond(withSuccess("%PDF-1.4 scanned receipt", MediaType.APPLICATION_PDF));
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
                        // Both invoices came from document 7, so the receipt is written once; the
                        // user's unreferenced document 9 stays out of this tax year's archive.
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

        invoiceService.verify();
    }

    @Test
    void servesThePdfOnItsOwnAsAnAttachment() throws Exception {
        MockHttpServletResponse response = download("/api/v1/exports/pdf");

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader("Content-Disposition"))
                .isEqualTo("attachment; filename=\"taxforward-export-2025.pdf\"");
        assertThat(pdfText(response.getContentAsByteArray())).contains("Werbungskosten 2025");
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
