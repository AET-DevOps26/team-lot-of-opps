"""
Unit tests for pure functions — no external services required.
Run with: pytest tests/test_unit.py -v
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

# ── date parsing ──────────────────────────────────────────────────────────────

def parse_date(date_str: str) -> str:
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str

def normalize(s: str) -> str:
    return s.lower().replace("ß", "ss")


class TestParseDate:
    def test_german_dot_format(self):
        assert parse_date("10.10.2025") == "2025-10-10"

    def test_iso_format_unchanged(self):
        assert parse_date("2025-08-11") == "2025-08-11"

    def test_english_month_format(self):
        assert parse_date("11 Aug 2025") == "2025-08-11"

    def test_unknown_format_returned_as_is(self):
        assert parse_date("not a date") == "not a date"

    def test_january(self):
        assert parse_date("01 Jan 2024") == "2024-01-01"

    def test_december(self):
        assert parse_date("31 Dec 2025") == "2025-12-31"


class TestNormalize:
    def test_eszett_replaced(self):
        assert normalize("Süßebier") == "süssebier"

    def test_lowercase(self):
        assert normalize("DB Fernverkehr AG") == "db fernverkehr ag"

    def test_no_eszett(self):
        assert normalize("Schmidtke") == "schmidtke"

    def test_substring_match(self):
        assert normalize("Süßebier") in normalize("Frau Süssebier GmbH")


# ── chunk_text ────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 500) -> list:
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]


class TestChunkText:
    def test_short_text_single_chunk(self):
        chunks = chunk_text("hello world", chunk_size=500)
        assert chunks == ["hello world"]

    def test_long_text_multiple_chunks(self):
        text = "a" * 1200
        chunks = chunk_text(text, chunk_size=500)
        assert len(chunks) == 3
        assert chunks[0] == "a" * 500
        assert chunks[1] == "a" * 500
        assert chunks[2] == "a" * 200

    def test_empty_text(self):
        assert chunk_text("") == []

    def test_exact_chunk_size(self):
        text = "x" * 500
        chunks = chunk_text(text, chunk_size=500)
        assert len(chunks) == 1

    def test_chunk_size_plus_one(self):
        text = "x" * 501
        chunks = chunk_text(text, chunk_size=500)
        assert len(chunks) == 2
