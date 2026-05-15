package com.lotofopps.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GoogleAuthServiceTest {

    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private GoogleAuthService service;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        service = new GoogleAuthService(restTemplate);
    }

    @Test
    void verify_returnsUserInfoForValidToken() {
        mockServer.expect(requestTo(USERINFO_URL))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        """
                        {"sub":"sub-123","email":"alice@example.com","name":"Alice","picture":"https://pic.example.com"}
                        """,
                        MediaType.APPLICATION_JSON));

        GoogleAuthService.GoogleUserInfo info = service.verify("valid-access-token");

        assertThat(info.sub()).isEqualTo("sub-123");
        assertThat(info.email()).isEqualTo("alice@example.com");
        assertThat(info.name()).isEqualTo("Alice");
        assertThat(info.picture()).isEqualTo("https://pic.example.com");
        mockServer.verify();
    }

    @Test
    void verify_throwsUnauthorizedWhenSubMissing() {
        mockServer.expect(requestTo(USERINFO_URL))
                .andRespond(withSuccess(
                        """
                        {"email":"alice@example.com","name":"Alice"}
                        """,
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.verify("token"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void verify_throwsUnauthorizedWhenEmailMissing() {
        mockServer.expect(requestTo(USERINFO_URL))
                .andRespond(withSuccess(
                        """
                        {"sub":"sub-123","name":"Alice"}
                        """,
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.verify("token"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void verify_throwsUnauthorizedForNon2xxResponse() {
        mockServer.expect(requestTo(USERINFO_URL))
                .andRespond(withUnauthorizedRequest());

        assertThatThrownBy(() -> service.verify("expired-token"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void verify_throwsUnauthorizedOnNetworkError() {
        mockServer.expect(requestTo(USERINFO_URL))
                .andRespond(withException(new java.io.IOException("connection refused")));

        assertThatThrownBy(() -> service.verify("any-token"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }
}
