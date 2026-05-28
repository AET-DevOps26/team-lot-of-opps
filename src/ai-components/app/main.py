from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from datetime import date
from typing import Optional
from app.ocr import extract_text
from app.vector_store import store_embeddings, search_embeddings, get_all_chunks_for_user, update_embeddings, delete_embeddings
from app.categories import InvoiceCategory
from app.ocr_vision import pdf_to_base64_images, image_to_base64
import ollama
import os
import asyncio
import psycopg2
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")
logger = logging.getLogger(__name__)

DB_URL = os.getenv("DATABASE_URL")

LLM_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
LLM_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
LLM_MODEL_VISION = os.getenv("OLLAMA_MODEL_VISION", "qwen3.5:4b")
LLM_THINK = os.getenv("OLLAMA_THINK", "false").lower() == "true"

app = FastAPI(title="AI Extraction service", version="1.0.0")

_client = ollama.AsyncClient(host=LLM_URL)


class InvoiceItem(BaseModel):
    product_name: str = "N/A"
    company: str = "N/A"
    value: float
    invoice_date: Optional[date] = None
    category: InvoiceCategory

class InvoiceList(BaseModel):
    items: list[InvoiceItem] = []

class EmbedRequest(BaseModel):
    invoice_id: int
    text: str

class QueryRequest(BaseModel):
    question: str
    user_id: str=None

class SuggestionRequest(BaseModel):
    user_id: str

class UpdateRequest(BaseModel):
    invoice_id: int
    text: str


ITEM_FIELDS = """
Return a JSON object with a single key "items" containing a list. Each element represents one line item and has:
- product_name: name of the item or service
- company: name of the SELLER who issued this invoice. Look in the top section labeled FROM, Absender, Von, Lieferant, or the header block above the invoice details. Return ONLY the company or person name — do NOT include words like "INVOICE", "RECHNUNG", address lines, or anything from the payment/bank section or the buyer/recipient block. Use the same value for every item.
- value: line item total as a plain number (no currency symbol). IMPORTANT: invoices may use German number format — convert correctly: "1.234,56" → 1234.56, "43,92" → 43.92.
- invoice_date: date of the invoice in YYYY-MM-DD format, or null if not found. Use the same value for every item.
- category: best matching category for this specific item (use exact enum string, fall back to SONSTIGE_AUSGABEN if unsure)

If the invoice has no individual line items, return a single item using the invoice's overall product/service description and grand total.

Category values:
  KONTOFUEHRUNGSGEBUEHREN, WEGE_ZUR_ARBEIT, HOMEOFFICE_UND_ARBEITSZIMMER,
  INTERNET_UND_TELEFON, ARBEITSMITTEL, BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN,
  STEUERBERATUNGSKOSTEN, REISEKOSTEN, BEWERBUNGEN, FORTBILDUNGEN,
  UMZUG, BEWIRTUNG, DOPPELTER_HAUSHALT, AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN,
  SONSTIGE_AUSGABEN
"""

async def call_llm(raw_text: str) -> list[InvoiceItem]:
    prompt = f"""You are a German tax document classifier. Extract invoice line items from the text below and return valid JSON. The invoice may be in German or English.
{ITEM_FIELDS}
Invoice text:
{raw_text}"""
    for attempt in range(3):
        try:
            logger.info("LLM attempt %d/3 model=%s think=%s", attempt + 1, LLM_MODEL, LLM_THINK)
            response = await _client.chat(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                format=InvoiceList.model_json_schema(),
                think=LLM_THINK,
            )
            content = response.message.content
            if not content:
                logger.warning("LLM attempt %d returned empty content", attempt + 1)
                if attempt == 2:
                    raise ValueError("LLM returned empty response after 3 attempts")
                await asyncio.sleep(2)
                continue
            logger.info("LLM returned %d chars", len(content))
            items = InvoiceList.model_validate_json(content).items
            if not items:
                logger.warning("LLM returned 0 items – raw: %s", content[:500])
            else:
                logger.info("Parsed %d invoice items", len(items))
            return items
        except Exception as e:
            logger.warning("LLM attempt %d failed: %s", attempt + 1, e)
            if attempt == 2:
                raise
            await asyncio.sleep(2)


async def call_llm_vision(images: list[str]) -> list[InvoiceItem]:
    prompt = f"""You are a German tax document classifier. Extract invoice line items from the images below and return valid JSON. The invoice may be in German or English.
{ITEM_FIELDS}"""
    for attempt in range(3):
        try:
            logger.info("Vision LLM attempt %d/3 model=%s images=%d think=%s", attempt + 1, LLM_MODEL_VISION, len(images), LLM_THINK)
            response = await _client.chat(
                model=LLM_MODEL_VISION,
                messages=[{
                    "role": "user",
                    "content": prompt,
                    "images": images,
                }],
                format="json",
                think=LLM_THINK,
            )
            content = response.message.content
            if not content:
                logger.warning("Vision LLM attempt %d returned empty content", attempt + 1)
                if attempt == 2:
                    raise ValueError("LLM returned empty response after 3 attempts")
                await asyncio.sleep(2)
                continue
            logger.info("Vision LLM returned %d chars", len(content))
            items = InvoiceList.model_validate_json(content).items
            if not items:
                logger.warning("Vision LLM returned 0 items – raw: %s", content[:500])
            else:
                logger.info("Parsed %d invoice items from vision", len(items))
            return items
        except Exception as e:
            logger.warning("Vision LLM attempt %d failed: %s", attempt + 1, e)
            if attempt == 2:
                raise
            await asyncio.sleep(2)

@app.post("/extract/vision", response_model=list[InvoiceItem])
async def extract_vision(file: UploadFile = File(...)):
    logger.info("POST /extract/vision filename=%s content_type=%s", file.filename, file.content_type)
    contents = await file.read()
    images = pdf_to_base64_images(contents) if file.content_type == "application/pdf" else image_to_base64(contents)
    logger.info("Extracted %d image(s) from %s", len(images), file.filename)
    return await call_llm_vision(images)


@app.put("/embed")
async def update(request: UpdateRequest):
    update_embeddings(request.invoice_id, request.text)
    return {"status": "ok"}

@app.delete("/embed/{invoice_id}")
async def delete_embed(invoice_id: int):
    delete_embeddings(invoice_id)
    return {"status": "ok"}

@app.post("/embed")
async def embed(request: EmbedRequest):
    store_embeddings(request.invoice_id, request.text)
    return {"status": "ok"}

@app.post("/api/chat")
async def query(request: QueryRequest):
    chunks = search_embeddings(request.question, user_id=request.user_id)
    context = "\n\n".join(chunks)
    response = await _client.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful German tax assistant. Answer questions based only on the provided invoice context."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {request.question}"},
        ],
    )
    return {"answer": response.message.content}

@app.post("/suggestions")
async def suggestions(request: SuggestionRequest):
    user_id = request.user_id
    all_invoices = get_all_chunks_for_user(user_id)
    if not all_invoices:
        return []
    response = await _client.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a German tax document expert. Analyze the user's uploaded invoices and identify missing documents based on common tax deduction pairs: Hotel receipts suggest flight/train receipts, internet bills suggest phone bills, training courses suggest travel receipts, home office claims suggest internet bills, work equipment purchases suggest related accessories. List specific missing documents the user should upload to maximize their tax refund. Be concise and specific."},
            {"role": "user", "content": f"Here are the user's uploaded invoices:\n{all_invoices}\n\nWhat tax documents are missing?"},
        ],
    )
    suggestion_text = response.message.content
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO suggestions (user_id, suggestion) VALUES (%s, %s)",
        (user_id, suggestion_text)
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"answer": suggestion_text}

@app.get("/api/suggestions")
async def get_suggestions(user_id: str):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT suggestion, created_at FROM suggestions WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,)
    )
    results = [{"suggestion": row[0], "created_at": str(row[1])} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return results

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/extract", response_model=list[InvoiceItem])
async def extract(file: UploadFile = File(...)):
    logger.info("POST /extract filename=%s content_type=%s", file.filename, file.content_type)
    raw_text = await extract_text(file)
    logger.info("OCR extracted %d chars from %s", len(raw_text), file.filename)
    return await call_llm(raw_text)

@app.get("/test-llm")
async def test_llm():
    response = await _client.chat(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": "say hello"}],
    )
    return {"response": response.message.content}
