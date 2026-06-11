package com.lotofopps.backend.service;

import com.lotofopps.backend.model.User;
import com.lotofopps.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private GoogleAuthService.GoogleUserInfo userInfo() {
        return new GoogleAuthService.GoogleUserInfo("sub-123", "alice@example.com", "Alice", "https://pic.example.com");
    }

    @Test
    void findOrCreate_createsNewUserWhenNotFound() {
        when(userRepository.findByGoogleSub("sub-123")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.findOrCreate(userInfo());

        assertThat(result.getGoogleSub()).isEqualTo("sub-123");
        assertThat(result.getEmail()).isEqualTo("alice@example.com");
        assertThat(result.getName()).isEqualTo("Alice");
        assertThat(result.getPicture()).isEqualTo("https://pic.example.com");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void findOrCreate_updatesExistingUser() {
        User existing = new User();
        existing.setGoogleSub("sub-123");
        existing.setEmail("old@example.com");
        existing.setName("Old Name");

        when(userRepository.findByGoogleSub("sub-123")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.findOrCreate(userInfo());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();

        assertThat(saved.getEmail()).isEqualTo("alice@example.com");
        assertThat(saved.getName()).isEqualTo("Alice");
        assertThat(saved.getPicture()).isEqualTo("https://pic.example.com");
        assertThat(saved.getLastLoginAt()).isNotNull();
    }

    @Test
    void findOrCreate_returnsUpdatedUser() {
        User existing = new User();
        existing.setGoogleSub("sub-123");
        when(userRepository.findByGoogleSub("sub-123")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.findOrCreate(userInfo());

        assertThat(result).isSameAs(existing);
    }
}
