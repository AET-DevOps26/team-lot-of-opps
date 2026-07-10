package com.lotofopps.export.service;

import com.lotofopps.export.api.model.InvoiceCategory;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * German display names for the deduction categories, as they appear on Anlage N.
 *
 * <p>Keyed on the enum constant rather than its name: openapi-generator mangles the umlaut in
 * BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN into an underscore, so {@code name()} is not the wire value.
 */
@Component
public class CategoryLabels {

    private static final String UNCATEGORIZED = "Ohne Kategorie";

    private static final Map<InvoiceCategory, String> LABELS =
            Map.ofEntries(
                    Map.entry(InvoiceCategory.KONTOFUEHRUNGSGEBUEHREN, "Kontoführungsgebühren"),
                    Map.entry(InvoiceCategory.WEGE_ZUR_ARBEIT, "Wege zur Arbeit"),
                    Map.entry(
                            InvoiceCategory.HOMEOFFICE_UND_ARBEITSZIMMER,
                            "Homeoffice und Arbeitszimmer"),
                    Map.entry(InvoiceCategory.INTERNET_UND_TELEFON, "Internet und Telefon"),
                    Map.entry(InvoiceCategory.ARBEITSMITTEL, "Arbeitsmittel"),
                    Map.entry(
                            InvoiceCategory.BERUFSVERB_NDE_UND_GEWERKSCHAFTEN,
                            "Berufsverbände und Gewerkschaften"),
                    Map.entry(InvoiceCategory.STEUERBERATUNGSKOSTEN, "Steuerberatungskosten"),
                    Map.entry(InvoiceCategory.REISEKOSTEN, "Reisekosten"),
                    Map.entry(InvoiceCategory.BEWERBUNGEN, "Bewerbungen"),
                    Map.entry(InvoiceCategory.FORTBILDUNGEN, "Fortbildungen"),
                    Map.entry(InvoiceCategory.UMZUG, "Umzug"),
                    Map.entry(InvoiceCategory.BEWIRTUNG, "Bewirtung"),
                    Map.entry(InvoiceCategory.DOPPELTER_HAUSHALT, "Doppelter Haushalt"),
                    Map.entry(
                            InvoiceCategory.AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN,
                            "Außergewöhnliche Fahrzeugkosten"),
                    Map.entry(InvoiceCategory.SONSTIGE_AUSGABEN, "Sonstige Ausgaben"));

    public String labelFor(InvoiceCategory category) {
        return category == null
                ? UNCATEGORIZED
                : LABELS.getOrDefault(category, category.getValue());
    }
}
