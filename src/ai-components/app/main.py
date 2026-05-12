from fastapi import FastAPI, UploadFile, File, Form
from typing import Optional
from app.ocr import extract_text
import httpx
import os
import asyncio



app = FastAPI(title="AI Extraction service", version="1.0.0")

async def call_llm(raw_text:str) -> str:
    ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={"model": ollama_model, "prompt": f"Extract the following fields from this invoice text as JSON: date, total_amount, vendor_name. Text: {raw_text}", "stream": False}
                )
            return response.json()["response"]
        except Exception as e:
            if attempt == 2:
                raise
            await asyncio.sleep(2)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract")
async def extract(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None)
):
    raw_text = await extract_text(file)
    result = await call_llm(raw_text)
    return {"user_id": user_id, "result": result}

@app.get("/test-llm")
async def test_llm():
    ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": "llama3.2", "prompt": "say hello", "stream": False}
        )
    return response.json()