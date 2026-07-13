package com.lotofopps.export.controller;

import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.service.ExportService;
import io.grpc.StatusRuntimeException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Year;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/exports")
@Tag(name = "Exports")
public class ExportController {

    private static final Logger log = LoggerFactory.getLogger(ExportController.class);

    /** German income tax as this app models it did not exist before 2000. */
    private static final int EARLIEST_YEAR = 2000;

    private static final MediaType TEXT_CSV = new MediaType("text", "csv");

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    private static String currentUserId(HttpServletRequest request) {
        return request.getHeader("X-User-Sub");
    }

    @GetMapping("/years")
    @Operation(
            summary = "Tax years the user has accepted invoices for",
            responses = {
                @ApiResponse(responseCode = "200", description = "Years, most recent first"),
                @ApiResponse(responseCode = "401", description = "Unauthorized")
            })
    public ResponseEntity<List<Integer>> listYears(HttpServletRequest request) {
        String userId = currentUserId(request);
        if (isBlank(userId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(exportService.availableYears(userId));
    }

    @GetMapping("/summary")
    @Operation(
            summary = "Per-category totals for one tax year",
            responses = {
                @ApiResponse(responseCode = "200", description = "Summary figures"),
                @ApiResponse(responseCode = "400", description = "Year out of range"),
                @ApiResponse(responseCode = "401", description = "Unauthorized")
            })
    public ResponseEntity<ExportSummaryResponse> summary(
            @RequestParam int year, HttpServletRequest request) {
        String userId = currentUserId(request);
        if (isBlank(userId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!isPlausibleYear(year)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(exportService.summary(userId, year));
    }

    @GetMapping("/csv")
    @Operation(
            summary = "Download the year's accepted invoices as CSV",
            responses = {
                @ApiResponse(responseCode = "200", description = "CSV file"),
                @ApiResponse(responseCode = "400", description = "Year out of range"),
                @ApiResponse(responseCode = "401", description = "Unauthorized")
            })
    public ResponseEntity<byte[]> csv(@RequestParam int year, HttpServletRequest request) {
        return download(request, year, TEXT_CSV, "csv", exportService::csv);
    }

    @GetMapping("/pdf")
    @Operation(
            summary = "Download the year's Werbungskosten summary as PDF",
            responses = {
                @ApiResponse(responseCode = "200", description = "PDF file"),
                @ApiResponse(responseCode = "400", description = "Year out of range"),
                @ApiResponse(responseCode = "401", description = "Unauthorized")
            })
    public ResponseEntity<byte[]> pdf(@RequestParam int year, HttpServletRequest request) {
        return download(request, year, MediaType.APPLICATION_PDF, "pdf", exportService::pdf);
    }

    @GetMapping("/zip")
    @Operation(
            summary = "Download the complete tax-year package as a ZIP archive",
            responses = {
                @ApiResponse(responseCode = "200", description = "ZIP archive"),
                @ApiResponse(responseCode = "400", description = "Year out of range"),
                @ApiResponse(responseCode = "401", description = "Unauthorized")
            })
    public ResponseEntity<byte[]> zip(@RequestParam int year, HttpServletRequest request) {
        return download(
                request, year, MediaType.valueOf("application/zip"), "zip", exportService::zip);
    }

    @FunctionalInterface
    private interface Renderer {
        byte[] render(String userId, int year);
    }

    private ResponseEntity<byte[]> download(
            HttpServletRequest request,
            int year,
            MediaType contentType,
            String extension,
            Renderer renderer) {
        String userId = currentUserId(request);
        if (isBlank(userId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!isPlausibleYear(year)) {
            return ResponseEntity.badRequest().build();
        }
        byte[] body = renderer.render(userId, year);
        ContentDisposition disposition =
                ContentDisposition.attachment()
                        .filename("taxforward-export-" + year + "." + extension)
                        .build();
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(body);
    }

    /**
     * invoice-service is the only source of export data, so when it is unreachable the export does
     * not exist yet rather than being empty — an empty CSV would look like a legitimate "no
     * receipts this year" answer.
     */
    @ExceptionHandler(StatusRuntimeException.class)
    public ResponseEntity<Map<String, String>> handleInvoiceServiceFailure(
            StatusRuntimeException e) {
        log.error("invoice-service unavailable while building an export", e);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("error", "Could not reach invoice-service to build the export"));
    }

    private static boolean isPlausibleYear(int year) {
        return year >= EARLIEST_YEAR && year <= Year.now().getValue() + 1;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
