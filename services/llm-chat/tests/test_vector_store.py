"""
Unit tests for app.vector_store — no external services required.
Run with: pytest tests/test_vector_store.py -v
"""

from app.vector_store import chunk_text


class TestChunkText:
    def test_short_text_single_chunk(self):
        docs = chunk_text("Hotel Ibis Berlin 3 nights 320 EUR", invoice_id=1, user_id="u1")
        assert len(docs) == 1
        assert docs[0].page_content == "Hotel Ibis Berlin 3 nights 320 EUR"

    def test_long_text_splits_into_multiple_documents(self):
        text = "a" * 1200
        docs = chunk_text(text, invoice_id=1, user_id="u1")
        assert len(docs) > 1
        assert "".join(d.page_content for d in docs).replace("a", "") == ""

    def test_attaches_invoice_id_and_user_id_to_every_chunk(self):
        text = "a" * 1200
        docs = chunk_text(text, invoice_id=42, user_id="user-7")
        assert all(d.metadata["invoice_id"] == 42 for d in docs)
        assert all(d.metadata["user_id"] == "user-7" for d in docs)

    def test_extra_metadata_is_attached_to_every_chunk(self):
        docs = chunk_text(
            "short text",
            invoice_id=1,
            user_id="u1",
            company="Apple",
            price=1299.99,
        )
        assert docs[0].metadata["company"] == "Apple"
        assert docs[0].metadata["price"] == 1299.99

    def test_none_valued_metadata_is_omitted(self):
        docs = chunk_text(
            "short text",
            invoice_id=1,
            user_id="u1",
            company=None,
            category="ARBEITSMITTEL",
        )
        assert "company" not in docs[0].metadata
        assert docs[0].metadata["category"] == "ARBEITSMITTEL"
