package com.lotofopps.backend.service;

import com.lotofopps.backend.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-must-be-32-chars!!";
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 86_400_000L);
    }

    private User testUser() {
        User user = new User();
        user.setGoogleSub("sub-123");
        user.setEmail("alice@example.com");
        user.setName("Alice");
        user.setPicture("https://pic.example.com/alice.jpg");
        return user;
    }

    @Test
    void generateToken_includesCorrectClaims() {
        String token = jwtService.generateToken(testUser());
        Claims claims = jwtService.validateToken(token);

        assertThat(claims.getSubject()).isEqualTo("sub-123");
        assertThat(claims.get("email", String.class)).isEqualTo("alice@example.com");
        assertThat(claims.get("name", String.class)).isEqualTo("Alice");
        assertThat(claims.get("picture", String.class)).isEqualTo("https://pic.example.com/alice.jpg");
    }

    @Test
    void validateToken_returnsClaimsForValidToken() {
        String token = jwtService.generateToken(testUser());
        Claims claims = jwtService.validateToken(token);
        assertThat(claims.getSubject()).isEqualTo("sub-123");
    }

    @Test
    void validateToken_throwsForExpiredToken() {
        JwtService shortLived = new JwtService(SECRET, -1000L);
        String token = shortLived.generateToken(testUser());

        assertThatThrownBy(() -> jwtService.validateToken(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void validateToken_throwsForTamperedToken() {
        String token = jwtService.generateToken(testUser());
        String tampered = token.substring(0, token.length() - 4) + "XXXX";

        assertThatThrownBy(() -> jwtService.validateToken(tampered))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void validateToken_throwsForWrongKey() {
        String token = jwtService.generateToken(testUser());
        JwtService otherKey = new JwtService("different-secret-key-32-chars-ok!", 86_400_000L);

        assertThatThrownBy(() -> otherKey.validateToken(token))
                .isInstanceOf(JwtException.class);
    }
}
