import os
import logging
from typing import AsyncIterator

import asyncpg
from langchain_ollama import ChatOllama
from langchain_core.tools import Tool
from langchain.agents import create_agent

from app.vector_store import search_embeddings
from app.categories import InvoiceCategory

logger = logging.getLogger(__name__)

DB_URL = os.getenv("DATABASE_URL")

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

SYSTEM_PROMPT = """You are a helpful German tax document assistant for the app "TaxMind". Your job is to help users find their uploaded tax documents and discover what they should still upload to maximize their German income tax refund (Einkommensteuererklärung).

Always respond in the same language the user writes in. If the user writes in German, respond in German. If in English, respond in English.

When helping users:
1. Use list_user_documents first to get an overview of what documents exist
2. Use search_documents for specific content or keyword queries
3. Use suggest_missing_documents when the user asks what they should still upload
4. Always cite specific invoices (company, date, amount) when answering"""


async def _search_documents_async(query: str, user_id: str) -> str:
    chunks = await search_embeddings(query, user_id=user_id)
    if not chunks:
        return "No matching documents found for that query."
    return "\n---\n".join(f"Result {i + 1}:\n{chunk}" for i, chunk in enumerate(chunks))


async def _list_user_documents_async(user_id: str) -> str:
    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            """
            SELECT id, item_name, company, price, category, invoice_date
            FROM invoices
            WHERE user_id = $1
            ORDER BY invoice_date DESC NULLS LAST
            """,
            user_id,
        )
    finally:
        await conn.close()

    if not rows:
        return "The user has no uploaded documents yet."

    lines = ["ID  | Item                          | Company              | Price   | Category                    | Date"]
    lines.append("-" * 105)
    for row in rows:
        inv_id = row["id"]
        item = row["item_name"]
        company = row["company"]
        price = row["price"]
        category = row["category"]
        inv_date = row["invoice_date"]
        price_str = f"{price:.2f}€" if price is not None else "N/A"
        date_str = str(inv_date) if inv_date else "N/A"
        lines.append(
            f"{str(inv_id):<4}| {str(item or '')[:30]:<30} | {str(company or '')[:20]:<20} | {price_str:<7} | {str(category or '')[:27]:<27} | {date_str}"
        )
    return "\n".join(lines)


async def _suggest_missing_documents_async(user_id: str) -> str:
    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            "SELECT DISTINCT category FROM invoices WHERE user_id = $1 AND category IS NOT NULL",
            user_id,
        )
    finally:
        await conn.close()

    present = {row["category"] for row in rows}
    all_categories = [c.value for c in InvoiceCategory]
    missing = [c for c in all_categories if c not in present]

    if not missing:
        return "Great news — the user has documents in all available tax categories!"

    lines = [f"Categories already uploaded: {', '.join(present) if present else 'none'}",
             "\nMissing categories and recommended documents to upload:"]
    for cat in missing:
        suggestion = CATEGORY_SUGGESTIONS.get(cat, "Relevante Belege einreichen")
        lines.append(f"  • {cat}: {suggestion}")
    return "\n".join(lines)


def _make_tools(user_id: str) -> list[Tool]:
    async def _async_search(query: str) -> str:
        return await _search_documents_async(query, user_id)

    async def _async_list(_: str = "") -> str:
        return await _list_user_documents_async(user_id)

    async def _async_suggest(_: str = "") -> str:
        return await _suggest_missing_documents_async(user_id)

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
        Tool(
            name="list_user_documents",
            description=(
                "Lists all invoices the user has uploaded with ID, item, company, price, "
                "category, and date. Use this first to get an overview. Input: empty string."
            ),
            func=lambda _="": "Async only — use coroutine path",
            coroutine=_async_list,
        ),
        Tool(
            name="suggest_missing_documents",
            description=(
                "Analyzes which German tax document categories the user is missing and suggests "
                "specific documents to upload to maximize their tax refund. Input: empty string."
            ),
            func=lambda _="": "Async only — use coroutine path",
            coroutine=_async_suggest,
        ),
    ]


def _build_agent(user_id: str):
    llm = ChatOllama(
        model=os.getenv("OLLAMA_MODEL", "gemma4:e2b"),
        base_url=os.getenv("OLLAMA_URL", "http://host.docker.internal:11434"),
        temperature=0.1,
    )
    tools = _make_tools(user_id)
    return create_agent(llm, tools, system_prompt=SYSTEM_PROMPT)


async def run_agent_streaming(question: str, user_id: str) -> AsyncIterator[dict]:
    agent = _build_agent(user_id)
    try:
        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": question}]},
            version="v2",
        ):
            kind = event["event"]

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                content = chunk.content
                if isinstance(content, list):
                    content = "".join(
                        c.get("text", "") for c in content if isinstance(c, dict)
                    )
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

        yield {"type": "done"}

    except Exception as e:
        logger.error("Agent error for user %s: %s", user_id, e, exc_info=True)
        yield {"type": "error", "message": str(e)}
