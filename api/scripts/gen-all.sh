#!/usr/bin/env bash
#
# gen-all.sh — regenerate every client/stub from the OpenAPI single source of truth.
#
# The spec at api/openapi.yaml is authoritative; backend stubs and the frontend
# SDK should be generated from it rather than hand-written. Run from anywhere:
#
#   ./api/scripts/gen-all.sh            # generate everything available
#   ./api/scripts/gen-all.sh ts         # only the TypeScript SDK
#   ./api/scripts/gen-all.sh python java
#
# Each generator is optional and skipped (with a hint) if its CLI is missing, so
# the script never hard-fails just because one toolchain is not installed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEC="${SPEC:-$REPO_ROOT/api/openapi.yaml}"
GEN_DIR="$REPO_ROOT/api/generated"

log()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

[ -f "$SPEC" ] || { warn "Spec not found: $SPEC"; exit 1; }

gen_ts() {
  log "TypeScript types → client/src/api/schema.ts"
  npx --yes openapi-typescript "$SPEC" -o "$REPO_ROOT/client/src/api/schema.ts"
}

gen_python() {
  local out="$GEN_DIR/python-client"
  log "Python client → api/generated/python-client"
  if ! have openapi-python-client; then
    warn "openapi-python-client not found — install with: pipx install openapi-python-client"
    return 0
  fi
  rm -rf "$out"
  mkdir -p "$GEN_DIR"
  openapi-python-client generate --path "$SPEC" --output-path "$out" --overwrite
}

gen_java() {
  local out="$GEN_DIR/java"
  log "Java (Spring) stubs → api/generated/java"
  if have openapi-generator-cli; then
    openapi-generator-cli generate -i "$SPEC" -g spring -o "$out"
  elif have npx; then
    npx --yes @openapitools/openapi-generator-cli generate -i "$SPEC" -g spring -o "$out"
  else
    warn "openapi-generator-cli not found — install with: npm i -g @openapitools/openapi-generator-cli"
  fi
}

targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(ts python java)

for t in "${targets[@]}"; do
  case "$t" in
    ts|typescript) gen_ts ;;
    py|python)     gen_python ;;
    java|spring)   gen_java ;;
    *) warn "Unknown target '$t' (expected: ts | python | java)" ;;
  esac
done

log "Done."
