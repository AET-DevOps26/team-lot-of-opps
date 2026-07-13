package com.lotofopps.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Pageable;

/**
 * Exercises the repository against a real database.
 *
 * <p>The controller tests mock this repository, so a query that parses but cannot be translated to
 * SQL passes them and still 500s in production — which is exactly what happened to the {@code
 * invoiceYear} filter.
 */
@SpringBootTest
class InvoiceRepositoryTest {

    private static final String USER = "user-1";

    @Autowired private InvoiceRepository invoiceRepository;

    @BeforeEach
    void resetInvoices() {
        invoiceRepository.deleteAll();
    }

    @Test
    void findsOnlyTheAcceptedInvoicesOfTheGivenUserAndYear() {
        Invoice wanted = save(USER, InvoiceStatus.ACCEPTED, LocalDate.of(2025, 3, 4));
        save(USER, InvoiceStatus.ACCEPTED, LocalDate.of(2024, 12, 31));
        save(USER, InvoiceStatus.PENDING, LocalDate.of(2025, 5, 6));
        save("someone-else", InvoiceStatus.ACCEPTED, LocalDate.of(2025, 7, 8));

        List<Invoice> found =
                invoiceRepository
                        .findByUserIdAndStatusAndInvoiceDateYear(
                                USER, InvoiceStatus.ACCEPTED, 2025, Pageable.unpaged())
                        .getContent();

        assertThat(found).extracting(Invoice::getId).containsExactly(wanted.getId());
    }

    @Test
    void excludesUndatedInvoicesBecauseTheyBelongToNoTaxYear() {
        save(USER, InvoiceStatus.ACCEPTED, null);

        assertThat(
                        invoiceRepository.findByUserIdAndStatusAndInvoiceDateYear(
                                USER, InvoiceStatus.ACCEPTED, 2025, Pageable.unpaged()))
                .isEmpty();
    }

    @Test
    void matchesTheYearAtBothBoundaries() {
        save(USER, InvoiceStatus.ACCEPTED, LocalDate.of(2025, 1, 1));
        save(USER, InvoiceStatus.ACCEPTED, LocalDate.of(2025, 12, 31));

        assertThat(
                        invoiceRepository.findByUserIdAndStatusAndInvoiceDateYear(
                                USER, InvoiceStatus.ACCEPTED, 2025, Pageable.unpaged()))
                .hasSize(2);
    }

    private Invoice save(String userId, InvoiceStatus status, LocalDate invoiceDate) {
        Invoice invoice = new Invoice("item", "company", new BigDecimal("10.00"));
        invoice.setUserId(userId);
        invoice.setStatus(status);
        invoice.setInvoiceDate(invoiceDate);
        return invoiceRepository.save(invoice);
    }
}
