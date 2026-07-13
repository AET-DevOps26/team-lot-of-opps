package com.lotofopps.export.config;

import com.lotofopps.backend.grpc.InternalInvoiceServiceGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.ChannelBuilderOptions;
import org.springframework.grpc.client.GrpcChannelFactory;

@Configuration
public class GrpcClientConfig {

    @Bean
    InternalInvoiceServiceGrpc.InternalInvoiceServiceBlockingStub invoiceStub(
            GrpcChannelFactory channels) {
        // Receipts run up to 10 MiB (UPLOAD_MAX_SIZE_BYTES); gRPC's default 4 MiB inbound
        // cap would silently drop them from every zip export.
        return InternalInvoiceServiceGrpc.newBlockingStub(
                channels.createChannel(
                        "invoice",
                        ChannelBuilderOptions.defaults()
                                .withCustomizer(
                                        (name, builder) ->
                                                builder.maxInboundMessageSize(16 * 1024 * 1024))));
    }
}
