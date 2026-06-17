#!/usr/bin/env bash
set -e

REGISTRY="${REGISTRY:-ghcr.io/aet-devops26/team-lot-of-opps}"
TAG="${TAG:-latest}"
RELEASE="${RELEASE:-taxapp}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Load .env if present (vars already in environment take precedence)
if [ -f "$REPO_ROOT/src/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/src/.env"
  set +a
fi

VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"
VITE_DEV_MODE="${DEV_MODE:-true}"

HELM_DIR="$REPO_ROOT/deployment/helm"

echo "Building images locally (no push) from $REGISTRY with tag $TAG"

docker build --platform linux/amd64 -t "$REGISTRY/backend:$TAG"  "$REPO_ROOT/src/backend"
docker build --platform linux/amd64 -t "$REGISTRY/ai:$TAG"       "$REPO_ROOT/src/ai-components"
docker build --platform linux/amd64 \
  --build-arg VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  --build-arg VITE_DEV_MODE="$VITE_DEV_MODE" \
  -t "$REGISTRY/frontend:$TAG" "$REPO_ROOT/src/frontend"

echo "Deploying helm release '$RELEASE' with local images..."

helm upgrade --install "$RELEASE" "$HELM_DIR" \
  -f "$HELM_DIR/values.yaml" \
  -f "$HELM_DIR/values.local.yaml"

echo "Done. Watching rollout..."
kubectl rollout restart \
  deployment/"$RELEASE"-lot-of-opps-backend \
  deployment/"$RELEASE"-lot-of-opps-ai \
  deployment/"$RELEASE"-lot-of-opps-frontend
