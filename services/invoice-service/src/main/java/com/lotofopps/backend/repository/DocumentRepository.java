package com.lotofopps.backend.repository;

import com.lotofopps.backend.model.Document;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByContentType(String contentType);

    List<Document> findByFilenameContainingIgnoreCase(String filename);

    List<Document> findByUserId(String userId);

    Optional<Document> findByContentHashAndUserId(String contentHash, String userId);
}
