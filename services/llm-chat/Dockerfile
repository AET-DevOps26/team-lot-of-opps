FROM python:3.11-slim

WORKDIR /app

ENV HF_HOME=/opt/hf \
    HOME=/opt/hf \
    USER=appuser \
    UV_SYSTEM_PYTHON=1

COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -r requirements.txt
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')" \
    && chmod -R a+rX /opt/hf

COPY app/ ./app/
EXPOSE 8081
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
