package com.lotofopps.backend.dto;

public record AuthResponse(String token, String sub, String email, String name, String picture) {}
