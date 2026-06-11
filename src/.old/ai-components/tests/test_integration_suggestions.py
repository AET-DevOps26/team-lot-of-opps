"""
Integration tests for the proactive suggestions engine.
Requires: AI service running on localhost:8081, PostgreSQL connected.
Run with: pytest tests/test_integration_suggestions.py -v -s
"""
import pytest
import requests

BASE_URL = "http://localhost:8081"
TEST_USER_ID = "test-suggestions-user-9999"


@pytest.fixture(autouse=True)
def check_service():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        if r.status_code != 200:
            pytest.skip("AI service not available")
    except Exception:
        pytest.skip("AI service not available")


class TestSuggestionsPost:
    def test_suggestions_with_items_returns_answer(self):
        r = requests.post(f"{BASE_URL}/suggestions", json={
            "user_id": TEST_USER_ID,
            "items": [
                {"product_name": "Hotel Ibis Berlin", "company": "Ibis", "value": 320.0,
                 "category": "REISEKOSTEN", "invoice_date": "2025-10-10"}
            ]
        }, timeout=120)
        assert r.status_code == 200
        assert "answer" in r.json()
        assert len(r.json()["answer"]) > 20

    def test_suggestions_mentions_missing_document(self):
        r = requests.post(f"{BASE_URL}/suggestions", json={
            "user_id": TEST_USER_ID,
            "items": [
                {"product_name": "Hotel Marriott Frankfurt", "company": "Marriott",
                 "value": 450.0, "category": "REISEKOSTEN", "invoice_date": "2025-11-05"}
            ]
        }, timeout=120)
        assert r.status_code == 200
        answer = r.json()["answer"].lower()
        assert any(word in answer for word in ["flight", "train", "flug", "bahn", "zug", "travel", "reise"])

    def test_suggestions_with_multiple_items(self):
        r = requests.post(f"{BASE_URL}/suggestions", json={
            "user_id": TEST_USER_ID,
            "items": [
                {"product_name": "MacBook Pro", "company": "Apple",
                 "value": 1299.0, "category": "ARBEITSMITTEL", "invoice_date": "2025-09-15"},
                {"product_name": "Hotel Berlin", "company": "Ibis",
                 "value": 200.0, "category": "REISEKOSTEN", "invoice_date": "2025-10-01"},
            ]
        }, timeout=120)
        assert r.status_code == 200
        assert "answer" in r.json()
        assert len(r.json()["answer"]) > 20

    def test_suggestions_stored_in_db(self):
        requests.post(f"{BASE_URL}/suggestions", json={
            "user_id": TEST_USER_ID,
            "items": [
                {"product_name": "Internet Telekom", "company": "Telekom",
                 "value": 49.99, "category": "INTERNET_UND_TELEFON", "invoice_date": "2025-10-01"}
            ]
        }, timeout=120)

        r = requests.get(f"{BASE_URL}/api/suggestions", params={"user_id": TEST_USER_ID}, timeout=10)
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1
        assert "suggestion" in results[0]
        assert "created_at" in results[0]

    def test_suggestions_empty_items_returns_empty(self):
        r = requests.post(f"{BASE_URL}/suggestions", json={
            "user_id": "nonexistent-user-xyz",
            "items": []
        }, timeout=10)
        assert r.status_code == 200
        assert r.json() == []


class TestSuggestionsGet:
    def test_get_suggestions_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/suggestions",
                         params={"user_id": TEST_USER_ID}, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_suggestions_unknown_user_returns_empty(self):
        r = requests.get(f"{BASE_URL}/api/suggestions",
                         params={"user_id": "completely-unknown-user-abc123"}, timeout=10)
        assert r.status_code == 200
        assert r.json() == []

    def test_get_suggestions_most_recent_first(self):
        for i in range(2):
            requests.post(f"{BASE_URL}/suggestions", json={
                "user_id": TEST_USER_ID,
                "items": [{"product_name": f"Item {i}", "company": "Test",
                           "value": 10.0, "category": "SONSTIGE_AUSGABEN"}]
            }, timeout=120)

        r = requests.get(f"{BASE_URL}/api/suggestions",
                         params={"user_id": TEST_USER_ID}, timeout=10)
        results = r.json()
        if len(results) >= 2:
            assert results[0]["created_at"] >= results[1]["created_at"]
