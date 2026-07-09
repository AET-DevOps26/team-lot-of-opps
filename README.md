# TaxForward — Team Lot of Opps

TaxForward is a full-stack application that helps German students and trainees track study-related expenses and turn them into a future tax refund ("Verlustvortrag"). Users upload receipts and invoices; an AI pipeline extracts and classifies the line items, stores them, and surfaces suggestions for tax-deductible documents that might be missing.

## Architecture

```
├── api/                       # OpenAPI single source of truth (codegen target — WIP)
├── client/                    # React + Vite + Redux + TypeScript SPA
├── services/
│   ├── invoice-service/       # Spring Boot REST API — document upload, OCR, invoice persistence
│   ├── llm-chat/              # FastAPI — conversational RAG agent (pgvector)
│   ├── suggestions-service/   # Spring Boot REST API — proactive tax suggestions (LLM-generated)
│   └── auth-service/          # FastAPI — Firebase token verification (Traefik forward-auth)
└── infra/
    ├── traefik/               # Reverse proxy config — routing + auth middleware
    ├── helm/                  # Kubernetes Helm chart (app + ServiceMonitors/dashboards)
    ├── monitoring/            # Helm chart: kube-prometheus-stack + loki-stack (k8s)
    ├── prometheus/            # Prometheus config (local Docker Compose)
    ├── loki/                  # Loki config (local Docker Compose)
    ├── promtail/              # Promtail config (local Docker Compose)
    ├── grafana/               # Grafana provisioning: dashboards + datasources
    ├── terraform/             # k3s VM provisioning (Azure)
    ├── ansible/               # VM configuration (k3s install)
    ├── scripts/               # Utility/seed scripts
    └── docker-compose.yaml    # Local dev stack
```

All API traffic flows through **Traefik**, which enforces Firebase authentication via a forward-auth middleware before proxying to the relevant service:

```
Browser → Traefik ──► auth-service (/verify)   [validates Firebase ID token]
                  └──► invoice-service          [/api/v1/documents, /api/v1/invoices]
                  └──► llm-chat                 [/api/v1/agent]
                  └──► suggestions-service      [/api/v1/suggestions]
```

An external OpenAI-compatible LLM endpoint is used for OCR extraction, vision, chat completions,
and suggestions — see [LLM provider](#llm-provider-cloud-or-local) below.

## LLM provider (cloud or local)

`llm-chat`, `invoice-service`, and `suggestions-service` all talk to the LLM over the OpenAI-compatible
`/v1/chat/completions` protocol against a configurable base URL — `llm-chat` via the OpenAI Python SDK
(`ChatOpenAI`), the two Spring Boot services via plain REST calls (`${llmUrl}/v1/chat/completions` with
a Bearer token) — rather than a hardcoded provider. So swapping between a cloud API and a local model
server is just three environment variables, set once for the whole stack (`infra/.env`, or
`LLM_URL`/`LLM_MODEL`/`LLM_API_KEY` in [`infra/helm/values.yaml`](infra/helm/values.yaml) for Kubernetes):

| | `LLM_URL` | `LLM_MODEL` | `LLM_API_KEY` |
|---|---|---|---|
| **Local** (LM Studio / Ollama) | `http://host.docker.internal:1234` | model id loaded in the local server, e.g. `google/gemma-4-e2b` | `EMPTY` (unused, but required by the OpenAI client) |
| **Cloud** (OpenAI) | `https://api.openai.com` | an OpenAI model, e.g. `gpt-4o-mini` | your real OpenAI API key |

The default in `infra/.env.example` is local (LM Studio/Ollama on the host). To switch to a cloud
provider, set the three variables above — no code changes required, since every service reads them
the same way. `llm-chat`'s client construction (`services/llm-chat/app/agent.py`):
```python
vllm_url = os.getenv("LLM_URL", "http://host.docker.internal:1234")
llm = ChatOpenAI(
    model=os.getenv("LLM_MODEL", "google/gemma-4-e2b"),
    base_url=f"{vllm_url}/v1",
    api_key=LLM_API_KEY,  # os.getenv("LLM_API_KEY", "EMPTY")
)
```
Any OpenAI-compatible endpoint works this way, not just OpenAI and LM Studio/Ollama specifically.

## Services

| Service           | Tech                              | Internal port | Container         |
|-------------------|-----------------------------------|---------------|-------------------|
| `client`          | React + Vite + TypeScript         | `5173`        | `client`          |
| `invoice-service` | Spring Boot (Java, JPA)           | `8080`        | `invoice-service` |
| `llm-chat`        | FastAPI (Python, LangChain)       | `8081`        | `llm-chat`        |
| `suggestions-service` | Spring Boot (Java, JPA)       | `8083`        | `suggestions-service` |
| `auth-service`    | FastAPI (Python, Firebase Admin)  | `8000`        | `auth-service`    |
| `traefik`         | Traefik v3                        | `80` / `8090` | `traefik`         |
| `db`              | PostgreSQL 16 + pgvector          | `5432`        | `db`              |
| `prometheus`      | Prometheus v2.52                  | `9090`        | `prometheus`      |
| `loki`            | Grafana Loki 2.9                  | `3100`        | `loki`            |
| `grafana`         | Grafana OSS                       | `3001` (→`3000`) | `grafana`      |

## Observability

Local dev gets metrics + logs for free — Prometheus, Loki, Promtail, and
Grafana all start with `docker compose up -d`. Grafana is at
`http://localhost:3001`, with dashboards and datasources auto-provisioned
from [`infra/grafana/provisioning/`](infra/grafana/provisioning/) (Prometheus
+ Loki datasources, a TaxForward dashboard). Services log structured JSON,
which Promtail ships to Loki for querying alongside metrics.

On Kubernetes, monitoring is a separate Helm release —
[`infra/monitoring`](infra/monitoring) (kube-prometheus-stack + loki-stack) —
deployed independently of the app via
[`.github/workflows/deploy-observability.yml`](.github/workflows/deploy-observability.yml).
App-side ServiceMonitors, a PrometheusRule, and dashboard ConfigMaps live in
[`infra/helm/templates/`](infra/helm/templates/). Grafana is exposed
publicly via Traefik at `grafana.<tls.host>`, but currently has **no auth
middleware in front of it** — see [TODO.md](TODO.md).

## Setup

### Prerequisites

- Docker + Docker Compose
- A Firebase project with Authentication enabled (Email/Password at minimum)
- An OpenAI-compatible LLM server running locally (e.g. [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com))

### 1. Configure environment

```bash
cp infra/.env.example infra/.env
```

Fill in the Firebase values from your Firebase project settings:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=...
```

For local dev, use the Firebase Auth Emulator (see below) — no service account needed. For production, place your Firebase service account JSON at `services/auth-service/` and update `GOOGLE_APPLICATION_CREDENTIALS` in `infra/docker-compose.yaml` to point to it.

### Firebase Auth Emulator (local dev)

Instead of hitting production Firebase, you can run auth locally. This requires no service account credentials and lets you create test users freely.

**Prerequisites (one-time):**
```bash
npm install -g firebase-tools
firebase login
# Java is also required — the Firebase CLI will prompt to install it if missing
```

**Start the emulator before `docker compose up`:**
```bash
# from the project root
firebase emulators:start
```

**Enable emulator mode in `infra/.env`:**
```
VITE_USE_FIREBASE_EMULATOR=true
FIREBASE_AUTH_EMULATOR_HOST=host.docker.internal:9099
```

The defaults in `infra/.env.example` have both flags set to `false`/empty (production mode).

Emulator UI: `http://127.0.0.1:4000/auth` — new sign-ups appear here instead of the Firebase console.

### 2. Start the stack

```bash
cd infra
docker compose up -d
```

### 3. Open the app

`http://localhost:5173`

---

## Frontend end-to-end tests

Playwright drives the real frontend through complete user journeys (auth, dashboard,
invoices, upload). The backend REST API (`/api/v1/**`) is mocked in-browser, and
authentication runs against the Firebase Auth emulator — so the suite needs **no**
running backend services.

```bash
cd client
npm install
npx playwright install chromium   # one-time
npm run e2e                        # runs headless; npm run e2e:ui for the UI mode
```

`npm run e2e` is self-contained: Playwright boots the Auth emulator (via the local
`firebase-tools`) and a Vite dev server on port `5273` automatically. **Java is
required** for the emulator (the only system prerequisite). Tests and fixtures live
in [`client/e2e/`](client/e2e/), and CI runs them via
[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml).

---

## Pre-commit hooks & secret scanning

Git hooks are managed with [pre-commit](https://pre-commit.com). One-time setup:

```bash
pip install -r requirements-dev.txt
pre-commit install
```

Configured hooks ([.pre-commit-config.yaml](.pre-commit-config.yaml)):

- **gitleaks** — scans staged changes for hardcoded secrets (API keys, tokens,
  passwords) and **blocks the commit** if any are found. Rules and the allowlist for
  placeholder/example files live in [`.gitleaks.toml`](.gitleaks.toml).
- **openapi-lint** — lints the OpenAPI spec when it changes (see [api/README.md](api/README.md)).

Run on demand: `pre-commit run gitleaks --all-files` (or `pre-commit run -a` for all hooks).

If a finding is a false positive you can bypass with `git commit --no-verify`, but the
same scan runs in CI ([`.github/workflows/secret-scan.yml`](.github/workflows/secret-scan.yml))
on every PR and push to `main` as the authoritative, unbypassable gate. Prefer fixing
the allowlist in `.gitleaks.toml` over routinely skipping the hook.

---

## Deploy

Production runs on **k3s** (a single Azure VM, or the shared AET cluster),
not raw Docker Compose. [`provision.yml`](.github/workflows/provision.yml)
provisions the VM with Terraform and installs k3s via Ansible;
[`build.yml`](.github/workflows/build.yml) and
[`deploy.yml`](.github/workflows/deploy.yml) build images and `helm upgrade`
the app chart ([`infra/helm`](infra/helm)) on push to `main` or manual
dispatch. The monitoring stack deploys separately — see
[Observability](#observability) above.

---

## Notes

- Each database service uses a Docker named volume (`postgres_invoice`, `postgres_llm_chat`) for persistence across restarts.
- Uploaded files are stored on the `invoice-service` container filesystem and are **not** persisted across container recreation.
- The Traefik dashboard is available at `http://localhost:8090`.
