import langextract as lx
import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

def extract_invoice_fields(raw_text: str) -> dict:
    extractions = lx.extract(
        text_or_documents = raw_text,
        prompt_description = "Extract the vendor name, product_name, total amount and invoice data from this invoice. The invoice may be in german or english.",
        examples=[
            lx.data.ExampleData(
                text="DB Fernverkehr AG ... Rechnungsdatum: 09.11.2025 ... Summe (brutto) 126,96 €",
                extractions=[
                    lx.data.Extraction(extraction_class="company", extraction_text="DB Fernverkehr AG"),
                    lx.data.Extraction(extraction_class="product_name", extraction_text="Hin- und Rückfahrkarte"),
                    lx.data.Extraction(extraction_class="value", extraction_text="126,96"),
                    lx.data.Extraction(extraction_class="invoice_date", extraction_text="2025-11-09"),
                ]
            )
        ],
        model_id="gemini-2.5-flash",
    )
    results = {}
    for extraction in (extractions.extractions or []):
        results[extraction.extraction_class] = extraction.extraction_text
    return results


def categorize_invoice(raw_text: str) -> str:
    # Task 5: classify into one of 15 categories
    pass
