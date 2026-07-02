# syntax=docker/dockerfile:1
FROM eclipse-temurin:17-jdk AS builder

WORKDIR /app

COPY gradlew .
COPY gradlew.bat .
COPY gradle/ gradle/
COPY build.gradle settings.gradle ./

COPY src/ src/

COPY --from=api openapi.yaml ./api/openapi.yaml
ENV OPENAPI_SPEC_PATH=/app/api/openapi.yaml

RUN chmod +x ./gradlew && ./gradlew build -x test

FROM eclipse-temurin:17-jre

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-deu wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

RUN chown 1000 app.jar

USER 1000

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
