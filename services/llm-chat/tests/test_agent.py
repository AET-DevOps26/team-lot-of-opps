"""
Unit tests for app.agent — the RAG tool functions and streaming loop.
External calls (vector search, invoice-service HTTP) are mocked at the
module boundary. Run with: pytest tests/test_agent.py -v
"""

import asyncio

from langchain_core.documents import Document

from app import agent


def run(coro):
    return asyncio.run(coro)


class TestSearchDocumentsAsync:
    def test_no_matches_returns_not_found_message(self, monkeypatch):
        monkeypatch.setattr(agent, "search_embeddings", _async_return([]))
        referenced = []

        result = run(agent._search_documents_async("hotels", "user-1", referenced))

        assert result == "No matching documents found for that query."
        assert referenced == []

    def test_matches_are_formatted_and_referenced(self, monkeypatch):
        doc = Document(
            page_content="Hotel Ibis Berlin, 320 EUR",
            metadata={
                "invoice_id": 7,
                "item_name": "Hotel Ibis",
                "company": "Ibis",
                "price": 320.0,
                "category": "REISEKOSTEN",
                "invoice_date": "2026-05-01",
                "document_id": 3,
            },
        )
        monkeypatch.setattr(agent, "search_embeddings", _async_return([doc]))
        referenced = []

        result = run(agent._search_documents_async("hotels", "user-1", referenced))

        assert "Hotel Ibis Berlin, 320 EUR" in result
        assert referenced == [
            {
                "invoice_id": 7,
                "item_name": "Hotel Ibis",
                "company": "Ibis",
                "price": 320.0,
                "category": "REISEKOSTEN",
                "invoice_date": "2026-05-01",
                "document_id": 3,
            }
        ]

    def test_matches_without_invoice_id_are_not_referenced(self, monkeypatch):
        doc = Document(page_content="stray chunk", metadata={})
        monkeypatch.setattr(agent, "search_embeddings", _async_return([doc]))
        referenced = []

        run(agent._search_documents_async("hotels", "user-1", referenced))

        assert referenced == []


class TestListUserDocumentsAsync:
    def test_no_invoices_returns_empty_message(self, monkeypatch):
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return([]))
        referenced = []

        result = run(agent._list_user_documents_async("user-1", referenced))

        assert result == "The user has no uploaded documents yet."
        assert referenced == []

    def test_invoices_are_listed_and_referenced(self, monkeypatch):
        invoices = [
            {
                "id": 1,
                "itemName": "Laptop",
                "company": "Apple",
                "price": "1299.99",
                "category": "ARBEITSMITTEL",
                "invoiceDate": "2026-01-15",
                "documentId": 3,
            }
        ]
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return(invoices))
        referenced = []

        result = run(agent._list_user_documents_async("user-1", referenced))

        assert "Laptop" in result
        assert "Apple" in result
        assert referenced == [
            {
                "invoice_id": 1,
                "item_name": "Laptop",
                "company": "Apple",
                "price": 1299.99,
                "category": "ARBEITSMITTEL",
                "invoice_date": "2026-01-15",
                "document_id": 3,
            }
        ]


class TestSuggestMissingDocumentsAsync:
    def test_all_categories_present_returns_congratulations(self, monkeypatch):
        all_categories = [{"category": c.value} for c in agent.InvoiceCategory]
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return(all_categories))

        result = run(agent._suggest_missing_documents_async("user-1"))

        assert "all available tax categories" in result

    def test_missing_categories_are_listed_with_suggestions(self, monkeypatch):
        monkeypatch.setattr(
            agent, "_fetch_invoices", _async_return([{"category": "ARBEITSMITTEL"}])
        )

        result = run(agent._suggest_missing_documents_async("user-1"))

        assert "ARBEITSMITTEL" not in result.split("Missing categories")[1]
        assert "REISEKOSTEN" in result

    def test_invoices_without_category_are_ignored(self, monkeypatch):
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return([{"category": None}]))

        result = run(agent._suggest_missing_documents_async("user-1"))

        assert "Categories already uploaded: none" in result


class TestRunAgentStreaming:
    def test_yields_tokens_and_deduplicated_references(self, monkeypatch):
        monkeypatch.setattr(
            agent, "_build_agent", lambda user_id, referenced: _FakeAgent(referenced)
        )

        events = run(_collect(agent.run_agent_streaming("What did I buy?", "user-1")))

        assert {"type": "token", "content": "Hello"} in events
        assert events[-1] == {"type": "done"}
        reference_events = [e for e in events if e["type"] == "references"]
        assert len(reference_events) == 1
        assert reference_events[0]["invoices"] == [{"invoice_id": 1}]

    def test_streaming_error_yields_error_event(self, monkeypatch):
        monkeypatch.setattr(agent, "_build_agent", lambda user_id, referenced: _FailingAgent())

        events = run(_collect(agent.run_agent_streaming("question", "user-1")))

        assert events == [{"type": "error", "message": "tool crashed"}]

    def test_build_agent_error_yields_error_event(self, monkeypatch):
        def _raise(user_id, referenced):
            raise RuntimeError("LLM unavailable")

        monkeypatch.setattr(agent, "_build_agent", _raise)

        events = run(_collect(agent.run_agent_streaming("question", "user-1")))

        assert events == [{"type": "error", "message": "LLM unavailable"}]


def _async_return(value):
    async def _fn(*args, **kwargs):
        return value

    return _fn


async def _collect(aiter):
    return [event async for event in aiter]


class _FakeAgent:
    """Mimics the subset of the langchain agent's astream_events surface used
    by run_agent_streaming, appending duplicate invoice refs to verify dedup."""

    def __init__(self, referenced: list):
        self._referenced = referenced

    async def astream_events(self, *args, **kwargs):
        self._referenced.append({"invoice_id": 1})
        self._referenced.append({"invoice_id": 1})
        for event in [
            {
                "event": "on_chat_model_stream",
                "data": {"chunk": _FakeChunk("Hello")},
            },
            {
                "event": "on_tool_start",
                "name": "search_documents",
                "data": {"input": "query"},
            },
            {
                "event": "on_tool_end",
                "name": "search_documents",
                "data": {"output": "result"},
            },
        ]:
            yield event


class _FakeChunk:
    def __init__(self, content):
        self.content = content


class _FailingAgent:
    async def astream_events(self, *args, **kwargs):
        raise RuntimeError("tool crashed")
        yield  # pragma: no cover - makes this an async generator
