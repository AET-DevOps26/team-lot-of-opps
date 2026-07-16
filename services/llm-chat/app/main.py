from contextlib import asynccontextmanager
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.vector_store import get_vectorstore
from app.agent import run_agent_streaming
from app.grpc_server import start_grpc_server
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
    grpc_server = await start_grpc_server()
    yield
    await grpc_server.stop(grace=None)


app = FastAPI(title="LLM Chat service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = AsyncOpenAI(base_url=f"{LLM_URL}/v1", api_key=LLM_API_KEY, timeout=120)


class ChatHistoryMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AgentChatRequest(BaseModel):
    question: str
    # Prior turns of this conversation, oldest first. Required for multi-turn flows
    # like the confirm-gated invoice edit/add tools — each request is otherwise a
    # fresh, stateless agent invocation with no memory of what it just proposed.
    history: list[ChatHistoryMessage] = []


class StatusResponse(BaseModel):
    status: str = "ok"


# Invoice embed/delete moved to gRPC — see app/grpc_server.py (EmbeddingService).


@app.post(
    "/api/v1/agent/chat",
    tags=["Chat"],
    summary="Ask the RAG agent a question",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"text/event-stream": {}},
            "description": "Server-Sent Events stream of agent events",
        }
    },
)
async def agent_chat(request: AgentChatRequest, x_user_sub: str = Header(...)):
    async def _gen():
        history = [{"role": m.role, "content": m.content} for m in request.history]
        async for event_dict in run_agent_streaming(request.question, x_user_sub, history):
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
