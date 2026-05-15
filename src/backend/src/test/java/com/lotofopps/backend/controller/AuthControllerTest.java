package com.lotofopps.backend.controller;

import com.lotofopps.backend.config.JwtAuthFilter;
import com.lotofopps.backend.model.User;
import com.lotofopps.backend.service.GoogleAuthService;
import com.lotofopps.backend.service.JwtService;
import com.lotofopps.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GoogleAuthService googleAuthService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtService jwtService;

    // Mocked so the web slice can load JwtAuthFilter without its real JwtService dependency
    @MockitoBean
    private JwtAuthFilter jwtAuthFilter;

    @Test
    void googleLogin_returnsAuthResponseOnSuccess() throws Exception {
        GoogleAuthService.GoogleUserInfo userInfo =
                new GoogleAuthService.GoogleUserInfo("sub-123", "alice@example.com", "Alice", "https://pic.example.com");

        User user = new User();
        user.setGoogleSub("sub-123");
        user.setEmail("alice@example.com");
        user.setName("Alice");
        user.setPicture("https://pic.example.com");

        when(googleAuthService.verify(anyString())).thenReturn(userInfo);
        when(userService.findOrCreate(any())).thenReturn(user);
        when(jwtService.generateToken(any())).thenReturn("signed.jwt.token");

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"accessToken":"google-access-token"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("signed.jwt.token"))
                .andExpect(jsonPath("$.sub").value("sub-123"))
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.name").value("Alice"))
                .andExpect(jsonPath("$.picture").value("https://pic.example.com"));
    }

    @Test
    void googleLogin_returns401WhenGoogleRejectsToken() throws Exception {
        when(googleAuthService.verify(anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google token rejected"));

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"accessToken":"invalid-google-token"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void googleLogin_returns400ForMissingAccessToken() throws Exception {
        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());
    }
}
