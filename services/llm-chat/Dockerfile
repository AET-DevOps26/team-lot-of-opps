FROM python:3.11-slim

WORKDIR /app

ENV HF_HOME=/opt/hf \
    HOME=/opt/hf \
    UV_SYSTEM_PYTHON=1

RUN useradd -u 1000 -m appuser

COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -r requirements.txt
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')" \
    && chmod -R a+rX /opt/hf

COPY app/ ./app/
USER appuser
EXPOSE 8081 50051
# opentelemetry-instrument auto-loads the installed instrumentations (FastAPI, gRPC)
# and exports OTLP; endpoint + service name come from the environment.
ENV OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp \
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
    OTEL_SEMCONV_STABILITY_OPT_IN=http
# ^ stable HTTP semconv → http.server.request.duration (seconds), the name the
#   PrometheusRule FastAPI alerts key on. Without it the metric name/unit drift.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl -fsS http://localhost:8081/health || exit 1
CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
