#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="ghcr.io/aet-devops26/team-taxforward"
TAG="latest"
RELEASE="taxforward"
NAMESPACE="taxforward"
HELM_DIR="$REPO_ROOT/infra/helm"

VALUES_LOCAL="$HELM_DIR/values.local.yaml"
if [ ! -f "$VALUES_LOCAL" ]; then
  echo "ERROR: $VALUES_LOCAL not found. Copy values.local.yaml.example and fill in your secrets."
  exit 1
fi

# Load VITE_FIREBASE_* build-time variables from infra/.env if it exists.
ENV_FILE="$REPO_ROOT/infra/.env"
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
  "client:$REPO_ROOT/client"
  "auth-service:$REPO_ROOT/services/auth-service"
  "invoice-service:$REPO_ROOT/services/invoice-service"
  "llm-chat:$REPO_ROOT/services/llm-chat"
  "suggestions-service:$REPO_ROOT/services/suggestions-service"
)

echo "==> Building images..."
for entry in "${services[@]}"; do
  name="${entry%%:*}"
  context="${entry##*:}"
  echo "    docker build $name"
  if [ "$name" = "client" ]; then
    docker build "${FIREBASE_BUILD_ARGS[@]}" -t "$REGISTRY/$name:latest" "$context"
  elif [ "$name" = "llm-chat" ]; then
    docker build --platform linux/amd64 -t "$REGISTRY/$name:latest" "$context"
  elif [ "$name" = "invoice-service" ] || [ "$name" = "suggestions-service" ]; then
    docker build --build-context "api=$REPO_ROOT/api" -t "$REGISTRY/$name:latest" "$context"
  else
    docker build -t "$REGISTRY/$name:latest" "$context"
  fi
done

echo "==> Deploying with Helm..."
SA_JSON="$REPO_ROOT/services/auth-service/devops-25c9a-firebase-adminsdk-fbsvc-d15365a6ac.json"
FIREBASE_SA_ARG=()
if [ -f "$SA_JSON" ]; then
  FIREBASE_SA_ARG=(--set-file "firebase.serviceAccountJson=$SA_JSON")
else
  echo "WARNING: Firebase service account JSON not found at $SA_JSON — auth-service will fail to start."
fi

helm upgrade --install "$RELEASE" "$HELM_DIR" \
  --namespace "$NAMESPACE" --create-namespace \
  --wait --rollback-on-failure --timeout 10m \
  -f "$HELM_DIR/values.yaml" \
  -f "$VALUES_LOCAL" \
  --set images.authService.repository="$REGISTRY/auth-service" \
  --set images.authService.tag="$TAG" \
  --set images.invoiceService.repository="$REGISTRY/invoice-service" \
  --set images.invoiceService.tag="$TAG" \
  --set images.llmChat.repository="$REGISTRY/llm-chat" \
  --set images.llmChat.tag="$TAG" \
  --set images.client.repository="$REGISTRY/client" \
  --set images.client.tag="$TAG" \
  --set images.suggestionsService.repository="$REGISTRY/suggestions-service" \
  --set images.suggestionsService.tag="$TAG" \
  --set-file "db.initSql=$REPO_ROOT/infra/postgres/init.sql" \
  "${FIREBASE_SA_ARG[@]}" || {
    echo "===== PVC ====="; kubectl get pvc -n "$NAMESPACE" -o wide || true
    echo "===== PODS ====="; kubectl get pods -n "$NAMESPACE" -o wide || true
    echo "===== EVENTS ====="; kubectl get events -n "$NAMESPACE" --sort-by=.lastTimestamp || true
    exit 1
  }

echo "==> Deploying observability stack..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null
helm repo update >/dev/null
helm dependency update "$REPO_ROOT/infra/monitoring" >/dev/null
helm upgrade --install monitoring "$REPO_ROOT/infra/monitoring" \
  --namespace monitoring --create-namespace \
  --wait --rollback-on-failure --timeout 10m \
  --set 'kube-prometheus-stack.grafana.persistence.storageClassName=local-path' \
  --set 'kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=local-path' \
  --set 'loki-stack.loki.persistence.storageClassName=local-path'

NODE_PORT=$(kubectl get svc "$RELEASE-tax-forward-traefik" \
  --namespace "$NAMESPACE" \
  -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)

if [ -n "$NODE_PORT" ]; then
  echo "==> Done. App available at http://localhost:$NODE_PORT"
else
  echo "==> Done. Could not read the traefik NodePort — check: kubectl get svc -n $NAMESPACE"
fi
echo "    Watch pods: kubectl get pods -n $NAMESPACE -w"
