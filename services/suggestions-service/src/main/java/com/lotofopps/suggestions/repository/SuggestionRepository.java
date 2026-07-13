package com.lotofopps.suggestions.repository;

import com.lotofopps.suggestions.model.Suggestion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface SuggestionRepository extends JpaRepository<Suggestion, Long> {

    Optional<Suggestion> findFirstByUserIdOrderByCreatedAtDesc(String userId);

    // The user's current suggestion set, in the order it was generated.
    List<Suggestion> findByUserIdOrderByIdAsc(String userId);

    @Transactional
    void deleteByUserId(String userId);
}
