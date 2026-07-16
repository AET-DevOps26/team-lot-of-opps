import os
import logging
import difflib
from typing import AsyncIterator

import grpc
from langchain_openai import ChatOpenAI
from langchain_core.tools import Tool, StructuredTool
from langchain.agents import create_agent
from pydantic import BaseModel

from app.vector_store import search_embeddings
from app.categories import InvoiceCategory
from app.grpc_gen import invoice_pb2, invoice_pb2_grpc

logger = logging.getLogger(__name__)

INVOICE_SERVICE_GRPC_URL = os.getenv("INVOICE_SERVICE_GRPC_URL", "invoice-service:9090")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")

_invoice_stub: invoice_pb2_grpc.InternalInvoiceServiceStub | None = None


def _get_invoice_stub() -> invoice_pb2_grpc.InternalInvoiceServiceStub:
    # Lazily create one shared channel/stub; reused across calls.
    global _invoice_stub
    if _invoice_stub is None:
        channel = grpc.aio.insecure_channel(INVOICE_SERVICE_GRPC_URL)
        _invoice_stub = invoice_pb2_grpc.InternalInvoiceServiceStub(channel)
    return _invoice_stub


CATEGORY_SUGGESTIONS: dict[str, str] = {
    "WEGE_ZUR_ARBEIT": "Tankquittungen, Bahntickets oder ÖPNV-Monatskarten für den Arbeitsweg",
    "HOMEOFFICE_UND_ARBEITSZIMMER": "Mietanteil-Berechnung, Strom- und Heizkostenabrechnung für das Arbeitszimmer",
    "INTERNET_UND_TELEFON": "Telefonrechnung, Internetrechnung (anteilig beruflich absetzbar)",
    "ARBEITSMITTEL": "Quittungen für Büromaterial, Hardware, Fachbücher oder Berufskleidung",
    "REISEKOSTEN": "Hotelrechnungen, Flug- oder Bahntickets für Dienstreisen, Taxiquittungen",
    "FORTBILDUNGEN": "Kursgebühren, Seminarrechnungen, Fachbücher oder Online-Kurs-Belege",
    "BEWIRTUNG": "Restaurantquittungen für Geschäftsessen (nur 70 % absetzbar, Teilnehmer dokumentieren)",
    "STEUERBERATUNGSKOSTEN": "Rechnung vom Steuerberater oder Lohnsteuerhilfeverein",
    "BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN": "Mitgliedsbeitrags-Nachweis von Gewerkschaft oder Berufsverband",
    "KONTOFUEHRUNGSGEBUEHREN": "Jahreskontoauszug oder Kontogebühren-Nachweis Ihrer Bank",
    "BEWERBUNGEN": "Bewerbungsmappenkosten, Fahrtkosten zu Vorstellungsgesprächen",
    "UMZUG": "Umzugsrechnungen (nur wenn beruflich veranlasst)",
    "DOPPELTER_HAUSHALT": "Mietvertrag und Rechnungen für die Zweitwohnung am Arbeitsort",
    "AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN": "Werkstattrechnungen für außergewöhnliche Kfz-Kosten (Unfall, größere Reparatur)",
    "SONSTIGE_AUSGABEN": "Sonstige berufsbedingte Ausgaben mit Belegen",
}

EDITABLE_INVOICE_FIELDS = {"item_name", "price", "category"}


def _resolve_category(raw: str) -> str | None:
    # LLMs occasionally misspell/abbreviate the exact enum name (e.g. dropping a
    # letter from WEGE_ZUR_ARBEIT). Snap close matches to the real value instead of
    # hard-failing on a near-correct guess.
    normalized = raw.strip().upper().replace(" ", "_")
    if normalized in CATEGORY_SUGGESTIONS:
        return normalized
    matches = difflib.get_close_matches(normalized, CATEGORY_SUGGESTIONS.keys(), n=1, cutoff=0.75)
    return matches[0] if matches else None


SYSTEM_PROMPT = """You are a helpful German tax document assistant for the app "TaxForward". Your job is to help users find their uploaded tax documents, discover what they should still upload to maximize their German income tax refund (Einkommensteuererklärung), add invoices they describe to you directly, and correct mistakes on invoices they've already uploaded.

Always respond in the same language the user writes in. If the user writes in German, respond in German. If in English, respond in English.

When helping users:
1. Use list_user_documents first to get an overview of what documents exist
2. Use search_documents for specific content or keyword queries
3. Use suggest_missing_documents when the user asks what they should still upload
4. Use summarize_invoice_categories when the user asks what they've spent by category
5. Use explain_deduction_rule when the user asks why or how a category is deductible
6. Use check_duplicate_invoices when the user asks to check for duplicate invoices
7. Always cite specific invoices (company, date, amount) when answering

Editing an invoice, and adding a new one, both apply immediately — call edit_invoice /
add_invoice as soon as the user asks, with no separate confirmation step. If the user asks to
change or add several invoices at once, call the tool separately for EACH one — one call per
invoice, never skip any.

CRITICAL: after calling edit_invoice or add_invoice, read its returned text carefully. If it
starts with "Could not" or "Unknown", the change FAILED — you must tell the user it failed and
why, and never claim it succeeded. Only report success if the tool result literally confirms the
update/creation (e.g. starts with "Updated invoice" or "Created invoice"). Never say a change was
made unless every single tool call for it actually returned success."""


async def _search_documents_async(query: str, user_id: str, referenced: list[dict]) -> str:
    docs = await search_embeddings(query, user_id=user_id)
    if not docs:
        return "No matching documents found for that query."
    for doc in docs:
        meta = doc.metadata
        invoice_id = meta.get("invoice_id")
        if invoice_id is not None:
            referenced.append(
                {
                    "invoice_id": invoice_id,
                    "item_name": meta.get("item_name"),
                    "company": meta.get("company"),
                    "price": meta.get("price"),
                    "category": meta.get("category"),
                    "invoice_date": meta.get("invoice_date"),
                    "document_id": meta.get("document_id"),
                }
            )
    return "\n---\n".join(f"Result {i + 1}:\n{doc.page_content}" for i, doc in enumerate(docs))


async def _fetch_invoices(user_id: str) -> list[dict]:
    # Calls invoice-service's InternalInvoiceService.GetLatestInvoices over gRPC.
    # Returns the same camelCase dict shape the REST endpoint used to, so the
    # consumers below stay unchanged.
    resp = await _get_invoice_stub().GetLatestInvoices(
        invoice_pb2.GetLatestInvoicesRequest(user_id=user_id, limit=1000),
        timeout=10.0,
    )
    return [
        {
            "id": inv.id,
            "itemName": inv.item_name,
            "company": inv.company,
            "price": inv.price,
            "category": inv.category,
            "invoiceDate": inv.invoice_date if inv.HasField("invoice_date") else None,
            "documentId": inv.document_id if inv.HasField("document_id") else None,
        }
        for inv in resp.invoices
    ]


async def _list_user_documents_async(user_id: str, referenced: list[dict]) -> str:
    invoices = await _fetch_invoices(user_id)

    if not invoices:
        return "The user has no uploaded documents yet."

    for inv in invoices:
        referenced.append(
            {
                "invoice_id": inv.get("id"),
                "item_name": inv.get("itemName"),
                "company": inv.get("company"),
                "price": float(inv["price"]) if inv.get("price") is not None else None,
                "category": inv.get("category"),
                "invoice_date": inv.get("invoiceDate"),
                "document_id": inv.get("documentId"),
            }
        )

    lines = [
        "ID  | Item                          | Company              | Price   | Category                    | Date"
    ]
    lines.append("-" * 105)
    for inv in invoices:
        inv_id = inv.get("id")
        item = inv.get("itemName")
        company = inv.get("company")
        price = inv.get("price")
        category = inv.get("category")
        inv_date = inv.get("invoiceDate")
        price_str = f"{float(price):.2f}€" if price is not None else "N/A"
        date_str = str(inv_date) if inv_date else "N/A"
        lines.append(
            f"{str(inv_id):<4}| {str(item or '')[:30]:<30} | {str(company or '')[:20]:<20} | {price_str:<7} | {str(category or '')[:27]:<27} | {date_str}"
        )
    return "\n".join(lines)


async def _suggest_missing_documents_async(user_id: str) -> str:
    invoices = await _fetch_invoices(user_id)
    present = {inv["category"] for inv in invoices if inv.get("category")}
    all_categories = [c.value for c in InvoiceCategory]
    missing = [c for c in all_categories if c not in present]

    if not missing:
        return "Great news — the user has documents in all available tax categories!"

    lines = [
        f"Categories already uploaded: {', '.join(present) if present else 'none'}",
        "\nMissing categories and recommended documents to upload:",
    ]
    for cat in missing:
        suggestion = CATEGORY_SUGGESTIONS.get(cat, "Relevante Belege einreichen")
        lines.append(f"  • {cat}: {suggestion}")
    return "\n".join(lines)


_INVOICE_FIELD_TO_PROTO = {"item_name": "item_name", "price": "price", "category": "category"}
_INVOICE_FIELD_TO_LEGACY_KEY = {"item_name": "itemName", "price": "price", "category": "category"}


def _invalid_field_message(field: str) -> str:
    return f"Cannot edit field '{field}'. Editable fields are: {', '.join(sorted(EDITABLE_INVOICE_FIELDS))}."


async def _edit_invoice_async(invoice_id: int, field: str, new_value: str, user_id: str) -> str:
    # Writes the change immediately via invoice-service's UpdateInvoice RPC.
    if field not in EDITABLE_INVOICE_FIELDS:
        return _invalid_field_message(field)
    if field == "category":
        resolved = _resolve_category(new_value)
        if resolved is None:
            valid = ", ".join(sorted(CATEGORY_SUGGESTIONS.keys()))
            return f"Unknown category '{new_value}'. Valid categories: {valid}"
        new_value = resolved
    request = invoice_pb2.UpdateInvoiceRequest(user_id=user_id, invoice_id=invoice_id)
    setattr(request, _INVOICE_FIELD_TO_PROTO[field], new_value)
    try:
        resp = await _get_invoice_stub().UpdateInvoice(request, timeout=10.0)
    except grpc.RpcError as e:
        detail = e.details() if hasattr(e, "details") else str(e)
        return f"Could not update invoice {invoice_id}: {detail}"
    return f"Updated invoice {resp.invoice.id}: {field} is now '{new_value}'."


async def _add_invoice_async(
    item_name: str,
    company: str,
    price: str,
    category: str,
    user_id: str,
    invoice_date: str | None = None,
) -> str:
    # Creates the invoice immediately via invoice-service's CreateInvoice RPC.
    resolved_category = _resolve_category(category)
    if resolved_category is None:
        valid = ", ".join(sorted(CATEGORY_SUGGESTIONS.keys()))
        return f"Unknown category '{category}'. Valid categories: {valid}"
    try:
        float(price)
    except ValueError:
        return f"'{price}' is not a valid price."
    request_kwargs = {
        "user_id": user_id,
        "item_name": item_name,
        "company": company,
        "price": price,
        "category": resolved_category,
    }
    if invoice_date:
        request_kwargs["invoice_date"] = invoice_date
    try:
        resp = await _get_invoice_stub().CreateInvoice(
            invoice_pb2.CreateInvoiceRequest(**request_kwargs),
            timeout=10.0,
        )
    except grpc.RpcError as e:
        detail = e.details() if hasattr(e, "details") else str(e)
        return f"Could not create invoice: {detail}"
    return f"Created invoice {resp.invoice.id}: {item_name} from {company}, {price}€."


async def _summarize_invoice_categories_async(user_id: str) -> str:
    invoices = await _fetch_invoices(user_id)
    if not invoices:
        return "No accepted invoices yet to summarize."

    sums: dict[str, float] = {}
    for inv in invoices:
        category = inv.get("category") or "SONSTIGE_AUSGABEN"
        price = float(inv["price"]) if inv.get("price") is not None else 0.0
        sums[category] = sums.get(category, 0.0) + price

    lines = ["Spending by category (accepted invoices only):"]
    for category, total in sorted(sums.items(), key=lambda kv: -kv[1]):
        lines.append(f"  • {category}: {total:.2f}€")
    lines.append(
        "\nNote: these are spending totals, not a tax refund estimate — no official "
        "German deduction rates/Pauschale amounts are configured yet."
    )
    return "\n".join(lines)


async def _explain_deduction_rule_async(category: str) -> str:
    resolved = _resolve_category(category)
    if resolved is None:
        valid = ", ".join(sorted(CATEGORY_SUGGESTIONS.keys()))
        return f"Unknown category '{category}'. Valid categories: {valid}"
    return f"{resolved}: {CATEGORY_SUGGESTIONS[resolved]}"


async def _check_duplicate_invoices_async(
    company: str, price: str, user_id: str, invoice_date: str | None = None
) -> str:
    request_kwargs = {"user_id": user_id, "company": company, "price": price}
    if invoice_date:
        request_kwargs["invoice_date"] = invoice_date
    try:
        resp = await _get_invoice_stub().FindPotentialDuplicates(
            invoice_pb2.FindPotentialDuplicatesRequest(**request_kwargs),
            timeout=10.0,
        )
    except grpc.RpcError as e:
        detail = e.details() if hasattr(e, "details") else str(e)
        return f"Could not check for duplicates: {detail}"
    if not resp.invoices:
        return f"No potential duplicates found for {company} at {price}."
    lines = [f"Found {len(resp.invoices)} potential duplicate(s):"]
    for inv in resp.invoices:
        date_str = inv.invoice_date if inv.HasField("invoice_date") else "no date"
        lines.append(f"  • id={inv.id} {inv.item_name} ({inv.company}, {inv.price}€, {date_str})")
    return "\n".join(lines)


class _EmptyInput(BaseModel):
    pass


class _EditInvoiceInput(BaseModel):
    invoice_id: int
    field: str
    new_value: str


class _AddInvoiceInput(BaseModel):
    item_name: str
    company: str
    price: str
    category: str
    invoice_date: str | None = None


class _ExplainDeductionRuleInput(BaseModel):
    category: str


class _CheckDuplicateInvoicesInput(BaseModel):
    company: str
    price: str
    invoice_date: str | None = None


def _make_tools(user_id: str, referenced: list[dict]) -> list[Tool]:
    async def _async_search(query: str) -> str:
        return await _search_documents_async(query, user_id, referenced)

    async def _async_list() -> str:
        return await _list_user_documents_async(user_id, referenced)

    async def _async_suggest() -> str:
        return await _suggest_missing_documents_async(user_id)

    async def _async_edit_invoice(invoice_id: int, field: str, new_value: str) -> str:
        return await _edit_invoice_async(invoice_id, field, new_value, user_id)

    async def _async_add_invoice(
        item_name: str, company: str, price: str, category: str, invoice_date: str | None = None
    ) -> str:
        return await _add_invoice_async(item_name, company, price, category, user_id, invoice_date)

    async def _async_summarize_categories() -> str:
        return await _summarize_invoice_categories_async(user_id)

    async def _async_explain_rule(category: str) -> str:
        return await _explain_deduction_rule_async(category)

    async def _async_check_duplicates(
        company: str, price: str, invoice_date: str | None = None
    ) -> str:
        return await _check_duplicate_invoices_async(company, price, user_id, invoice_date)

    return [
        Tool(
            name="search_documents",
            description=(
                "Semantic search over the user's uploaded invoice documents. "
                "Use to find specific invoices by company name, product, service, or date. "
                "Input: a natural language search query string."
            ),
            func=lambda _: "Async only — use coroutine path",
            coroutine=_async_search,
        ),
        StructuredTool(
            name="list_user_documents",
            description=(
                "Lists all invoices the user has uploaded with ID, item, company, price, "
                "category, and date. Use this first to get an overview. No input required."
            ),
            args_schema=_EmptyInput,
            func=lambda: "Async only — use coroutine path",
            coroutine=_async_list,
        ),
        StructuredTool(
            name="suggest_missing_documents",
            description=(
                "Analyzes which German tax document categories the user is missing and suggests "
                "specific documents to upload to maximize their tax refund. No input required."
            ),
            args_schema=_EmptyInput,
            func=lambda: "Async only — use coroutine path",
            coroutine=_async_suggest,
        ),
        StructuredTool(
            name="edit_invoice",
            description=(
                "Immediately changes one field (item_name, price, or category) of an existing "
                "invoice — no separate confirmation step, call this as soon as the user asks. "
                "Input: invoice_id (int), field (one of item_name/price/category), new_value (string)."
            ),
            args_schema=_EditInvoiceInput,
            func=lambda **_: "Async only — use coroutine path",
            coroutine=_async_edit_invoice,
        ),
        StructuredTool(
            name="add_invoice",
            description=(
                "Immediately creates a new invoice — no separate confirmation step, call this as "
                "soon as the user describes the invoice. Input: item_name (string), company "
                "(string), price (string, e.g. '9.99'), category (enum name, e.g. ARBEITSMITTEL), "
                "invoice_date (optional ISO date)."
            ),
            args_schema=_AddInvoiceInput,
            func=lambda **_: "Async only — use coroutine path",
            coroutine=_async_add_invoice,
        ),
        StructuredTool(
            name="summarize_invoice_categories",
            description=(
                "Sums the user's accepted invoices by tax category. Use when the user asks what "
                "they've spent by category. Does not estimate a tax refund. No input required."
            ),
            args_schema=_EmptyInput,
            func=lambda: "Async only — use coroutine path",
            coroutine=_async_summarize_categories,
        ),
        StructuredTool(
            name="explain_deduction_rule",
            description=(
                "Explains why/how a given German tax category is deductible. "
                "Input: category (the category enum name, e.g. BEWIRTUNG)."
            ),
            args_schema=_ExplainDeductionRuleInput,
            func=lambda **_: "Async only — use coroutine path",
            coroutine=_async_explain_rule,
        ),
        StructuredTool(
            name="check_duplicate_invoices",
            description=(
                "Flags the user's existing invoices that match a given company, price, and "
                "(optionally) date — a likely duplicate submission. "
                "Input: company (string), price (string, e.g. '9.99'), invoice_date (optional ISO date)."
            ),
            args_schema=_CheckDuplicateInvoicesInput,
            func=lambda **_: "Async only — use coroutine path",
            coroutine=_async_check_duplicates,
        ),
    ]


def _build_agent(user_id: str, referenced: list[dict]):
    vllm_url = os.getenv("LLM_URL", "http://host.docker.internal:1234")
    llm = ChatOpenAI(
        model=os.getenv("LLM_MODEL", "google/gemma-4-e2b"),
        base_url=f"{vllm_url}/v1",
        api_key=LLM_API_KEY,
        temperature=0.1,
        timeout=120,
    )
    tools = _make_tools(user_id, referenced)
    return create_agent(llm, tools, system_prompt=SYSTEM_PROMPT)


async def run_agent_streaming(
    question: str, user_id: str, history: list[dict] | None = None
) -> AsyncIterator[dict]:
    referenced_invoices: list[dict] = []
    try:
        agent = _build_agent(user_id, referenced_invoices)
        messages = [*(history or []), {"role": "user", "content": question}]
        async for event in agent.astream_events(
            {"messages": messages},
            version="v2",
        ):
            kind = event["event"]

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                content = chunk.content
                if isinstance(content, list):
                    content = "".join(c.get("text", "") for c in content if isinstance(c, dict))
                if content:
                    yield {"type": "token", "content": content}

            elif kind == "on_tool_start":
                tool_input = event["data"].get("input", "")
                yield {
                    "type": "tool_start",
                    "tool": event["name"],
                    "input": str(tool_input)[:200],
                }

            elif kind == "on_tool_end":
                tool_output = str(event["data"].get("output", ""))
                yield {
                    "type": "tool_end",
                    "tool": event["name"],
                    "result": tool_output[:500] + ("..." if len(tool_output) > 500 else ""),
                }

        seen: set[int] = set()
        unique: list[dict] = []
        for inv in referenced_invoices:
            iid = inv.get("invoice_id")
            if iid is not None and iid not in seen:
                seen.add(iid)
                unique.append(inv)
        if unique:
            yield {"type": "references", "invoices": unique}

        yield {"type": "done"}

    except Exception as e:
        logger.error("Agent error for user %s: %s", user_id, e, exc_info=True)
        yield {"type": "error", "message": str(e)}
