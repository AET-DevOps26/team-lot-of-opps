package com.lotofopps.backend.service;

import com.lotofopps.backend.model.User;
import com.lotofopps.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User findOrCreate(GoogleAuthService.GoogleUserInfo info) {
        return userRepository.findByGoogleSub(info.sub())
                .map(user -> {
                    user.setEmail(info.email());
                    user.setName(info.name());
                    user.setPicture(info.picture());
                    user.setLastLoginAt(Instant.now());
                    return userRepository.save(user);
                })
                .orElseGet(() -> {
                    User user = new User();
                    user.setGoogleSub(info.sub());
                    user.setEmail(info.email());
                    user.setName(info.name());
                    user.setPicture(info.picture());
                    return userRepository.save(user);
                });
    }
}
