from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from datetime import date
from typing import Optional
from app.ocr import extract_text
from app.vector_store import store_embeddings, search_embeddings, get_all_chunks_for_user, update_embeddings
from app.categories import InvoiceCategory
import litellm
import os
import asyncio
import psycopg2

DB_URL = os.getenv("DATABASE_URL")


LLM_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
LLM_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

app = FastAPI(title="AI Extraction service", version="1.0.0")


class InvoiceExtraction(BaseModel):
    product_name: str = "N/A"
    company: str = "N/A"
    value: float
    invoice_date: Optional[date] = None
    category: InvoiceCategory

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


async def call_llm(raw_text: str) -> InvoiceExtraction:
    prompt = f"""You are a German tax document classifier. Extract the following fields from the invoice text below and return valid JSON. The invoice may be in German or English.

Fields:
- product_name: name of the product or service
- company: name of the issuing company
- value: total amount as a number (no currency symbol).  Always use the final grand total (Summe brutto in German). If multiple amounts exist, pick the largest final total. This field is required.
- invoice_date: date in YYYY-MM-DD format, or null if not found
- category: one of the following enum values that best matches the invoice (if no category clearly macthes fall back to SONSTIGE_AUSGABEN):
  KONTOFUEHRUNGSGEBUEHREN (bank account fees),
  WEGE_ZUR_ARBEIT (commute to work),
  HOMEOFFICE_UND_ARBEITSZIMMER (home office / work room),
  INTERNET_UND_TELEFON (internet and phone),
  ARBEITSMITTEL (work equipment / tools),
  BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN (professional associations / unions),
  STEUERBERATUNGSKOSTEN (tax consulting),
  REISEKOSTEN (business travel),
  BEWERBUNGEN (job applications),
  FORTBILDUNGEN (training / education),
  UMZUG (moving costs),
  BEWIRTUNG (business meals / entertainment),
  DOPPELTER_HAUSHALT (double household),
  AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN (extraordinary vehicle costs),
  SONSTIGE_AUSGABEN (other / uncategorized)

Invoice text:
{raw_text}"""
    for attempt in range(3):
        try:
            response = await litellm.acompletion(
                model=f"ollama/{LLM_MODEL}",
                messages=[{"role": "user", "content": prompt}],
                api_base=LLM_URL,
                response_format=InvoiceExtraction,
            )
            return InvoiceExtraction.model_validate_json(response.choices[0].message.content)
        except Exception as e:
            if attempt == 2:
                raise
            await asyncio.sleep(2)



@app.put("/embed")
async def update(request: UpdateRequest):
    update_embeddings(request.invoice_id, request.text)
    return {"status": "ok"}

@app.post("/embed")
async def embed(request: EmbedRequest):
    store_embeddings(request.invoice_id, request.text)
    return {"status": "ok"}

@app.post("/api/chat")
async def query(request: QueryRequest):
    chunks = search_embeddings(request.question, user_id=request.user_id)
    context = "\n\n".join(chunks)
    response = await litellm.acompletion(
            model=f"ollama/{LLM_MODEL}",
            messages=[{"role": "system", "content": "You are a helpful German tax assistant. Answer questions based only on the provided invoice context."},
                      {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {request.question}"}
            ],
            api_base=LLM_URL,
    )
    return {"answer": response.choices[0].message.content}

@app.post("/suggestions")
async def suggestions(request: SuggestionRequest):
    user_id = request.user_id
    all_invoices = get_all_chunks_for_user(user_id)
    if not all_invoices:
        return []
    response = await litellm.acompletion(
        model=f"ollama/{LLM_MODEL}",
        messages=[{"role": "system", "content": "You are a German tax document expert. Analyze the user's uploaded invoices and identify missing documents based on common tax deduction pairs: Hotel receipts suggest flight/train receipts, internet bills suggest phone bills, training courses suggest travel receipts, home office claims suggest internet bills, work equipment purchases suggest related accessories. List specific missing documents the user should upload to maximize their tax refund. Be concise and specific." },
                  {"role": "user", "content": f"Here are the user's uploaded invoices:\n{all_invoices}\n\nWhat tax documents are missing?"}
        ],
        api_base=LLM_URL,
    )
    suggestion_text = response.choices[0].message.content
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

@app.post("/extract", response_model=InvoiceExtraction)
async def extract(file: UploadFile = File(...)):
    raw_text = await extract_text(file)
    return await call_llm(raw_text)

@app.get("/test-llm")
async def test_llm():
    response = await litellm.acompletion(
        model=f"ollama/{LLM_MODEL}",
        messages=[{"role": "user", "content": "say hello"}],
        api_base=LLM_URL,
    )
    return {"response": response.choices[0].message.content}
