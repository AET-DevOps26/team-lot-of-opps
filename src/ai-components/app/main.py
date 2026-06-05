from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import date
from typing import Optional
from app.ocr import extract_text
from app.vector_store import store_embeddings, search_embeddings, update_embeddings, delete_embeddings, get_vectorstore
from app.categories import InvoiceCategory
from app.ocr_vision import pdf_to_base64_images, image_to_base64
from app.database import AsyncSessionLocal, Suggestion, Base, engine
from sqlalchemy import select
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
        await conn.run_sync(Base.metadata.create_all)
    await get_vectorstore()
    yield

app = FastAPI(title="AI Extraction service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = AsyncOpenAI(base_url=f"{LLM_URL}/v1", api_key="EMPTY", timeout=120)


class InvoiceItem(BaseModel):
    product_name: str = Field(default="N/A", description="Name of the product or service from the invoice line item")
    company: str = Field(default="N/A", description="Name of the seller/issuing company — NOT the buyer, NOT the bank, NOT an email or address")
    value: float = Field(description="Gross amount for this line item as a decimal number")
    invoice_date: Optional[date] = Field(default=None, description="Invoice date in YYYY-MM-DD format")
    category: InvoiceCategory = Field(description="Best matching German tax category")

class InvoiceList(BaseModel):
    items: list[InvoiceItem] = []

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


ITEM_FIELDS = """
Return a JSON object with a single key "items" containing a list. Each element represents one line item and has:
- product_name: name of the item or service
- company: name of the SELLER who issued this invoice. The seller is the entity that sent the invoice. Return ONLY the business or person name — a short name like "DB Fernverkehr AG", "Schmidtke", "Trüb Becker GmbH". Rules: (1) never return email addresses, phone numbers, VAT/tax IDs, IBAN numbers (starting with 2 letters + digits), or street addresses; (2) never include the words INVOICE or RECHNUNG; (3) do NOT confuse the BUYER (TO/An/Empfänger section) with the SELLER. Use the same value for every item.
- value: line item gross total as a decimal number. German invoices use comma as decimal separator — convert correctly: "418,93" → 418.93 (NOT 41893), "1.234,56" → 1234.56, "43,92" → 43.92. The comma is ALWAYS the decimal point, never strip it.
- invoice_date: date of the invoice in YYYY-MM-DD format. Convert any format: "10.10.2025" → "2025-10-10", "11 Aug 2025" → "2025-08-11". Use null only if truly absent. Use the same value for every item.
- category: best matching category for this specific item (use exact enum string, fall back to SONSTIGE_AUSGABEN if unsure)

If the invoice has no individual line items, return a single item using the invoice's overall product/service description and grand total (Summe brutto / Gesamtbetrag).
Do NOT create separate items for VAT rows, net subtotals, or tax breakdowns — only real product/service rows.

Category values:
  KONTOFUEHRUNGSGEBUEHREN, WEGE_ZUR_ARBEIT, HOMEOFFICE_UND_ARBEITSZIMMER,
  INTERNET_UND_TELEFON, ARBEITSMITTEL, BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN,
  STEUERBERATUNGSKOSTEN, REISEKOSTEN, BEWERBUNGEN, FORTBILDUNGEN,
  UMZUG, BEWIRTUNG, DOPPELTER_HAUSHALT, AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN,
  SONSTIGE_AUSGABEN
"""

VISION_LAYOUT_HINT = """
Use the VISUAL LAYOUT to identify sections:
- The SELLER (Absender/Von) is typically in the top-right corner or letterhead — this is who sent the invoice
- The BUYER (Empfänger/An) is typically in the middle-left address block — this is who received it
- Do NOT confuse the two
"""

async def call_llm(raw_text: str) -> list[InvoiceItem]:
    raw_text = raw_text[:6000]  # keep ~1500 tokens for invoice text
    prompt = f"""You are a German tax document classifier. Extract invoice line items from the text below and return valid JSON. The invoice may be in German or English.
{ITEM_FIELDS}
Invoice text:
{raw_text}"""
    for attempt in range(3):
        try:
            logger.info("LLM attempt %d/3 model=%s", attempt + 1, LLM_MODEL)
            response = await _client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_schema", "json_schema": {"name": "InvoiceList", "schema": InvoiceList.model_json_schema()}},
            )
            content = response.choices[0].message.content
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
{VISION_LAYOUT_HINT}
{ITEM_FIELDS}"""
    for attempt in range(3):
        try:
            logger.info("Vision LLM attempt %d/3 model=%s images=%d", attempt + 1, LLM_MODEL, len(images))
            msg_content = [{"type": "text", "text": prompt}]
            for img in images:
                msg_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
            response = await _client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": msg_content}],
                response_format={"type": "json_schema", "json_schema": {"name": "InvoiceList", "schema": InvoiceList.model_json_schema()}},
                temperature=0,
            )

            content = response.choices[0].message.content
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

# @app.post("/api/chat")
# async def query(request: QueryRequest):
#     chunks = await search_embeddings(request.question, user_id=request.user_id)
#     context = "\n\n".join(chunks)
#     response = await _client.chat(
#         model=LLM_MODEL,
#         messages=[
#             {"role": "system", "content": "You are a helpful German tax assistant. Answer questions based only on the provided invoice context."},
#             {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {request.question}"},
#         ],
#     )
#     return {"answer": response.message.content}

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

@app.post("/extract", response_model=list[InvoiceItem])
async def extract(file: UploadFile = File(...)):
    logger.info("POST /extract filename=%s content_type=%s", file.filename, file.content_type)
    raw_text = await extract_text(file)
    logger.info("OCR extracted %d chars from %s", len(raw_text), file.filename)
    return await call_llm(raw_text)

@app.get("/test-llm")
async def test_llm():
    response = await _client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": "say hello"}],
    )
    return {"response": response.choices[0].message.content}
