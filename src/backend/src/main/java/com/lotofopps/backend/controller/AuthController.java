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
    public AuthResponse googleLogin(@RequestBody AuthRequest request) {
        GoogleAuthService.GoogleUserInfo info = googleAuthService.verify(request.accessToken());
        User user = userService.findOrCreate(info);
        String token = jwtService.generateToken(user);
        return new AuthResponse(token, user.getGoogleSub(), user.getEmail(), user.getName(), user.getPicture());
    }
}
