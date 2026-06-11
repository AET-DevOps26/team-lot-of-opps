package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.AuthResponse;
import com.lotofopps.backend.model.User;
import com.lotofopps.backend.repository.UserRepository;
import com.lotofopps.backend.service.JwtService;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Profile("dev")
public class DevAuthController {

    private static final String DEV_SUB = "mock-sub-001";

    private final UserRepository userRepository;
    private final JwtService jwtService;

    public DevAuthController(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @GetMapping("/dev-login")
    @Transactional
    public ResponseEntity<?> devLogin() {
        User alice = userRepository.findByGoogleSub(DEV_SUB).orElseGet(() -> {
            User u = new User();
            u.setGoogleSub(DEV_SUB);
            u.setEmail("alice@example.com");
            u.setName("Alice Tester");
            u.setPicture("https://ui-avatars.com/api/?name=Alice+Tester");
            return userRepository.save(u);
        });
        String token = jwtService.generateToken(alice);
        return ResponseEntity.ok(new AuthResponse(token, alice.getGoogleSub(),
                alice.getEmail(), alice.getName(), alice.getPicture()));
    }
}
