#!/bin/sh
set -e

if [ -z "${OLLAMA_MODEL}" ]; then
  echo "ERROR: OLLAMA_MODEL must be set" >&2
  exit 1
fi

ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to be ready..."
RETRIES=60
while [ $RETRIES -gt 0 ]; do
  curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && break
  sleep 1
  RETRIES=$((RETRIES - 1))
done
if [ $RETRIES -eq 0 ]; then
  echo "ERROR: Ollama did not become ready in time" >&2
  exit 1
fi
echo "Ollama is ready."

if curl -sf http://localhost:11434/api/tags | grep -q "\"name\":\"${OLLAMA_MODEL}"; then
  echo "Model ${OLLAMA_MODEL} already present, skipping."
else
  echo "Pulling model ${OLLAMA_MODEL}..."
  ATTEMPT=0
  while [ $ATTEMPT -lt 3 ]; do
    ollama pull "${OLLAMA_MODEL}" && break
    ATTEMPT=$((ATTEMPT + 1))
    echo "Attempt ${ATTEMPT} failed, retrying in 5s..." >&2
    sleep 5
  done
  if [ $ATTEMPT -eq 3 ]; then
    echo "ERROR: Failed to pull ${OLLAMA_MODEL} after 3 attempts" >&2
    exit 1
  fi
  echo "Model ${OLLAMA_MODEL} ready."
fi

echo "All models ready."
wait $OLLAMA_PID
