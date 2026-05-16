package com.lotofopps.backend.config;

import com.lotofopps.backend.model.*;
import com.lotofopps.backend.repository.DocumentRepository;
import com.lotofopps.backend.repository.InvoiceRepository;
import com.lotofopps.backend.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Component
@Profile("dev")
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final InvoiceRepository invoiceRepository;

    public DataInitializer(UserRepository userRepository,
                           DocumentRepository documentRepository,
                           InvoiceRepository invoiceRepository) {
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.findByGoogleSub("mock-sub-001").isPresent()) {
            return;
        }

        User alice = createUser("mock-sub-001", "alice@example.com", "Alice Tester",
                "https://ui-avatars.com/api/?name=Alice+Tester");
        User bob = createUser("mock-sub-002", "bob@example.com", "Bob Demo",
                "https://ui-avatars.com/api/?name=Bob+Demo");

        seedForUser(alice.getGoogleSub(), "alice");
        seedForUser(bob.getGoogleSub(), "bob");
    }

    private User createUser(String googleSub, String email, String name, String picture) {
        User user = new User();
        user.setGoogleSub(googleSub);
        user.setEmail(email);
        user.setName(name);
        user.setPicture(picture);
        return userRepository.save(user);
    }

    private void seedForUser(String userId, String prefix) {
        List<Document> docs = List.of(
            doc(prefix + "_amazon_invoice_2025_01.pdf",   "application/pdf",  245_760L, userId),
            doc(prefix + "_telekom_rechnung_2025_02.pdf", "application/pdf",  189_440L, userId),
            doc(prefix + "_weWork_miete_2025_03.pdf",     "application/pdf",  302_080L, userId),
            doc(prefix + "_bahncard_2024_12.pdf",         "application/pdf",  128_000L, userId),
            doc(prefix + "_udemy_kurs_2025_01.pdf",       "application/pdf",   98_304L, userId),
            doc(prefix + "_ikea_buero_2025_02.jpg",       "image/jpeg",       512_000L, userId),
            doc(prefix + "_steuerberater_2024_11.jpg",    "image/jpeg",       409_600L, userId),
            doc(prefix + "_tankquittung_2025_03.jpg",     "image/jpeg",       204_800L, userId),
            doc(prefix + "_kontoauszug_2025_01.png",      "image/png",        358_400L, userId),
            doc(prefix + "_bewerbungskosten_2024_10.png", "image/png",        276_480L, userId)
        );
        List<Document> savedDocs = documentRepository.saveAll(docs);

        List<Invoice> invoices = List.of(
            invoice("USB-C Hub",               "Amazon",             "34.99",  InvoiceCategory.ARBEITSMITTEL,                       userId, LocalDate.of(2025, 1, 8),  savedDocs.get(0)),
            invoice("Mobilfunk Flatrate",       "Telekom",            "29.99",  InvoiceCategory.INTERNET_UND_TELEFON,                userId, LocalDate.of(2025, 2, 1),  savedDocs.get(1)),
            invoice("Coworking Space März",    "WeWork",             "250.00", InvoiceCategory.HOMEOFFICE_UND_ARBEITSZIMMER,        userId, LocalDate.of(2025, 3, 1),  savedDocs.get(2)),
            invoice("BahnCard 50",             "Deutsche Bahn",      "244.00", InvoiceCategory.WEGE_ZUR_ARBEIT,                    userId, LocalDate.of(2024, 12, 5), savedDocs.get(3)),
            invoice("Python Bootcamp",         "Udemy",              "14.99",  InvoiceCategory.FORTBILDUNGEN,                      userId, LocalDate.of(2025, 1, 15), savedDocs.get(4)),
            invoice("Schreibtischstuhl",       "IKEA",               "199.00", InvoiceCategory.ARBEITSMITTEL,                       userId, LocalDate.of(2025, 2, 20), savedDocs.get(5)),
            invoice("Steuerberatung 2024",     "DATEV Partner GmbH", "320.00", InvoiceCategory.STEUERBERATUNGSKOSTEN,              userId, LocalDate.of(2024, 11, 3), savedDocs.get(6)),
            invoice("Tankfüllung Dienstreise", "Shell",              "68.40",  InvoiceCategory.REISEKOSTEN,                        userId, LocalDate.of(2025, 3, 12), savedDocs.get(7)),
            invoice("Kontoführungsgebühr",     "Sparkasse",          "8.50",   InvoiceCategory.KONTOFUEHRUNGSGEBUEHREN,             userId, LocalDate.of(2025, 1, 31), savedDocs.get(8)),
            invoice("Bewerbungsmappe",         "Staples",            "12.99",  InvoiceCategory.BEWERBUNGEN,                        userId, LocalDate.of(2024, 10, 4), savedDocs.get(9)),
            invoice("Monitor 27\"",            "MediaMarkt",         "349.00", InvoiceCategory.ARBEITSMITTEL,                       userId, LocalDate.of(2025, 1, 22), null),
            invoice("Gewerkschaftsbeitrag",    "ver.di",             "22.50",  InvoiceCategory.BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN,  userId, LocalDate.of(2025, 2, 1),  null),
            invoice("Fachliteratur Java",      "O'Reilly",           "49.90",  InvoiceCategory.FORTBILDUNGEN,                      userId, LocalDate.of(2024, 12, 18), null),
            invoice("Geschäftsessen",          "Vapiano",            "87.60",  InvoiceCategory.BEWIRTUNG,                          userId, LocalDate.of(2025, 3, 5),  null),
            invoice("Heimfahrt Umzug",        "Umzug Express",      "480.00", InvoiceCategory.UMZUG,                              userId, LocalDate.of(2025, 2, 14), null)
        );
        invoiceRepository.saveAll(invoices);
    }

    private Document doc(String filename, String contentType, long sizeBytes, String userId) {
        Document d = new Document(filename, contentType, sizeBytes, "/mock/" + userId + "/" + filename);
        d.setUserId(userId);
        return d;
    }

    private Invoice invoice(String itemName, String company, String price,
                            InvoiceCategory category, String userId,
                            LocalDate date, Document document) {
        Invoice inv = new Invoice(itemName, company, new BigDecimal(price));
        inv.setCategory(category);
        inv.setUserId(userId);
        inv.setInvoiceDate(date);
        inv.setDocument(document);
        return inv;
    }
}
