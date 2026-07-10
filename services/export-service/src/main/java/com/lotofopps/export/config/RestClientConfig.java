package com.lotofopps.export.config;

import java.time.Duration;
import org.springframework.boot.restclient.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Kept apart from {@link WebConfig} on purpose: {@code WebConfig} is a {@code WebMvcConfigurer} and
 * is therefore loaded by {@code @WebMvcTest} slices, which do not auto-configure a {@code
 * RestTemplateBuilder}.
 */
@Configuration
public class RestClientConfig {

    /**
     * A ZIP export fans out one request per receipt, so a hung invoice-service must not pin an
     * export thread indefinitely.
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder.connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(30))
                .build();
    }
}
