#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="ghcr.io/aet-devops26/team-taxforward"
RELEASE="taxapp-lot-of-opps"
HELM_DIR="$REPO_ROOT/deployment/helm"

VALUES_LOCAL="$HELM_DIR/values.local.yaml"
if [ ! -f "$VALUES_LOCAL" ]; then
  echo "ERROR: $VALUES_LOCAL not found. Copy values.local.yaml.example and fill in your secrets."
  exit 1
fi

# Load VITE_FIREBASE_* build-time variables from src/.env if it exists.
ENV_FILE="$REPO_ROOT/src/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

FIREBASE_BUILD_ARGS=(
  --build-arg "VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY:-}"
  --build-arg "VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN:-}"
  --build-arg "VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-}"
  --build-arg "VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET:-}"
  --build-arg "VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
  --build-arg "VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID:-}"
)

services=(
  "frontend:$REPO_ROOT/src/frontend"
  "auth-service:$REPO_ROOT/src/auth-service"
  "invoice-service:$REPO_ROOT/src/invoice-service"
  "llm-chat:$REPO_ROOT/src/llm-chat"
  "suggestions-service:$REPO_ROOT/src/suggestions-service"
)

echo "==> Building images..."
for entry in "${services[@]}"; do
  name="${entry%%:*}"
  context="${entry##*:}"
  echo "    docker build $name"
  if [ "$name" = "frontend" ]; then
    docker build "${FIREBASE_BUILD_ARGS[@]}" -t "$REGISTRY/$name:latest" "$context"
  else
    docker build -t "$REGISTRY/$name:latest" "$context"
  fi
done

echo "==> Deploying with Helm..."
SA_JSON="$REPO_ROOT/src/auth-service/devops-25c9a-firebase-adminsdk-fbsvc-d15365a6ac.json"
FIREBASE_SA_ARG=()
if [ -f "$SA_JSON" ]; then
  FIREBASE_SA_ARG=(--set-file "firebase.serviceAccountJson=$SA_JSON")
else
  echo "WARNING: Firebase service account JSON not found at $SA_JSON — auth-service will fail to start."
fi

helm upgrade --install "$RELEASE" "$HELM_DIR" \
  -f "$HELM_DIR/values.yaml" \
  -f "$VALUES_LOCAL" \
  "${FIREBASE_SA_ARG[@]}"

echo "==> Done. App should be available at http://localhost:30080"
echo "    Watch pods: kubectl get pods -w"
