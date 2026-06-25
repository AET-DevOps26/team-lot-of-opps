from contextlib import asynccontextmanager
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from app.vector_store import store_embeddings, update_embeddings, delete_embeddings, get_vectorstore
from app.agent import run_agent_streaming
from starlette.responses import StreamingResponse
from openai import AsyncOpenAI
import os
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")
logger = logging.getLogger(__name__)

LLM_URL = os.getenv("LLM_URL", "http://host.docker.internal:1234")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-e2b")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_vectorstore()
    yield

app = FastAPI(title="LLM Chat service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = AsyncOpenAI(base_url=f"{LLM_URL}/v1", api_key=LLM_API_KEY, timeout=120)


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


class AgentChatRequest(BaseModel):
    question: str


class StatusResponse(BaseModel):
    status: str = "ok"


@app.post("/v1/embed", tags=["Internal"], response_model=StatusResponse,
          summary="Embed an invoice into the chat vector store")
async def embed(request: EmbedRequest):
    await store_embeddings(
        request.invoice_id, request.text, request.user_id,
        item_name=request.item_name, company=request.company, price=request.price,
        category=request.category, invoice_date=request.invoice_date, document_id=request.document_id,
    )
    return {"status": "ok"}

@app.put("/v1/embed", tags=["Internal"], response_model=StatusResponse,
         summary="Update an invoice embedding")
async def update(request: UpdateRequest):
    await update_embeddings(
        request.invoice_id, request.text, request.user_id,
        item_name=request.item_name, company=request.company, price=request.price,
        category=request.category, invoice_date=request.invoice_date, document_id=request.document_id,
    )
    return {"status": "ok"}

@app.delete("/v1/embed/{invoice_id}", tags=["Internal"], response_model=StatusResponse,
            summary="Delete an invoice embedding")
async def delete_embed(invoice_id: int):
    await delete_embeddings(invoice_id)
    return {"status": "ok"}


@app.post("/api/v1/agent/chat", tags=["Chat"],
          summary="Ask the RAG agent a question",
          response_class=StreamingResponse,
          responses={200: {"content": {"text/event-stream": {}},
                           "description": "Server-Sent Events stream of agent events"}})
async def agent_chat(request: AgentChatRequest, x_user_sub: str = Header(...)):
    async def _gen():
        async for event_dict in run_agent_streaming(request.question, x_user_sub):
            yield f"data: {json.dumps(event_dict)}\n\n"
    return StreamingResponse(_gen(), media_type="text/event-stream")


@app.get("/health", tags=["Internal"], response_model=StatusResponse, summary="Health check")
def health():
    return {"status": "ok"}

@app.get("/test-llm")
async def test_llm():
    response = await _client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": "say hello"}],
    )
    return {"response": response.choices[0].message.content}
