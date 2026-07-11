package com.lotofopps.suggestions.config;

import com.lotofopps.backend.grpc.InternalInvoiceServiceGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelFactory;

@Configuration
public class GrpcClientConfig {

    @Bean
    InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub(
            GrpcChannelFactory channels) {
        return InternalInvoiceServiceGrpc.newBlockingStub(channels.createChannel("invoice"));
    }
}
