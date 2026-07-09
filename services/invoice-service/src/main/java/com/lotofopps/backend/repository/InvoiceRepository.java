package com.lotofopps.backend.repository;

import com.lotofopps.backend.model.Invoice;
import com.lotofopps.backend.model.InvoiceStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findByInvoiceDateYear(int invoiceYear);

    List<Invoice> findByUserId(String userId);

    List<Invoice> findByUserIdAndInvoiceDateYear(String userId, int invoiceYear);

    Page<Invoice> findByUserId(String userId, Pageable pageable);

    Page<Invoice> findByUserIdAndInvoiceDateYear(String userId, int invoiceYear, Pageable pageable);

    // Status-filtered variants used to keep PENDING (under review) invoices out of the
    // main list, chat context and tax suggestions until the user accepts them.
    Page<Invoice> findByUserIdAndStatus(String userId, InvoiceStatus status, Pageable pageable);

    Page<Invoice> findByUserIdAndStatusAndInvoiceDateYear(
            String userId, InvoiceStatus status, int invoiceYear, Pageable pageable);

    List<Invoice> findByDocumentId(Long documentId);

    List<Invoice> findTop5ByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * One-time startup backfill: legacy rows created before the {@code status} column existed have
     * a null status. Treat them as accepted so they stay visible. Idempotent.
     */
    @Modifying
    @Transactional
    @Query("update Invoice i set i.status = :status where i.status is null")
    int markNullStatusAccepted(@Param("status") InvoiceStatus status);
}
