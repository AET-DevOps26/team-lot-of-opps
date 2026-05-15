package com.lotofopps.backend.controller;

import com.lotofopps.backend.dto.AuthRequest;
import com.lotofopps.backend.dto.AuthResponse;
import com.lotofopps.backend.model.User;
import com.lotofopps.backend.service.GoogleAuthService;
import com.lotofopps.backend.service.JwtService;
import com.lotofopps.backend.service.UserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final GoogleAuthService googleAuthService;
    private final UserService userService;
    private final JwtService jwtService;

    public AuthController(GoogleAuthService googleAuthService, UserService userService, JwtService jwtService) {
        this.googleAuthService = googleAuthService;
        this.userService = userService;
        this.jwtService = jwtService;
    }

    @PostMapping("/google")
    public org.springframework.http.ResponseEntity<?> googleLogin(@RequestBody AuthRequest request) {
        if (request.accessToken() == null || request.accessToken().isBlank()) {
            return org.springframework.http.ResponseEntity.badRequest()
                    .body(java.util.Map.of("error", "accessToken is required"));
        }
        GoogleAuthService.GoogleUserInfo info = googleAuthService.verify(request.accessToken());
        User user = userService.findOrCreate(info);
        String token = jwtService.generateToken(user);
        return org.springframework.http.ResponseEntity.ok(
                new AuthResponse(token, user.getGoogleSub(), user.getEmail(), user.getName(), user.getPicture()));
    }
}
