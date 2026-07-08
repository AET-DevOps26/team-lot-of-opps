package com.lotofopps.backend.config;

import com.lotofopps.backend.model.InvoiceStatus;
import com.lotofopps.backend.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Backfills the {@code status} column for invoices created before the review feature existed. Such
 * rows have a null status; we mark them {@link InvoiceStatus#ACCEPTED} so they keep showing in the
 * list. Runs once on startup and is a no-op afterwards.
 */
@Component
public class InvoiceStatusBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(InvoiceStatusBackfill.class);

    private final InvoiceRepository invoiceRepository;

    public InvoiceStatusBackfill(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    public void run(String... args) {
        int updated = invoiceRepository.markNullStatusAccepted(InvoiceStatus.ACCEPTED);
        if (updated > 0) {
            log.info("Backfilled {} invoice(s) with null status to ACCEPTED", updated);
        }
    }
}
