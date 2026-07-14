package com.lotofopps.suggestions;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Configuration;

@SpringBootApplication
public class SuggestionsApplication {

    public static void main(String[] args) {
        SpringApplication.run(SuggestionsApplication.class, args);
    }
}

@Configuration(proxyBeanMethods = false)
class OpenTelemetryAppenderConfig {
    OpenTelemetryAppenderConfig(OpenTelemetry openTelemetry) {
        OpenTelemetryAppender.install(openTelemetry);
    }
}
