package com.lotofopps.backend.service;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class GoogleAuthService {

    public record GoogleUserInfo(String sub, String email, String name, String picture) {}

    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
    private final RestTemplate restTemplate;

    public GoogleAuthService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public GoogleUserInfo verify(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    USERINFO_URL, HttpMethod.GET,
                    new HttpEntity<>(headers),
                    new ParameterizedTypeReference<>() {});

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token rejected");
            }
            Map<String, Object> body = response.getBody();
            String sub = (String) body.get("sub");
            String email = (String) body.get("email");
            if (sub == null || email == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Userinfo missing required fields");
            }
            return new GoogleUserInfo(sub, email, (String) body.get("name"), (String) body.get("picture"));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token verification failed");
        }
    }
}
