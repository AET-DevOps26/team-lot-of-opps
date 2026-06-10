# TaxForward — Team Lot of Opps

TaxForward is a full-stack application that helps German students and trainees track study-related expenses and turn them into a future tax refund ("Verlustvortrag"). Users upload receipts and invoices; an AI pipeline extracts and classifies the line items, stores them, and surfaces suggestions for tax-deductible documents that might be missing.

## Architecture

```
src/
├── frontend/            # React + Vite + Redux + TypeScript SPA
├── invoice-service/     # Spring Boot REST API — document upload, OCR, invoice persistence
├── llm-chat/            # FastAPI — conversational RAG agent + suggestions (pgvector)
├── auth-service/        # FastAPI — Firebase token verification (Traefik forward-auth)
├── traefik/             # Reverse proxy config — routing + auth middleware
├── scripts/             # Utility/seed scripts
└── docker-compose.yaml
```

All API traffic flows through **Traefik**, which enforces Firebase authentication via a forward-auth middleware before proxying to the relevant service:

```
Browser → Traefik ──► auth-service (/verify)   [validates Firebase ID token]
                  └──► invoice-service          [/api/documents, /api/invoices]
                  └──► llm-chat                 [/api/chat]
```

An external OpenAI-compatible LLM endpoint (e.g. LM Studio or Ollama on the host, reachable via `host.docker.internal`) is used for OCR extraction, vision, and chat completions.

## Services

| Service           | Tech                              | Internal port | Container         |
|-------------------|-----------------------------------|---------------|-------------------|
| `frontend`        | React + Vite + TypeScript         | `5173`        | `frontend`        |
| `invoice-service` | Spring Boot (Java, JPA)           | `8080`        | `invoice-service` |
| `llm-chat`        | FastAPI (Python, LangChain)       | `8081`        | `llm-chat`        |
| `auth-service`    | FastAPI (Python, Firebase Admin)  | `8000`        | `auth-service`    |
| `traefik`         | Traefik v3                        | `80` / `8090` | `traefik`         |
| `db-invoice`      | PostgreSQL 16                     | `5432`        | `db-invoice`      |
| `db-llm-chat`     | PostgreSQL 16 + pgvector          | `5432`        | `db-llm-chat`     |

## Setup

### Prerequisites

- Docker + Docker Compose
- A Firebase project with Authentication enabled (Email/Password at minimum)
- An OpenAI-compatible LLM server running locally (e.g. [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com))

### 1. Configure environment

```bash
cp src/.env.example src/.env
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

For local dev, use the Firebase Auth Emulator (see below) — no service account needed. For production, place your Firebase service account JSON at `src/auth-service/` and update `GOOGLE_APPLICATION_CREDENTIALS` in `docker-compose.yaml` to point to it.

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

**Enable emulator mode in `src/.env`:**
```
VITE_USE_FIREBASE_EMULATOR=true
FIREBASE_AUTH_EMULATOR_HOST=host.docker.internal:9099
```

The defaults in `src/.env.example` have both flags set to `false`/empty (production mode).

Emulator UI: `http://127.0.0.1:4000/auth` — new sign-ups appear here instead of the Firebase console.

### 2. Start the stack

```bash
cd src
docker compose up -d
```

### 3. Open the app

`http://localhost:5173`

---

## Notes

- Each database service uses a Docker named volume (`postgres_invoice`, `postgres_llm_chat`) for persistence across restarts.
- Uploaded files are stored on the `invoice-service` container filesystem and are **not** persisted across container recreation.
- The Traefik dashboard is available at `http://localhost:8090`.
