FROM eclipse-temurin:17-jdk AS builder

WORKDIR /app

COPY gradlew .
COPY gradlew.bat .
COPY gradle/ gradle/
COPY build.gradle settings.gradle ./

COPY src/ src/

RUN chmod +x ./gradlew && ./gradlew build -x test

FROM eclipse-temurin:17-jre

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-deu wget \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

RUN chown appuser:appgroup app.jar
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
