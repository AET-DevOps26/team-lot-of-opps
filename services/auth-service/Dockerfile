FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/

RUN useradd -u 1000 -m appuser && chown -R appuser /app
USER appuser
# opentelemetry-instrument auto-loads the installed instrumentations and exports
# OTLP; endpoint + service name come from the environment (docker-compose/helm).
ENV OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp \
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
    OTEL_SEMCONV_STABILITY_OPT_IN=http
# ^ stable HTTP semconv → http.server.request.duration (seconds), the name the
#   PrometheusRule FastAPI alerts key on. Without it the metric name/unit drift.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
