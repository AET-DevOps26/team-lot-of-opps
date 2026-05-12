from fastapi import FastAPI, UploadFile, File, Form
from typing import Optional
from app.ocr import extract_text
import httpx
import os

app = FastAPI(title="AI Extraction service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract")
async def extract(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None)
):
    raw_text = await extract_text(file)
    return {"raw_text": raw_text}

@app.get("/test-llm")
async def test_llm():
    ollama_url = os.getenv("OLLAMA_URL", "Http://host.docker.internal:11434")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": "llama3.2", "prompt": "say hello", "stream": False}
        )
    return response.json()