import json
import pytest
import requests
from pathlib import Path
from datetime import datetime

INVOICES_DIR = Path(__file__).parent.parent.parent / "scripts" / "invoices"
EXTRACT_URL = "http://localhost:8081/extract"


def parse_date(date_str: str) -> str:
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str

def normalize(s: str) -> str:
    return s.lower().replace("ß", "ss")


def test_extraction_accuracy():
    passed_company = 0
    passed_value = 0
    passed_date = 0
    passed_items_count = 0
    passed_items_value = 0
    total = 0
    failures = []

    for pdf_path in sorted(INVOICES_DIR.glob("*.pdf")):
        json_path = pdf_path.with_suffix(".json")
        if not json_path.exists():
            continue

        with open(pdf_path, "rb") as f:
            response = requests.post(EXTRACT_URL, files={"file": f}, timeout=300)

        assert response.status_code == 200, f"{pdf_path.name} returned {response.status_code}"
        result = response.json()
        ground_truth = json.load(open(json_path, encoding="utf-8"))

        total += 1
        expected_company = ground_truth["seller"]["name"]
        expected_value = ground_truth["total"]
        expected_date = parse_date(ground_truth["invoice_date"])
        expected_items = ground_truth.get("line_items", [])

        company_ok = normalize(expected_company) in normalize(result["company"])
        value_ok = abs(result["value"] - expected_value) < 0.02
        date_ok = result["invoice_date"] == expected_date

        # line item count match
        result_items = result.get("line_items", [])
        items_count_ok = len(result_items) == len(expected_items)

        # all line item values match (order-insensitive: match by closest value)
        items_value_ok = False
        if expected_items and result_items:
            expected_subtotals = sorted(item["subtotal"] for item in expected_items)
            result_values = sorted(item["value"] for item in result_items)
            items_value_ok = all(
                abs(r - e) < 0.02
                for r, e in zip(result_values, expected_subtotals)
            ) and len(result_values) == len(expected_subtotals)

        if company_ok:
            passed_company += 1
        if value_ok:
            passed_value += 1
        if date_ok:
            passed_date += 1
        if items_count_ok:
            passed_items_count += 1
        if items_value_ok:
            passed_items_value += 1

        if not (company_ok and value_ok and date_ok):
            failures.append({
                "file": pdf_path.name,
                "company": f"{result['company']} (expected: {expected_company})",
                "value": f"{result['value']} (expected: {expected_value})",
                "date": f"{result['invoice_date']} (expected: {expected_date})",
                "items_count": f"{len(result_items)} (expected: {len(expected_items)})",
                "items_value_ok": items_value_ok,
            })

    if total == 0:
        pytest.skip(f"No invoices found in {INVOICES_DIR}")

    print(f"\nResults: {total} invoices tested")
    print(f"  Company accuracy:      {passed_company}/{total} ({100*passed_company//total}%)")
    print(f"  Value accuracy:        {passed_value}/{total} ({100*passed_value//total}%)")
    print(f"  Date accuracy:         {passed_date}/{total} ({100*passed_date//total}%)")
    print(f"  Line item count match: {passed_items_count}/{total} ({100*passed_items_count//total}%)")
    print(f"  Line item value match: {passed_items_value}/{total} ({100*passed_items_value//total}%)")

    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  {f['file']}: company={f['company']} | value={f['value']} | date={f['date']} | items={f['items_count']}")

    assert passed_value / total >= 0.8, f"Value accuracy too low: {passed_value}/{total}"
    assert passed_company / total >= 0.7, f"Company accuracy too low: {passed_company}/{total}"
    assert passed_date / total >= 0.7, f"Date accuracy too low: {passed_date}/{total}"
    assert passed_items_count / total >= 0.7, f"Line item count accuracy too low: {passed_items_count}/{total}"
    assert passed_items_value / total >= 0.6, f"Line item value accuracy too low: {passed_items_value}/{total}"
