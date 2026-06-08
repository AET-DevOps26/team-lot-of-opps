# AI Components - Team Lot of Opps

FastAPI service that handles document OCR, AI-based invoice extraction, retrieval-augmented suggestions, and a conversational agent for TaxForward.

## Project Structure

```
app/
├── main.py          # FastAPI app, routes (/extract, /extract/vision, /embed, /suggestions, /api/agent/chat, ...)
├── agent.py         # LangGraph/LangChain conversational agent (RAG over a user's invoices)
├── ocr.py           # Text extraction from PDFs/images (pdfplumber + pytesseract)
├── ocr_vision.py    # PDF/image → base64 conversion for vision-model extraction
├── vector_store.py  # PGVector-backed embedding store (chunking, search, CRUD)
├── categories.py    # German tax-deductible expense category enum
└── database.py      # Async SQLAlchemy engine/session + Suggestion model

tests/
├── test_unit.py                  # Unit tests
├── test_ocr.py                   # OCR extraction accuracy tests
├── test_integration_rag.py       # RAG/embedding integration tests
└── test_integration_suggestions.py # Suggestions endpoint integration tests
```

## Setup

This service is normally run as part of the full stack via Docker Compose (see `src/docker-compose.yaml`, service `ai`). To run it standalone:

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set the required environment variables:
```bash
DATABASE_URL=postgresql://appuser:password@localhost:5432/app_db
LLM_URL=http://localhost:1234       # OpenAI-compatible endpoint (e.g. LM Studio, Ollama)
LLM_MODEL=google/gemma-4-e2b
```

3. Start the development server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

The service will be available at `http://localhost:8081` (health check at `/health`).

## Endpoints

- `POST /extract` - OCR + LLM extraction of invoice line items from a PDF/image
- `POST /extract/vision` - Vision-model extraction directly from page images (no OCR step)
- `POST /embed` / `PUT /embed` / `DELETE /embed/{id}` - Store/update/delete an invoice's embedding + metadata
- `POST /suggestions` - Generate AI suggestions for missing tax-deduction documents based on recent invoices
- `GET /api/suggestions` - Fetch a user's stored suggestion history
- `POST /api/agent/chat` - Streaming conversational agent (search documents, list invoices, suggest missing documents)

## Tests

Run the test suite with:
```bash
pytest
```

## Technologies

- **FastAPI** - Web framework
- **OpenAI SDK** - Chat/vision completions against an OpenAI-compatible LLM endpoint
- **LangChain / LangGraph** - Conversational agent and retrieval-augmented generation
- **langchain-postgres (PGVector)** - Vector store for invoice embeddings
- **sentence-transformers** - Local embedding model (`all-MiniLM-L6-v2`)
- **pdfplumber / pytesseract / PyMuPDF (fitz)** - OCR and PDF/image processing
- **SQLAlchemy (async) + asyncpg** - Database access
- **pytest** - Testing

## Notes

- `Dockerfile` builds the production image; `Dockerfile.dev` runs `uvicorn` with `--reload` for local development (used by `docker-compose.yaml`).
- The service expects an OpenAI-compatible LLM server reachable at `LLM_URL` (e.g. LM Studio running on the host, exposed to containers via `host.docker.internal`).
