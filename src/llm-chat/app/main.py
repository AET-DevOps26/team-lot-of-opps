from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import date
from typing import Optional
from app.vector_store import store_embeddings, search_embeddings, update_embeddings, delete_embeddings, get_vectorstore
from app.categories import InvoiceCategory
from app.database import AsyncSessionLocal, Suggestion, Base, engine
from sqlalchemy import select, text
from app.agent import run_agent_streaming
from starlette.responses import StreamingResponse
from openai import AsyncOpenAI
import os
import asyncio
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")
logger = logging.getLogger(__name__)

DB_URL = os.getenv("DATABASE_URL")

LLM_URL = os.getenv("LLM_URL", "http://host.docker.internal:1234")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-e2b")

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    await get_vectorstore()
    yield

app = FastAPI(title="LLM Chat service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = AsyncOpenAI(base_url=f"{LLM_URL}/v1", api_key="EMPTY", timeout=120)


class EmbedRequest(BaseModel):
    invoice_id: int
    text: str
    user_id: str
    item_name: str = "N/A"
    company: str = "N/A"
    price: Optional[float] = None
    category: Optional[str] = None
    invoice_date: Optional[str] = None
    document_id: Optional[int] = None

class QueryRequest(BaseModel):
    question: str
    user_id: Optional[str] = None

class SuggestionInvoiceItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    item_name: str = "N/A"
    company: str = "N/A"
    price: Optional[float] = None
    invoice_date: Optional[date] = None
    category: Optional[str] = None


class SuggestionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    user_id: str
    items: list[SuggestionInvoiceItem] = []

class UpdateRequest(BaseModel):
    invoice_id: int
    text: str
    user_id: str
    item_name: str = "N/A"
    company: str = "N/A"
    price: Optional[float] = None
    category: Optional[str] = None
    invoice_date: Optional[str] = None
    document_id: Optional[int] = None


@app.put("/embed")
async def update(request: UpdateRequest):
    await update_embeddings(
        request.invoice_id, request.text, request.user_id,
        item_name=request.item_name, company=request.company, price=request.price,
        category=request.category, invoice_date=request.invoice_date, document_id=request.document_id,
    )
    return {"status": "ok"}

@app.delete("/embed/{invoice_id}")
async def delete_embed(invoice_id: int):
    await delete_embeddings(invoice_id)
    return {"status": "ok"}

@app.post("/embed")
async def embed(request: EmbedRequest):
    await store_embeddings(
        request.invoice_id, request.text, request.user_id,
        item_name=request.item_name, company=request.company, price=request.price,
        category=request.category, invoice_date=request.invoice_date, document_id=request.document_id,
    )
    return {"status": "ok"}

@app.post("/suggestions")
async def suggestions(request: SuggestionRequest):
    user_id = request.user_id

    if not request.items:
        return {"answer": ""}

    context = "\n".join(
        f"- {item.item_name} | {item.company} | {item.price or ''} EUR | {item.category or ''} | {item.invoice_date or ''}"
        for item in request.items
    )

    response = await _client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": """You are a German tax expert helping students maximize their tax refund.
Analyze the uploaded invoices and identify missing documents based on these German tax deduction pairs:
- Hotel receipt → flight/train receipt (Reisekosten require both)
- Train/flight receipt → hotel receipt
- Internet bill → phone bill (both deductible for home office)
- Work equipment (laptop, desk) → software licenses, accessories
- Training/course receipt → travel receipt to the training location
- Home office claim → internet bill
- Conference registration → travel + hotel receipts
- Business meal → names of attendees and business purpose

Give 2-4 specific, actionable suggestions. Reference actual items from the invoices where possible (e.g., "You uploaded a hotel in Berlin — do you have the train or flight receipt?"). Be concise."""},
            {"role": "user", "content": f"Here are the user's uploaded invoices:\n{context}\n\nWhat tax documents are missing? Give specific suggestions."},
        ],
    )
    suggestion_text = response.choices[0].message.content

    async with AsyncSessionLocal() as db:
        db.add(Suggestion(user_id=user_id, suggestion=suggestion_text))
        await db.commit()

    return {"answer": suggestion_text}

@app.get("/api/suggestions")
async def get_suggestions(user_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Suggestion)
            .where(Suggestion.user_id == user_id)
            .order_by(Suggestion.created_at.desc())
        )
        rows = result.scalars().all()
    return [{"suggestion": r.suggestion, "created_at": str(r.created_at)} for r in rows]

class AgentChatRequest(BaseModel):
    question: str
    user_id: str


@app.post("/api/agent/chat")
async def agent_chat(request: AgentChatRequest):
    async def _gen():
        async for event_dict in run_agent_streaming(request.question, request.user_id):
            yield f"data: {json.dumps(event_dict)}\n\n"
    return StreamingResponse(_gen(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/test-llm")
async def test_llm():
    response = await _client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": "say hello"}],
    )
    return {"response": response.choices[0].message.content}
