from fastapi import FastAPI, UploadFile, File, Form
from typing import Optional
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
    return {
        "user_id": user_id or "unknown",
        "product_name": "Test Product",
        "company": "Test Company",
        "value": "99.99",
        "invoice_date": "2024-01-15"
    }

@app.get("/test-llm")
async def test_llm():
    ollama_url = os.getenv("OLLAMA_URL", "Http://host.docker.internal:11434")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": "llama3.2", "prompt": "say hello", "stream": False}
        )
    return response.json()