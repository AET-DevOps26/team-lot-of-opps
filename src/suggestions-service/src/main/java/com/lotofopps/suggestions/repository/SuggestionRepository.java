package com.lotofopps.suggestions.repository;

import com.lotofopps.suggestions.model.Suggestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SuggestionRepository extends JpaRepository<Suggestion, Long> {

    Optional<Suggestion> findFirstByUserIdOrderByCreatedAtDesc(String userId);

    List<Suggestion> findTop5ByUserIdOrderByCreatedAtDesc(String userId);
}
