package com.lotofopps.export.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lotofopps.export.api.model.DocumentResponse;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;

class ZipPackagerTest {

    private static final String ROOT = "taxforward-export-2025/";

    private final ZipPackager packager = new ZipPackager();

    @Test
    void packsTheSummaryRenderingsAndOneEntryPerReceipt() throws IOException {
        Map<Long, DocumentResponse> documents = Map.of(7L, document(7L, "hotel.pdf"));

        Map<String, byte[]> entries =
                unzip(
                        packager.pack(
                                export(),
                                documents,
                                pdf(),
                                csv(),
                                json(),
                                id -> "receipt".getBytes(UTF_8)));

        assertThat(entries.keySet())
                .containsExactlyInAnyOrder(
                        ROOT + "summary.pdf",
                        ROOT + "invoices.csv",
                        ROOT + "invoices.json",
                        ROOT + "README.txt",
                        ROOT + "receipts/7-hotel.pdf");
    }

    @Test
    void writesEachSharedReceiptOnlyOnce() throws IOException {
        // Two invoices extracted from document 7 must not produce two copies of the file.
        Map<Long, DocumentResponse> documents = Map.of(7L, document(7L, "hotel.pdf"));

        List<Long> loaded = new java.util.ArrayList<>();
        unzip(
                packager.pack(
                        export(),
                        documents,
                        pdf(),
                        csv(),
                        json(),
                        id -> {
                            loaded.add(id);
                            return "receipt".getBytes(UTF_8);
                        }));

        assertThat(loaded).containsExactly(7L);
    }

    @Test
    void keepsGoingWhenOneReceiptCannotBeRetrievedAndSaysSoInTheReadme() throws IOException {
        Map<Long, DocumentResponse> documents = new LinkedHashMap<>();
        documents.put(7L, document(7L, "hotel.pdf"));
        documents.put(8L, document(8L, "train.pdf"));

        Map<String, byte[]> entries =
                unzip(
                        packager.pack(
                                export(),
                                documents,
                                pdf(),
                                csv(),
                                json(),
                                id -> {
                                    if (id == 8L) {
                                        throw new IllegalStateException("gone");
                                    }
                                    return "receipt".getBytes(UTF_8);
                                }));

        assertThat(entries).containsKey(ROOT + "receipts/7-hotel.pdf");
        assertThat(entries).doesNotContainKey(ROOT + "receipts/8-train.pdf");
        assertThat(new String(entries.get(ROOT + "README.txt"), UTF_8))
                .contains("could not be retrieved")
                .contains("receipts/8-train.pdf");
    }

    @Test
    void neverLetsAnUploadedFilenameEscapeTheReceiptsDirectory() {
        assertThat(ZipPackager.safeFilename("../../etc/passwd")).isEqualTo("_.._etc_passwd");
        assertThat(ZipPackager.safeFilename("..")).isEqualTo("receipt");
        assertThat(ZipPackager.safeFilename("/absolute.pdf")).isEqualTo("_absolute.pdf");
        assertThat(ZipPackager.safeFilename(".hidden")).isEqualTo("hidden");
        assertThat(ZipPackager.safeFilename("")).isEqualTo("receipt");
        assertThat(ZipPackager.safeFilename(null)).isEqualTo("receipt");
    }

    @Test
    void distinctUploadsNeverCollapseOntoTheSameEntryName() {
        // Both sanitize to the same filename, so the document id must keep them apart.
        assertThat(ZipPackager.receiptPath(document(7L, "a b.pdf")))
                .isNotEqualTo(ZipPackager.receiptPath(document(8L, "a/b.pdf")));
    }

    @Test
    void truncatesAbsurdlyLongFilenames() {
        String name = "x".repeat(300) + ".pdf";

        assertThat(ZipPackager.safeFilename(name)).hasSize(100);
    }

    private static final java.nio.charset.Charset UTF_8 = StandardCharsets.UTF_8;

    private static TaxYearExport export() {
        ExportSummaryResponse summary = new ExportSummaryResponse().year(2025);
        return new TaxYearExport(2025, summary, List.of());
    }

    private static DocumentResponse document(Long id, String filename) {
        return new DocumentResponse().id(id).filename(filename);
    }

    private static byte[] pdf() {
        return "%PDF-1.4".getBytes(UTF_8);
    }

    private static byte[] csv() {
        return "id\r\n".getBytes(UTF_8);
    }

    private static byte[] json() {
        return "{}".getBytes(UTF_8);
    }

    private static Map<String, byte[]> unzip(byte[] archive) throws IOException {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive), UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), zip.readAllBytes());
            }
        }
        return entries;
    }
}
