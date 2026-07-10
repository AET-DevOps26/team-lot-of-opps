package com.lotofopps.backend.config;

import com.lotofopps.backend.grpc.EmbeddingServiceGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelFactory;

@Configuration
public class GrpcClientConfig {

    @Bean
    EmbeddingServiceGrpc.EmbeddingServiceBlockingStub embeddingStub(GrpcChannelFactory channels) {
        return EmbeddingServiceGrpc.newBlockingStub(channels.createChannel("llm-chat"));
    }
}
