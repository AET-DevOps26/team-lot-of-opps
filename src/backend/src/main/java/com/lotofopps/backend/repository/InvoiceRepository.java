package com.lotofopps.backend.repository;

import com.lotofopps.backend.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findByInvoiceDateYear(int invoiceYear);

    List<Invoice> findByUserId(String userId);

    List<Invoice> findByUserIdAndInvoiceDateYear(String userId, int invoiceYear);

    Page<Invoice> findByUserId(String userId, Pageable pageable);

    Page<Invoice> findByUserIdAndInvoiceDateYear(String userId, int invoiceYear, Pageable pageable);

    List<Invoice> findByDocumentId(Long documentId);
}
