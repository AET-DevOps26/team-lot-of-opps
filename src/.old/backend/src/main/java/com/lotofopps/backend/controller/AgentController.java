package com.lotofopps.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.Map;

@RestController
@Tag(name = "Agent")
public class AgentController {

    private static final Logger logger = LoggerFactory.getLogger(AgentController.class);

    private final WebClient webClient;

    public AgentController(@Value("${ai.backend.url}") String aiBackendUrl) {
        String base = aiBackendUrl.endsWith("/")
                ? aiBackendUrl.substring(0, aiBackendUrl.length() - 1)
                : aiBackendUrl;
        this.webClient = WebClient.create(base);
    }

    public record AgentChatRequest(String question) {}

    @PostMapping(value = "/api/agent/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream a document-discovery agent response via SSE")
    public SseEmitter agentChat(
            @RequestBody AgentChatRequest request,
            @AuthenticationPrincipal String userId) {

        logger.info("POST /api/agent/chat userId={} questionLen={}", userId, request.question().length());

        SseEmitter emitter = new SseEmitter(0L);

        Flux<ServerSentEvent<String>> upstream = webClient.post()
                .uri("/api/agent/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(Map.of("question", request.question(), "user_id", userId))
                .retrieve()
                .bodyToFlux(new org.springframework.core.ParameterizedTypeReference<ServerSentEvent<String>>() {});

        upstream.subscribe(
                event -> {
                    try {
                        if (event.data() != null) {
                            emitter.send(SseEmitter.event().data(event.data()));
                        }
                    } catch (IOException e) {
                        emitter.completeWithError(e);
                    }
                },
                emitter::completeWithError,
                emitter::complete
        );

        return emitter;
    }
}
