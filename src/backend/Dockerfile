FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /app

COPY gradlew .
COPY gradlew.bat .
COPY gradle/ gradle/
COPY build.gradle settings.gradle ./

COPY src/ src/

RUN chmod +x ./gradlew && ./gradlew build -x test

FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD java -cp app.jar org.springframework.boot.loader.JarLauncher -healthz

ENTRYPOINT ["java", "-jar", "app.jar"]