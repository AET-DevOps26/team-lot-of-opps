#!/usr/bin/env bash
set -euo pipefail

# Standalone AET-cluster deploy — mirrors the GitHub Actions (build.yml +
# deploy.yml + deploy-observability.yml) for target=aet, in one command.
# Counterpart to local-deploy.sh, but pushes images to GHCR (the cluster pulls
# them) instead of building local images with pullPolicy: Never.
#
# Usage: infra/aet-deploy.sh [--skip-observability]
#   --skip-observability   Deploy only the app, not the monitoring stack.
#     The monitoring chart bundles kube-prometheus-stack, which creates
#     cluster-scoped ClusterRoles/CRDs the namespace-scoped AET account can't
#     create (--skip-crds is NOT enough). Use this until the chart is reworked
#     to rely on the cluster's shared prometheus-operator.
#
# Prereqs:
#   - Your AET kubeconfig is the active context (or export KUBECONFIG=/path).
#   - `docker login ghcr.io` done (needs a PAT with write:packages).
#   - infra/.env filled in (LLM_*, FIREBASE_PROJECT_ID, DB_PASSWORD, VITE_FIREBASE_*).
#   - Firebase admin SA JSON present at services/auth-service/*firebase-adminsdk*.json.
#
# Cleanup (fair-use §2.1 — don't leave idle stacks):
#   helm uninstall taxforward  -n taxforward
#   helm uninstall monitoring  -n taxforward-observ

SKIP_OBS=""
for arg in "$@"; do
  case "$arg" in
    --skip-observability) SKIP_OBS=1 ;;
    *) echo "Unknown argument: $arg (usage: $0 [--skip-observability])"; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${IMAGE_TAG:-latest}"
RELEASE="taxforward"                 # Helm release name → resource names (taxforward-tax-forward-*)
NAMESPACE="team-lot-of-opps"         # namespace in the shared AET project (distinct from release)
OBS_NAMESPACE="team-lot-of-opps-observ"
HELM_DIR="$REPO_ROOT/infra/helm"
MON_DIR="$REPO_ROOT/infra/monitoring"

# ─── Kube context guard ──────────────────────────────────────────────────────
# No base64 KUBE_CONFIG handling here (that's a CI concern) — use whatever
# kubeconfig/context is active. Show it so a wrong-cluster deploy is caught early.
CTX="$(kubectl config current-context 2>/dev/null || true)"
SERVER="$(kubectl config view --minify -o jsonpath='{.clusters[*].cluster.server}' 2>/dev/null || true)"
echo "==> Target kube context: ${CTX:-<none>}  (${SERVER:-<none>})"
echo "    App namespace: $NAMESPACE   Monitoring namespace: $OBS_NAMESPACE"
# Refuse to deploy anywhere but the AET Rancher cluster — otherwise a default
# local context (orbstack/docker-desktop) silently gets the deploy.
case "$SERVER" in
  *ase.cit.tum.de*) : ;;   # AET Rancher — good
  *)
    echo "ERROR: context '$CTX' ($SERVER) is not the AET cluster."
    echo "       Point KUBECONFIG at your AET kubeconfig and retry, e.g.:"
    echo "         KUBECONFIG=infra/stud.yaml $0 $*"
    exit 1
    ;;
esac
# `kubectl cluster-info` needs cluster-scoped reads the namespace-scoped AET token
# doesn't have; `auth whoami` verifies reachability + auth with what the token can do.
if ! kubectl auth whoami >/dev/null 2>&1; then
  echo "ERROR: kubectl cannot reach/authenticate to the cluster. Point KUBECONFIG at your AET cluster and retry."
  exit 1
fi

# On Rancher a bare `helm --create-namespace` namespace lands "not in a project"
# (no team RBAC, un-deletable). Pre-create it annotated into our project so it
# inherits the team's access. Idempotent — skips if it already exists.
ensure_ns() {
  local ns="$1"
  kubectl get namespace "$ns" >/dev/null 2>&1 && return 0
  echo "==> Creating namespace $ns in project $PROJECT_ID"
  kubectl create -f - <<YAML
apiVersion: v1
kind: Namespace
metadata:
  name: $ns
  annotations:
    field.cattle.io/projectId: "$PROJECT_ID"
  labels:
    field.cattle.io/projectId: "${PROJECT_ID#*:}"
YAML
}

# ─── Config / secrets ────────────────────────────────────────────────────────
ENV_FILE="$REPO_ROOT/infra/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy infra/.env.example to infra/.env and fill it in."
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# Rancher project the auto-created namespaces are pinned into (see ensure_ns).
PROJECT_ID="${AET_PROJECT_ID:?set AET_PROJECT_ID in infra/.env (e.g. c-f49m7:p-rgm54)}"

# Set AFTER sourcing .env so the compose REGISTRY (team-lot-of-opps) can't clobber it.
# The AET cluster pulls images the CI publishes under .../taxforward (build.yml / deploy.yml).
REGISTRY="ghcr.io/aet-devops26/taxforward"

FIREBASE_BUILD_ARGS=(
  --build-arg "VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY:-}"
  --build-arg "VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN:-}"
  --build-arg "VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-}"
  --build-arg "VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET:-}"
  --build-arg "VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
  --build-arg "VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID:-}"
)

# Firebase admin SA JSON (gitignored real credential) — glob for the team's file.
SA_JSON="$(ls "$REPO_ROOT"/services/auth-service/*firebase-adminsdk*.json 2>/dev/null | head -n1 || true)"
FIREBASE_SA_ARG=()
if [ -n "$SA_JSON" ]; then
  FIREBASE_SA_ARG=(--set-file "firebase.serviceAccountJson=$SA_JSON")
else
  echo "WARNING: Firebase service account JSON not found in services/auth-service/ — auth-service will fail to start."
fi

services=(
  "client:$REPO_ROOT/client"
  "auth-service:$REPO_ROOT/services/auth-service"
  "invoice-service:$REPO_ROOT/services/invoice-service"
  "llm-chat:$REPO_ROOT/services/llm-chat"
  "suggestions-service:$REPO_ROOT/services/suggestions-service"
)

# ─── Build + push images (cluster pulls from GHCR) ───────────────────────────
# AET cluster nodes are linux/amd64; on Apple Silicon a plain `docker build`
# produces arm64 images the cluster rejects (ImagePullBackOff: no match for
# platform). Force amd64 for every image (CI runners are amd64 so build natively).
PLATFORM=linux/amd64
echo "==> Building and pushing images to $REGISTRY (tag: $TAG, platform: $PLATFORM)..."
for entry in "${services[@]}"; do
  name="${entry%%:*}"
  context="${entry##*:}"
  image="$REGISTRY/$name:$TAG"
  echo "    docker build $name -> $image"
  if [ "$name" = "client" ]; then
    docker build --platform "$PLATFORM" "${FIREBASE_BUILD_ARGS[@]}" -t "$image" "$context"
  elif [ "$name" = "invoice-service" ] || [ "$name" = "suggestions-service" ]; then
    docker build --platform "$PLATFORM" --build-context "api=$REPO_ROOT/api" -t "$image" "$context"
  else
    docker build --platform "$PLATFORM" -t "$image" "$context"
  fi
  docker push "$image"
done

# ─── Observability ───────────────────────────────────────────────────────────
# Install first: the app chart's ServiceMonitor templates are gated on the
# monitoring.coreos.com/v1 CRD. --skip-crds because the AET student account
# can't create cluster-scoped CRDs (the chair pre-installs them).
if [ -n "$SKIP_OBS" ]; then
  echo "==> Skipping observability stack (--skip-observability)."
else
  echo "==> Deploying observability stack..."
  ensure_ns "$OBS_NAMESPACE"
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
  helm repo add grafana https://grafana.github.io/helm-charts >/dev/null
  helm repo update >/dev/null
  helm dependency update "$MON_DIR" >/dev/null
  helm upgrade --install monitoring "$MON_DIR" \
    --namespace "$OBS_NAMESPACE" --create-namespace \
    --skip-crds \
    --atomic --timeout 10m \
    --set 'kube-prometheus-stack.grafana.persistence.storageClassName=csi-rbd-sc' \
    --set 'kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=csi-rbd-sc' \
    --set 'loki-stack.loki.persistence.storageClassName=csi-rbd-sc'
fi

# ─── App ─────────────────────────────────────────────────────────────────────
# Storage class (csi-rbd-sc) and traefik NodePort are already the values.yaml
# defaults for AET, so no --set override needed (unlike the VM path).
echo "==> Deploying app with Helm..."
ensure_ns "$NAMESPACE"
helm upgrade --install "$RELEASE" "$HELM_DIR" \
  --namespace "$NAMESPACE" --create-namespace \
  --atomic --timeout 10m \
  -f "$HELM_DIR/values.yaml" \
  --set llm.url="${LLM_URL:-}" \
  --set llm.model="${LLM_MODEL:-}" \
  --set llm.apiKey="${LLM_API_KEY:-}" \
  --set firebase.projectId="${FIREBASE_PROJECT_ID:-}" \
  --set db.password="${DB_PASSWORD:-}" \
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

# ─── Report ──────────────────────────────────────────────────────────────────
NODE_PORT=$(kubectl get svc "$RELEASE-tax-forward-traefik" \
  --namespace "$NAMESPACE" \
  -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)
NODE_IP=$(kubectl get nodes \
  -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || true)

if [ -n "$NODE_PORT" ] && [ -n "$NODE_IP" ]; then
  echo "==> Done. App reachable at: http://$NODE_IP:$NODE_PORT"
else
  echo "==> Done. Could not read the traefik NodePort/IP — check: kubectl get svc -n $NAMESPACE"
fi
echo "    Watch pods: kubectl get pods -n $NAMESPACE -w"
