"""
Integration tests for the RAG pipeline (embed -> search -> agent chat -> delete)
against the real HTTP surface of app/main.py.

Requires: llm-chat running on localhost:8081, Postgres with pgvector reachable
at DATABASE_URL, and a real LLM reachable at LLM_URL (the agent chat endpoint
calls a live model). The agent may also call the `list_user_documents` /
`suggest_missing_documents` tools, which hit invoice-service over HTTP — start
it too (`docker compose up -d invoice-service`) if you need those tool paths
exercised; the tests here only assert on the `search_documents` path, which
does not require it.

Not part of the default `pytest tests/` run (see the `integration` marker) —
CI does not stand up these dependencies, so this suite must be run manually:

    cd infra && docker compose up -d db llm-chat
    # infra/docker-compose.yaml maps llm-chat's container port 8081 to host 8082
    LLM_CHAT_TEST_URL=http://localhost:8082 pytest tests/test_integration_rag.py -v -s -m integration
"""

import json
import os

import pytest
import requests

pytestmark = pytest.mark.integration

BASE_URL = os.getenv("LLM_CHAT_TEST_URL", "http://localhost:8081")
TEST_INVOICE_ID = 9999
TEST_USER_ID = "integration-test-user"


@pytest.fixture(autouse=True)
def check_service():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        if r.status_code != 200:
            pytest.fail(f"llm-chat not healthy at {BASE_URL}")
    except Exception as e:
        pytest.fail(f"llm-chat not reachable at {BASE_URL}: {e}")


@pytest.fixture(autouse=True)
def cleanup():
    requests.delete(f"{BASE_URL}/v1/embed/{TEST_INVOICE_ID}", timeout=10)
    yield
    requests.delete(f"{BASE_URL}/v1/embed/{TEST_INVOICE_ID}", timeout=10)


def embed(text: str, invoice_id: int = TEST_INVOICE_ID, user_id: str = TEST_USER_ID, **fields):
    r = requests.post(
        f"{BASE_URL}/v1/embed",
        json={"invoice_id": invoice_id, "text": text, "user_id": user_id, **fields},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r


def chat(question: str, user_id: str = TEST_USER_ID, timeout: int = 120) -> dict:
    """Posts to the SSE agent-chat endpoint and collects the stream into a
    single {answer, references, tool_calls, error} dict for easy asserting."""
    r = requests.post(
        f"{BASE_URL}/api/v1/agent/chat",
        json={"question": question},
        headers={"X-User-Sub": user_id},
        stream=True,
        timeout=timeout,
    )
    assert r.status_code == 200, r.text

    answer_parts: list[str] = []
    references: list[dict] = []
    tool_calls: list[str] = []
    error: str | None = None

    for line in r.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        event = json.loads(line[len("data: ") :])
        kind = event["type"]
        if kind == "token":
            answer_parts.append(event["content"])
        elif kind == "references":
            references = event["invoices"]
        elif kind == "tool_start":
            tool_calls.append(event["tool"])
        elif kind == "error":
            error = event["message"]

    return {
        "answer": "".join(answer_parts),
        "references": references,
        "tool_calls": tool_calls,
        "error": error,
    }


class TestEmbedEndpoint:
    def test_embed_returns_ok(self):
        r = embed("Hotel Ibis Berlin 3 nights 320 EUR REISEKOSTEN")
        assert r.json() == {"status": "ok"}

    def test_embed_update_returns_ok(self):
        embed("original text")
        r = requests.put(
            f"{BASE_URL}/v1/embed",
            json={
                "invoice_id": TEST_INVOICE_ID,
                "text": "updated text about laptop purchase",
                "user_id": TEST_USER_ID,
            },
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_delete_returns_ok(self):
        embed("some invoice text")
        r = requests.delete(f"{BASE_URL}/v1/embed/{TEST_INVOICE_ID}", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_delete_is_idempotent_when_nothing_embedded(self):
        r = requests.delete(f"{BASE_URL}/v1/embed/{TEST_INVOICE_ID}", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


class TestAgentChat:
    def test_chat_answers_from_embedded_invoice(self):
        embed(
            "MacBook Pro 14 inch Apple 1299 EUR work equipment ARBEITSMITTEL",
            item_name="MacBook Pro",
            company="Apple",
            price=1299.0,
            category="ARBEITSMITTEL",
        )

        result = chat("What work equipment did I buy? Search my documents.")

        assert result["error"] is None
        assert len(result["answer"]) > 10

    def test_chat_references_the_matching_invoice(self):
        embed(
            "Hotel Marriott Frankfurt 2 nights 450 EUR business travel REISEKOSTEN",
            item_name="Hotel Marriott",
            company="Marriott",
            price=450.0,
            category="REISEKOSTEN",
        )

        result = chat("Search my documents for any hotels I stayed in.")

        assert result["error"] is None
        assert any(inv.get("invoice_id") == TEST_INVOICE_ID for inv in result["references"])

    def test_chat_requires_user_header(self):
        r = requests.post(
            f"{BASE_URL}/api/v1/agent/chat",
            json={"question": "What are my expenses?"},
            timeout=10,
        )
        assert r.status_code == 422  # missing required X-User-Sub header

    def test_delete_removes_invoice_from_search_results(self):
        embed("Unique phrase xylophone purple banana invoice 999 EUR")

        before = chat("Search my documents for xylophone purple banana.")
        assert any(inv.get("invoice_id") == TEST_INVOICE_ID for inv in before["references"])

        requests.delete(f"{BASE_URL}/v1/embed/{TEST_INVOICE_ID}", timeout=10)

        after = chat("Search my documents for xylophone purple banana.")
        assert not any(inv.get("invoice_id") == TEST_INVOICE_ID for inv in after["references"])
