package com.lotofopps.backend.config;

import com.lotofopps.backend.model.User;
import com.lotofopps.backend.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;

    public DataInitializer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.findByGoogleSub("mock-sub-001").isPresent()) {
            return;
        }

        createUser("mock-sub-001", "alice@example.com", "Alice Tester",
                "https://ui-avatars.com/api/?name=Alice+Tester");
        createUser("mock-sub-002", "bob@example.com", "Bob Demo",
                "https://ui-avatars.com/api/?name=Bob+Demo");
    }

    private User createUser(String googleSub, String email, String name, String picture) {
        User user = new User();
        user.setGoogleSub(googleSub);
        user.setEmail(email);
        user.setName(name);
        user.setPicture(picture);
        return userRepository.save(user);
    }
}
