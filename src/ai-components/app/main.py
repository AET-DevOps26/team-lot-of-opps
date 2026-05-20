from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from datetime import date
from typing import Optional
from enum import Enum
from app.ocr import extract_text
from app.vector_store import store_embeddings, search_embeddings, get_all_chunks_for_user
import litellm
import os
import asyncio


LLM_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
LLM_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

app = FastAPI(title="AI Extraction service", version="1.0.0")


class InvoiceCategory(str, Enum):
    KONTOFUEHRUNGSGEBUEHREN = "KONTOFUEHRUNGSGEBUEHREN"
    WEGE_ZUR_ARBEIT = "WEGE_ZUR_ARBEIT"
    HOMEOFFICE_UND_ARBEITSZIMMER = "HOMEOFFICE_UND_ARBEITSZIMMER"
    INTERNET_UND_TELEFON = "INTERNET_UND_TELEFON"
    ARBEITSMITTEL = "ARBEITSMITTEL"
    BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN = "BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN"
    STEUERBERATUNGSKOSTEN = "STEUERBERATUNGSKOSTEN"
    REISEKOSTEN = "REISEKOSTEN"
    BEWERBUNGEN = "BEWERBUNGEN"
    FORTBILDUNGEN = "FORTBILDUNGEN"
    UMZUG = "UMZUG"
    BEWIRTUNG = "BEWIRTUNG"
    DOPPELTER_HAUSHALT = "DOPPELTER_HAUSHALT"
    AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN = "AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN"
    SONSTIGE_AUSGABEN = "SONSTIGE_AUSGABEN"


class InvoiceExtraction(BaseModel):
    product_name: str
    company: str
    value: float
    invoice_date: Optional[date] = None
    category: InvoiceCategory

class EmbedRequest(BaseModel):
    invoice_id: int
    text: str

class QueryRequest(BaseModel):
    question: str

class SuggestionRequest(BaseModel):
    user_id: str


async def call_llm(raw_text: str) -> InvoiceExtraction:
    prompt = f"""You are a German tax document classifier. Extract the following fields from the invoice text below and return valid JSON.

Fields:
- product_name: name of the product or service
- company: name of the issuing company
- value: total amount as a number (no currency symbol)
- invoice_date: date in YYYY-MM-DD format, or null if not found
- category: one of the following enum values that best matches the invoice:
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



@app.post("/embed")
async def embed(request: EmbedRequest):
    store_embeddings(request.invoice_id, request.text)
    return {"status": "ok"}

@app.post("/query")
async def query(request: QueryRequest):
    chunks = search_embeddings(request.question)
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
        messages=[{"role": "system", "content": "You are a German tax document expert. You are given text of invoices the client already uploaded. Your goal is to check the invoices and then suggest which other tax documents are missing." },
                  {"role": "user", "content": f"Context: {all_invoices}."} 
        ],
        api_base=LLM_URL,
    )
    return {"answer": response.choices[0].message.content}

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
