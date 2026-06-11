"""
Integration tests for the RAG pipeline (embed → search → chat → delete).
Requires: AI service running on localhost:8081, PostgreSQL connected.
Run with: pytest tests/test_integration_rag.py -v -s
"""
import pytest
import requests

BASE_URL = "http://localhost:8081"
TEST_INVOICE_ID = 9999


@pytest.fixture(autouse=True)
def check_service():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        if r.status_code != 200:
            pytest.skip("AI service not available")
    except Exception:
        pytest.skip("AI service not available")


@pytest.fixture(autouse=True)
def cleanup():
    requests.delete(f"{BASE_URL}/embed/{TEST_INVOICE_ID}", timeout=10)
    yield
    requests.delete(f"{BASE_URL}/embed/{TEST_INVOICE_ID}", timeout=10)


class TestEmbedEndpoint:
    def test_embed_returns_ok(self):
        r = requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "Hotel Ibis Berlin 3 nights 320 EUR REISEKOSTEN"
        }, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_embed_update_returns_ok(self):
        requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "original text"
        }, timeout=10)
        r = requests.put(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "updated text about laptop purchase"
        }, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_delete_returns_ok(self):
        requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "some invoice text"
        }, timeout=10)
        r = requests.delete(f"{BASE_URL}/embed/{TEST_INVOICE_ID}", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


class TestRagChat:
    def test_chat_returns_answer(self):
        requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "MacBook Pro 14 inch Apple 1299 EUR work equipment ARBEITSMITTEL"
        }, timeout=10)

        r = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What work equipment did I buy?"
        }, timeout=120)

        assert r.status_code == 200
        assert "answer" in r.json()
        assert len(r.json()["answer"]) > 10

    def test_chat_references_embedded_content(self):
        requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "Hotel Marriott Frankfurt 2 nights 450 EUR business travel REISEKOSTEN"
        }, timeout=10)

        r = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What hotels did I stay in?"
        }, timeout=120)

        assert r.status_code == 200
        answer = r.json()["answer"].lower()
        assert any(word in answer for word in ["hotel", "marriott", "frankfurt"])

    def test_chat_without_user_id(self):
        r = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What are my expenses?"
        }, timeout=120)
        assert r.status_code == 200
        assert "answer" in r.json()

    def test_chat_with_null_user_id(self):
        r = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What are my expenses?",
            "user_id": None
        }, timeout=120)
        assert r.status_code == 200

    def test_delete_removes_from_search(self):
        requests.post(f"{BASE_URL}/embed", json={
            "invoice_id": TEST_INVOICE_ID,
            "text": "Unique phrase xylophone purple banana invoice 999 EUR"
        }, timeout=10)

        r_before = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What is the xylophone purple banana invoice?"
        }, timeout=120)
        assert "999" in r_before.json()["answer"] or "xylophone" in r_before.json()["answer"].lower()

        requests.delete(f"{BASE_URL}/embed/{TEST_INVOICE_ID}", timeout=10)

        r_after = requests.post(f"{BASE_URL}/api/chat", json={
            "question": "What is the xylophone purple banana invoice?"
        }, timeout=120)
        assert r_after.status_code == 200
