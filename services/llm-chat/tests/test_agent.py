"""
Unit tests for app.agent — the RAG tool functions and streaming loop.
External calls (vector search, invoice-service HTTP) are mocked at the
module boundary. Run with: pytest tests/test_agent.py -v
"""

import asyncio

from langchain_core.documents import Document

from app import agent
from app.grpc_gen import invoice_pb2


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

    def test_history_is_prepended_to_the_current_question(self, monkeypatch):
        capturing_agent = _CapturingAgent()
        monkeypatch.setattr(agent, "_build_agent", lambda user_id, referenced: capturing_agent)
        history = [
            {"role": "user", "content": "Change invoice 1's category to ARBEITSMITTEL"},
            {"role": "assistant", "content": "Proposed change... reply to confirm."},
        ]

        run(_collect(agent.run_agent_streaming("yes", "user-1", history)))

        assert capturing_agent.received_messages == [
            *history,
            {"role": "user", "content": "yes"},
        ]

    def test_missing_history_defaults_to_just_the_question(self, monkeypatch):
        capturing_agent = _CapturingAgent()
        monkeypatch.setattr(agent, "_build_agent", lambda user_id, referenced: capturing_agent)

        run(_collect(agent.run_agent_streaming("question", "user-1")))

        assert capturing_agent.received_messages == [{"role": "user", "content": "question"}]


class TestFetchInvoices:
    def test_proto_response_maps_to_camelcase_dicts(self, monkeypatch):
        resp = invoice_pb2.GetLatestInvoicesResponse(
            invoices=[
                invoice_pb2.Invoice(
                    id=1,
                    item_name="Laptop",
                    company="Apple",
                    price="1299.99",
                    category="ARBEITSMITTEL",
                    invoice_date="2026-01-15",
                    document_id=3,
                ),
                # Optional invoice_date/document_id left unset -> should map to None.
                invoice_pb2.Invoice(
                    id=2,
                    item_name="Coffee",
                    company="Starbucks",
                    price="4.50",
                    category="BEWIRTUNG",
                ),
            ]
        )

        class _FakeStub:
            async def GetLatestInvoices(self, request, timeout=None):
                assert request.user_id == "user-1"
                assert request.limit == 1000
                return resp

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(agent._fetch_invoices("user-1"))

        assert result == [
            {
                "id": 1,
                "itemName": "Laptop",
                "company": "Apple",
                "price": "1299.99",
                "category": "ARBEITSMITTEL",
                "invoiceDate": "2026-01-15",
                "documentId": 3,
            },
            {
                "id": 2,
                "itemName": "Coffee",
                "company": "Starbucks",
                "price": "4.50",
                "category": "BEWIRTUNG",
                "invoiceDate": None,
                "documentId": None,
            },
        ]


class TestResolveCategory:
    def test_exact_match_passes_through(self):
        assert agent._resolve_category("BEWIRTUNG") == "BEWIRTUNG"

    def test_close_typo_snaps_to_correct_category(self):
        # Regression: the LLM once produced "WEG_ZUR_ARBEIT" (missing the E),
        # which must resolve to the real enum value rather than hard-failing.
        assert agent._resolve_category("WEG_ZUR_ARBEIT") == "WEGE_ZUR_ARBEIT"

    def test_lowercase_and_spaces_are_normalized(self):
        assert agent._resolve_category("weg zur arbeit") == "WEGE_ZUR_ARBEIT"

    def test_unrelated_input_does_not_match(self):
        assert agent._resolve_category("NOT_A_REAL_CATEGORY") is None


class TestEditInvoiceAsync:
    def test_rejects_non_editable_field(self):
        result = run(agent._edit_invoice_async(1, "user_id", "hacked", "user-1"))

        assert "Cannot edit field" in result

    def test_applies_change_immediately_via_update_invoice_rpc(self, monkeypatch):
        class _FakeStub:
            async def UpdateInvoice(self, request, timeout=None):
                assert request.user_id == "user-1"
                assert request.invoice_id == 1
                assert request.category == "ARBEITSMITTEL"
                return invoice_pb2.UpdateInvoiceResponse(
                    invoice=invoice_pb2.Invoice(id=1, category="ARBEITSMITTEL")
                )

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(agent._edit_invoice_async(1, "category", "ARBEITSMITTEL", "user-1"))

        assert "Updated invoice 1" in result
        assert "ARBEITSMITTEL" in result

    def test_rpc_error_is_reported_not_raised(self, monkeypatch):
        import grpc

        class _FailingStub:
            async def UpdateInvoice(self, request, timeout=None):
                error = grpc.RpcError()
                error.details = lambda: "invoice 1"
                raise error

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FailingStub())

        result = run(agent._edit_invoice_async(1, "price", "1.00", "user-1"))

        assert "Could not update invoice 1" in result

    def test_typo_d_category_is_corrected_before_the_rpc_call(self, monkeypatch):
        # Regression for the silent-failure bug: a near-miss category name must
        # resolve to the real enum value and actually reach the RPC, not error out.
        class _FakeStub:
            async def UpdateInvoice(self, request, timeout=None):
                assert request.category == "WEGE_ZUR_ARBEIT"
                return invoice_pb2.UpdateInvoiceResponse(
                    invoice=invoice_pb2.Invoice(id=1, category="WEGE_ZUR_ARBEIT")
                )

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(agent._edit_invoice_async(1, "category", "WEG_ZUR_ARBEIT", "user-1"))

        assert "Updated invoice 1" in result

    def test_unresolvable_category_fails_before_any_rpc_call(self, monkeypatch):
        called = False

        class _FakeStub:
            async def UpdateInvoice(self, request, timeout=None):
                nonlocal called
                called = True

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(agent._edit_invoice_async(1, "category", "NOT_A_REAL_CATEGORY", "user-1"))

        assert "Unknown category" in result
        assert called is False


class TestAddInvoiceAsync:
    def test_missing_date_is_rejected_before_any_rpc_call(self, monkeypatch):
        called = False

        class _FakeStub:
            async def CreateInvoice(self, request, timeout=None):
                nonlocal called
                called = True

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(
            agent._add_invoice_async("Laptop", "Apple", "999.00", "ARBEITSMITTEL", "user-1", "")
        )

        assert "Cannot add this invoice" in result
        assert "invoice date" in result
        assert called is False

    def test_missing_multiple_fields_are_all_listed(self):
        result = run(agent._add_invoice_async("", "Apple", "999.00", "", "user-1", ""))

        assert "item name" in result
        assert "category" in result
        assert "invoice date" in result

    def test_unknown_category_is_rejected_before_any_rpc_call(self, monkeypatch):
        called = False

        class _FakeStub:
            async def CreateInvoice(self, request, timeout=None):
                nonlocal called
                called = True

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(
            agent._add_invoice_async(
                "Laptop", "Apple", "999.00", "NOT_REAL", "user-1", "2026-01-15"
            )
        )

        assert "Unknown category" in result
        assert called is False

    def test_invalid_price_is_rejected(self):
        result = run(
            agent._add_invoice_async(
                "Laptop", "Apple", "not-a-number", "ARBEITSMITTEL", "user-1", "2026-01-15"
            )
        )

        assert "not a valid price" in result

    def test_creates_invoice_immediately_via_create_invoice_rpc(self, monkeypatch):
        class _FakeStub:
            async def CreateInvoice(self, request, timeout=None):
                assert request.user_id == "user-1"
                assert request.item_name == "Laptop"
                assert request.category == "ARBEITSMITTEL"
                assert request.invoice_date == "2026-01-15"
                return invoice_pb2.CreateInvoiceResponse(
                    invoice=invoice_pb2.Invoice(id=42, item_name="Laptop")
                )

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(
            agent._add_invoice_async(
                "Laptop", "Apple", "999.00", "arbeitsmittel", "user-1", "2026-01-15"
            )
        )

        assert "Created invoice 42" in result
        assert "Laptop" in result

    def test_rpc_error_is_reported_not_raised(self, monkeypatch):
        import grpc

        class _FailingStub:
            async def CreateInvoice(self, request, timeout=None):
                error = grpc.RpcError()
                error.details = lambda: "boom"
                raise error

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FailingStub())

        result = run(
            agent._add_invoice_async(
                "Laptop", "Apple", "999.00", "ARBEITSMITTEL", "user-1", "2026-01-15"
            )
        )

        assert "Could not create invoice" in result


class TestSummarizeInvoiceCategoriesAsync:
    def test_no_invoices_returns_message(self, monkeypatch):
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return([]))

        result = run(agent._summarize_invoice_categories_async("user-1"))

        assert "No accepted invoices" in result

    def test_sums_price_by_category(self, monkeypatch):
        invoices = [
            {"category": "ARBEITSMITTEL", "price": "100.00"},
            {"category": "ARBEITSMITTEL", "price": "50.00"},
            {"category": "REISEKOSTEN", "price": "20.00"},
        ]
        monkeypatch.setattr(agent, "_fetch_invoices", _async_return(invoices))

        result = run(agent._summarize_invoice_categories_async("user-1"))

        assert "ARBEITSMITTEL: 150.00€" in result
        assert "REISEKOSTEN: 20.00€" in result
        assert "not a tax refund estimate" in result


class TestExplainDeductionRuleAsync:
    def test_known_category_returns_suggestion_text(self):
        result = run(agent._explain_deduction_rule_async("BEWIRTUNG"))

        assert "70" in result

    def test_unknown_category_lists_valid_options(self):
        result = run(agent._explain_deduction_rule_async("NOT_REAL"))

        assert "Unknown category" in result
        assert "BEWIRTUNG" in result


class TestCheckDuplicateInvoicesAsync:
    def test_no_matches_reports_none_found(self, monkeypatch):
        class _FakeStub:
            async def FindPotentialDuplicates(self, request, timeout=None):
                return invoice_pb2.FindPotentialDuplicatesResponse(invoices=[])

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(agent._check_duplicate_invoices_async("Amazon", "9.99", "user-1"))

        assert "No potential duplicates" in result

    def test_matches_are_listed(self, monkeypatch):
        class _FakeStub:
            async def FindPotentialDuplicates(self, request, timeout=None):
                assert request.user_id == "user-1"
                assert request.company == "Amazon"
                assert request.price == "9.99"
                assert request.invoice_date == "2026-06-01"
                return invoice_pb2.FindPotentialDuplicatesResponse(
                    invoices=[
                        invoice_pb2.Invoice(id=1, item_name="Cable", company="Amazon", price="9.99")
                    ]
                )

        monkeypatch.setattr(agent, "_get_invoice_stub", lambda: _FakeStub())

        result = run(
            agent._check_duplicate_invoices_async("Amazon", "9.99", "user-1", "2026-06-01")
        )

        assert "Found 1 potential duplicate" in result
        assert "Cable" in result


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


class _CapturingAgent:
    """Records the `messages` payload it was invoked with, yielding nothing else."""

    def __init__(self):
        self.received_messages = None

    async def astream_events(self, payload, *args, **kwargs):
        self.received_messages = payload["messages"]
        return
        yield  # pragma: no cover - makes this an async generator


class _FailingAgent:
    async def astream_events(self, *args, **kwargs):
        raise RuntimeError("tool crashed")
        yield  # pragma: no cover - makes this an async generator
