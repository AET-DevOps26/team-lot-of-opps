# TaxForward — Team Lot of Opps

TaxForward is a full-stack application that helps German students and trainees track study-related expenses and turn them into a future tax refund ("Verlustvortrag"). Users upload receipts and invoices; an AI pipeline extracts and classifies the line items, stores them, and surfaces suggestions for tax-deductible documents that might be missing.

## Architecture

```
src/
├── frontend/        # React + Vite + Redux + TypeScript SPA
├── backend/         # Spring Boot REST API (auth, documents, invoices, suggestions)
├── ai-components/   # FastAPI service: OCR, AI extraction, embeddings, RAG agent, suggestions
├── db/              # Postgres init scripts (pgvector-enabled)
├── scripts/         # Utility/seed scripts (e.g. test invoice generation)
└── docker-compose.yaml
```

Request flow for a typical upload: **Frontend → Backend (Spring Boot) → AI service (FastAPI)**, which performs OCR/LLM extraction and stores embeddings in Postgres (via `pgvector`). The Backend persists documents/invoices and serves the Frontend; the AI service also exposes a suggestions endpoint and a conversational RAG agent.

## Services

| Service     | Tech                                  | Port   | Container       |
|-------------|---------------------------------------|--------|-----------------|
| `frontend`  | React + Vite + Redux + TypeScript      | `5173` | `frontend`      |
| `backend`   | Spring Boot (Java, JWT auth, JPA)      | `8080` | `backend`       |
| `ai`        | FastAPI (Python, LangChain/LangGraph)  | `8081` | `ai`            |
| `db`        | PostgreSQL + pgvector                  | `5432` | `postgres_db`   |

An external OpenAI-compatible LLM endpoint (e.g. LM Studio or Ollama running on the host, reachable via `host.docker.internal`) is used for extraction, vision, and chat completions.

## Setup

1. Copy the environment template and fill in the required values (Google OAuth client ID, etc.):
```bash
cp src/.env.example src/.env
```

2. Start the full stack with Docker Compose:
```bash
cd src
docker compose up -d
```

3. Open the app at `http://localhost:5173`.

See each component's README for standalone setup and development details:
- [Frontend](src/frontend/README.md)
- [AI Components](src/ai-components/README.md)

## Notes

- The database uses Docker named volumes for persistence (`postgres_data`); uploaded files are stored on the backend's local filesystem and are **not** persisted across container recreation.
- `docker-compose.yaml.bak` is a backup of a previous compose configuration.
