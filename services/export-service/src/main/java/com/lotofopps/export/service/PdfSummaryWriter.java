package com.lotofopps.export.service;

import com.lotofopps.export.api.model.ExportCategoryTotal;
import com.lotofopps.export.api.model.ExportSummaryResponse;
import com.lotofopps.export.api.model.InvoiceResponse;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Renders the Werbungskosten summary sheet — the page a user hands to the Finanzamt or their
 * Steuerberater alongside the receipts.
 *
 * <p>German-only by design: it is a German tax document, and its category names are the line items
 * of Anlage N. The surrounding UI stays bilingual.
 *
 * <p>Every font is WinAnsi-encoded so the umlauts in BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN and the euro
 * sign survive; the PDF base-14 default encoding would drop them.
 */
@Component
public class PdfSummaryWriter {

    private static final DateTimeFormatter GERMAN_DATE =
            DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale.GERMANY);

    private static final Font TITLE = font(18, Font.BOLD);
    private static final Font HEADING = font(12, Font.BOLD);
    private static final Font TABLE_HEADER = font(9, Font.BOLD);
    private static final Font BODY = font(9, Font.NORMAL);
    private static final Font MUTED = font(8, Font.ITALIC);

    private final CategoryLabels labels;

    public PdfSummaryWriter(CategoryLabels labels) {
        this.labels = labels;
    }

    public byte[] render(TaxYearExport export) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document pdf = new Document(PageSize.A4, 48, 48, 48, 48);
        try {
            PdfWriter.getInstance(pdf, out);
            pdf.open();
            writeHeader(pdf, export.summary());
            writeCategoryTable(pdf, export.summary());
            writeTotals(pdf, export.summary());
            writeInvoiceTable(pdf, export);
            writeDisclaimer(pdf);
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to render the PDF summary", e);
        } finally {
            pdf.close();
        }
        return out.toByteArray();
    }

    private void writeHeader(Document pdf, ExportSummaryResponse summary) throws DocumentException {
        pdf.add(paragraph("Werbungskosten " + summary.getYear(), TITLE, 4));
        pdf.add(
                paragraph(
                        "TaxForward — Aufstellung der erfassten Belege, erstellt am "
                                + LocalDate.now().format(GERMAN_DATE),
                        MUTED,
                        18));
    }

    private void writeCategoryTable(Document pdf, ExportSummaryResponse summary)
            throws DocumentException {
        pdf.add(paragraph("Zusammenfassung nach Kategorie", HEADING, 8));

        PdfPTable table = table(new float[] {5, 1.4f, 2});
        headerCells(table, "Kategorie", "Belege", "Betrag");
        for (ExportCategoryTotal category : summary.getCategories()) {
            table.addCell(bodyCell(labels.labelFor(category.getCategory()), Element.ALIGN_LEFT));
            table.addCell(
                    bodyCell(String.valueOf(category.getInvoiceCount()), Element.ALIGN_RIGHT));
            table.addCell(bodyCell(euro(category.getTotal()), Element.ALIGN_RIGHT));
        }
        pdf.add(table);
    }

    private void writeTotals(Document pdf, ExportSummaryResponse summary) throws DocumentException {
        PdfPTable table = table(new float[] {5, 3.4f});
        table.setSpacingBefore(14);

        totalsRow(table, "Summe der Werbungskosten", euro(summary.getTotalExpenses()), BODY);
        totalsRow(
                table,
                "abzüglich Arbeitnehmer-Pauschbetrag " + summary.getYear(),
                "- " + euro(summary.getLumpSumAllowance()),
                BODY);
        totalsRow(
                table,
                "zusätzlich absetzbar über dem Pauschbetrag",
                euro(summary.getDeductibleAboveLumpSum()),
                HEADING);

        pdf.add(table);
    }

    private void writeInvoiceTable(Document pdf, TaxYearExport export) throws DocumentException {
        pdf.add(paragraph("Einzelbelege", HEADING, 8));
        if (export.invoices().isEmpty()) {
            pdf.add(paragraph("Keine Belege für dieses Steuerjahr erfasst.", BODY, 0));
            return;
        }

        PdfPTable table = table(new float[] {1.6f, 3.4f, 2.6f, 3.2f, 1.6f, 1.4f});
        headerCells(table, "Datum", "Position", "Anbieter", "Kategorie", "Betrag", "Beleg");
        for (InvoiceResponse invoice : export.invoices()) {
            table.addCell(bodyCell(date(invoice.getInvoiceDate()), Element.ALIGN_LEFT));
            table.addCell(bodyCell(text(invoice.getItemName()), Element.ALIGN_LEFT));
            table.addCell(bodyCell(text(invoice.getCompany()), Element.ALIGN_LEFT));
            table.addCell(bodyCell(labels.labelFor(invoice.getCategory()), Element.ALIGN_LEFT));
            table.addCell(bodyCell(euro(invoice.getPrice()), Element.ALIGN_RIGHT));
            // Matches the receipts/<documentId>-* files in the ZIP export.
            table.addCell(bodyCell(text(invoice.getDocumentId()), Element.ALIGN_RIGHT));
        }
        pdf.add(table);
    }

    private void writeDisclaimer(Document pdf) throws DocumentException {
        Paragraph disclaimer =
                paragraph(
                        "Diese Aufstellung wurde automatisch aus den von dir hochgeladenen und "
                                + "bestätigten Belegen erzeugt. Sie ist keine Steuerberatung. Der "
                                + "Arbeitnehmer-Pauschbetrag ist gesetzlich festgelegt — bitte prüfe "
                                + "den Wert für das jeweilige Steuerjahr.",
                        MUTED,
                        0);
        disclaimer.setSpacingBefore(20);
        pdf.add(disclaimer);
    }

    private static PdfPTable table(float[] widths) throws DocumentException {
        PdfPTable table = new PdfPTable(widths.length);
        table.setWidths(widths);
        table.setWidthPercentage(100);
        table.setSpacingBefore(4);
        return table;
    }

    private static void headerCells(PdfPTable table, String... titles) {
        for (int i = 0; i < titles.length; i++) {
            PdfPCell cell = new PdfPCell(new Phrase(titles[i], TABLE_HEADER));
            cell.setHorizontalAlignment(i == 0 ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT);
            cell.setPaddingBottom(5);
            cell.setPaddingTop(3);
            table.addCell(cell);
        }
        table.setHeaderRows(1);
    }

    private static PdfPCell bodyCell(String content, int alignment) {
        PdfPCell cell = new PdfPCell(new Phrase(content, BODY));
        cell.setHorizontalAlignment(alignment);
        cell.setPaddingBottom(4);
        cell.setPaddingTop(2);
        return cell;
    }

    private static void totalsRow(PdfPTable table, String label, String amount, Font font) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setHorizontalAlignment(Element.ALIGN_LEFT);
        labelCell.setPaddingBottom(4);
        PdfPCell amountCell = new PdfPCell(new Phrase(amount, font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        amountCell.setPaddingBottom(4);
        table.addCell(labelCell);
        table.addCell(amountCell);
    }

    private static Paragraph paragraph(String content, Font font, float spacingAfter) {
        Paragraph paragraph = new Paragraph(content, font);
        paragraph.setSpacingAfter(spacingAfter);
        return paragraph;
    }

    private static Font font(float size, int style) {
        return FontFactory.getFont(FontFactory.HELVETICA, BaseFont.WINANSI, size, style);
    }

    private static String euro(BigDecimal amount) {
        return String.format(Locale.GERMANY, "%,.2f €", amount == null ? BigDecimal.ZERO : amount);
    }

    private static String date(LocalDate date) {
        return date == null ? "—" : date.format(GERMAN_DATE);
    }

    private static String text(Object value) {
        return Objects.toString(value, "—");
    }
}
