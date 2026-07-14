# TaxForward — Team Lot of Opps

TaxForward is a full-stack application that helps German students and trainees track study-related expenses and turn them into a future tax refund ("Verlustvortrag"). Users upload receipts and invoices; an AI pipeline extracts and classifies the line items, stores them, and surfaces suggestions for tax-deductible documents that might be missing.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/problem-statement.md`](docs/problem-statement.md) | Problem statement and product motivation |
| [`docs/RACI.md`](docs/RACI.md) | Team subsystem ownership and responsibilities |
| [`docs/database-schema.md`](docs/database-schema.md) | Database schema — tables, columns, migrations |
| [`docs/runbook-rollback.md`](docs/runbook-rollback.md) | Deployment rollback runbook |
| [`docs/architecture-diagram.png`](docs/architecture-diagram.png) · [`docs/use-case.png`](docs/use-case.png) · [`docs/analysis-object-model.png`](docs/analysis-object-model.png) | Architecture, use-case and analysis-object-model diagrams |
| [`api/README.md`](api/README.md) | OpenAPI spec and codegen |

## Architecture

```
├── api/                       # OpenAPI single source of truth (codegen target — WIP)
├── client/                    # React + Vite + Redux + TypeScript SPA
├── services/
│   ├── invoice-service/       # Spring Boot REST API — document upload, OCR, invoice persistence
│   ├── llm-chat/              # FastAPI — conversational RAG agent (pgvector)
│   ├── suggestions-service/   # Spring Boot REST API — proactive tax suggestions (LLM-generated)
│   ├── export-service/        # Spring Boot REST API — tax-year exports (PDF/CSV/ZIP), stateless
│   └── auth-service/          # FastAPI — Firebase token verification (Traefik forward-auth)
└── infra/
    ├── traefik/               # Reverse proxy config — routing + auth middleware
    ├── helm/                  # Kubernetes Helm chart (app + ServiceMonitors/dashboards)
    ├── monitoring/            # Helm chart: kube-prometheus-stack + loki-stack + otel-collector + jaeger (k8s)
    ├── otel-collector/        # OpenTelemetry Collector config (local Docker Compose)
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
                  └──► export-service           [/api/v1/exports]
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
| **Logos** (TUM AET) | `https://logos.aet.cit.tum.de` | `openai/gpt-oss-120b` | your `lg-…` key (from your tutor) |

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

### Logos (TUM AET)

The AI deployment uses **`openai/gpt-oss-120b` via [Logos](https://logos.aet.cit.tum.de)**,
TUM AET's OpenAI-compatible gateway. Set the three variables to the Logos row above
(`LLM_API_KEY` is the `lg-…` key you receive from your tutor). Gotchas:

- The model id is `openai/gpt-oss-120b` — keep the `openai/` prefix, it is part of the id.
- Services already append `/v1/...`, so `LLM_URL` is the bare host (`https://logos.aet.cit.tum.de`), no path.
- **Network:** the prod instance is only reachable from the **TUM network** — off-campus you must be on **eduVPN**.

Smoke-test your key and list the models it may use:

```bash
# chat completion
curl -X POST https://logos.aet.cit.tum.de/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -d '{"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": "Say hi in 3 words."}]}'

# models allowed for your key
curl https://logos.aet.cit.tum.de/v1/models -H "Authorization: Bearer $LLM_API_KEY"
```

## Services

| Service           | Tech                              | Internal port | Container         |
|-------------------|-----------------------------------|---------------|-------------------|
| `client`          | React + Vite + TypeScript         | `5173`        | `client`          |
| `invoice-service` | Spring Boot (Java, JPA)           | `8080`        | `invoice-service` |
| `llm-chat`        | FastAPI (Python, LangChain)       | `8081`        | `llm-chat`        |
| `suggestions-service` | Spring Boot (Java, JPA)       | `8083`        | `suggestions-service` |
| `export-service`  | Spring Boot (Java, OpenPDF)       | `8084`        | `export-service`  |
| `auth-service`    | FastAPI (Python, Firebase Admin)  | `8000`        | `auth-service`    |
| `traefik`         | Traefik v3                        | `80` / `8090` | `traefik`         |
| `db`              | PostgreSQL 16 + pgvector          | `5432`        | `db`              |
| `otel-collector`  | OpenTelemetry Collector           | `4317`/`4318`/`8889` | `otel-collector` |
| `jaeger`          | Jaeger v2 (tracing)               | `16686`       | `jaeger`          |
| `prometheus`      | Prometheus v2.52                  | `9090`        | `prometheus`      |
| `loki`            | Grafana Loki 2.9                  | `3100`        | `loki`            |
| `grafana`         | Grafana OSS                       | `3001` (→`3000`) | `grafana`      |

`export-service` owns no schema — it is stateless and derives every export from `invoice-service`.

## Tax-year export

`InvoiceCategory` is not an arbitrary taxonomy: its values are the Werbungskosten
categories of **Anlage N**. So `export-service` produces the artifact a user actually
has to hand over, not a data dump. `GET /api/v1/exports/zip?year=2025` returns:

| Entry | What it is |
|---|---|
| `summary.pdf` | German-language summary sheet: totals per deduction category, the itemized invoices behind them, and the amount exceeding that year's Arbeitnehmer-Pauschbetrag |
| `invoices.csv` | One row per line item (RFC 4180, UTF-8 with BOM so Excel reads the umlauts) |
| `invoices.json` | The same data plus the summary figures — also the DSGVO Art. 20 portability rendering |
| `receipts/` | The original uploads, named `<documentId>-<filename>` |

`/pdf`, `/csv`, `/summary` and `/years` serve the pieces individually; the client's
Export page uses `/years` + `/summary` to preview a year before downloading it.

Three things are load-bearing:

- **Only `ACCEPTED` invoices are exported.** `PENDING` ones are unreviewed LLM
  extractions — exporting them would produce a materially wrong tax return.
- **A receipt is written once, not once per invoice.** Several line items are usually
  extracted from one upload; the PDF's `Beleg` column and the CSV's `documentId`
  both point at the single archived file.
- **The Arbeitnehmer-Pauschbetrag is configuration, not a constant** — it is set by
  legislation and moves between tax years. See `export.pauschbetrag.*` in
  [`services/export-service/src/main/resources/application.properties`](services/export-service/src/main/resources/application.properties),
  and verify the figure against current law before relying on an export.

`export-service` reads invoice-service's **public** `/api/v1` endpoints on the internal
network, forwarding the gateway-resolved `X-User-Sub`, rather than the `/internal/v1`
endpoints with a `userId` parameter. invoice-service then applies its own per-user
scoping and document-ownership checks instead of trusting the caller.

An export is rendered synchronously. That is fine at a student's scale (tens of
receipts, a few MB); if a year ever grows large enough to time out behind Traefik,
the work to do is to move `ExportService` behind a job table and return `202 + jobId`.

## Observability

Every service emits **metrics + traces over OTLP** — Java via the Spring Boot
OpenTelemetry starter (Micrometer), Python via `opentelemetry-instrument`. They
push to a central **OpenTelemetry Collector**, which fans out to Prometheus
(metrics, scraped off the collector) and **Jaeger v2** (traces). Distributed
traces follow requests across the gRPC + REST hops between services. Logs stay on
the `logstash-encoder → Promtail → Loki` path.

```
services ──OTLP──▶ otel-collector ──▶ Jaeger v2    (traces)
                                 └──▶ Prometheus   (metrics)
logs: structured JSON ──▶ Promtail ──▶ Loki
```

Local dev starts the whole stack with `docker compose up -d`. Grafana is at
`http://localhost:3001`, datasources auto-provisioned from
[`infra/grafana/provisioning/`](infra/grafana/provisioning/) (Prometheus, Loki,
Jaeger). View traces in the Jaeger UI at `http://localhost:16686`, or in Grafana
→ Explore → Jaeger; a span links straight to its logs in Loki (trace↔log
correlation).

On Kubernetes, monitoring is a separate Helm release —
[`infra/monitoring`](infra/monitoring) (kube-prometheus-stack + loki-stack +
the Collector and Jaeger) — deployed independently of the app via
[`.github/workflows/deploy-observability.yml`](.github/workflows/deploy-observability.yml).
The app injects the collector endpoint (`otel.collectorEndpoint`) and a single
ServiceMonitor scrapes the collector; a PrometheusRule and dashboard ConfigMaps
live in [`infra/helm/templates/`](infra/helm/templates/). Grafana is exposed
publicly via Traefik at `grafana.<tls.host>`, but currently has **no auth
middleware in front of it** — see [TODO.md](TODO.md).

## Setup

### Prerequisites

- Docker + Docker Compose
- An OpenAI-compatible LLM server running locally (e.g. [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com))

### 1. Configure environment

```bash
cp infra/.env.example infra/.env
```

The defaults authenticate against the bundled **Firebase Auth Emulator**, so no
Firebase project or service account is required for local dev — just fill in the
LLM, database, and Grafana values.

### Firebase Auth Emulator (local dev)

Auth runs as its own container (`firebase-auth`), started automatically by
`docker compose up`. It's an offline stand-in for production Firebase: no
service account, no real project, and you can create test users freely.

- Emulator UI: `http://127.0.0.1:4000/auth` — new sign-ups appear here instead
  of the Firebase console.
- Sign up with email/password (or the Google popup) directly in the app; the
  emulator persists users for the container's lifetime.

**To use production Firebase instead**, set the following in `infra/.env`, and
mount a service-account JSON into the `auth-service` container at
`GOOGLE_APPLICATION_CREDENTIALS`:

```
VITE_USE_FIREBASE_EMULATOR=false
FIREBASE_AUTH_EMULATOR_HOST=
FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_API_KEY=...          # plus the other VITE_FIREBASE_* values
```

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
