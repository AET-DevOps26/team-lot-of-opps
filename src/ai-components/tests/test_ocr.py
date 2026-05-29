import json
import pytest
import requests
from pathlib import Path
from datetime import datetime

INVOICES_DIR = Path(__file__).parent.parent.parent / "scripts" / "invoices"
EXTRACT_URL = "http://localhost:8081/extract"
EXTRACT_VISION_URL = "http://localhost:8081/extract/vision"


def parse_date(date_str: str) -> str:
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str

def normalize(s: str) -> str:
    return s.lower().replace("ß", "ss")

def score(result: dict, ground_truth: dict) -> dict:
    expected_company = ground_truth["seller"]["name"]
    expected_value = ground_truth["total"]
    expected_date = parse_date(ground_truth["invoice_date"])
    expected_items = ground_truth.get("line_items", [])
    result_items = result.get("line_items", [])

    company_ok = normalize(expected_company) in normalize(result.get("company", ""))
    value_ok = abs(result.get("value", -1) - expected_value) < 0.02
    date_ok = result.get("invoice_date") == expected_date
    items_count_ok = len(result_items) == len(expected_items)

    items_value_ok = False
    if expected_items and result_items and len(result_items) == len(expected_items):
        expected_subtotals = sorted(item["subtotal"] for item in expected_items)
        result_values = sorted(item["value"] for item in result_items)
        items_value_ok = all(abs(r - e) < 0.02 for r, e in zip(result_values, expected_subtotals))

    return {
        "company_ok": company_ok,
        "value_ok": value_ok,
        "date_ok": date_ok,
        "items_count_ok": items_count_ok,
        "items_value_ok": items_value_ok,
        "company": result.get("company", "N/A"),
        "value": result.get("value", "N/A"),
        "date": result.get("invoice_date", "N/A"),
        "items": len(result_items),
    }


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
        s = score(result, ground_truth)

        total += 1
        if s["company_ok"]: passed_company += 1
        if s["value_ok"]: passed_value += 1
        if s["date_ok"]: passed_date += 1
        if s["items_count_ok"]: passed_items_count += 1
        if s["items_value_ok"]: passed_items_value += 1

        if not (s["company_ok"] and s["value_ok"] and s["date_ok"]):
            failures.append({
                "file": pdf_path.name,
                "company": f"{s['company']} (expected: {ground_truth['seller']['name']})",
                "value": f"{s['value']} (expected: {ground_truth['total']})",
                "date": f"{s['date']} (expected: {parse_date(ground_truth['invoice_date'])})",
                "items_count": f"{s['items']} (expected: {len(ground_truth.get('line_items', []))})",
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


def test_vision_vs_ocr_comparison():
    rows = []
    total = 0

    ocr_scores = {"company": 0, "value": 0, "date": 0}
    vision_scores = {"company": 0, "value": 0, "date": 0}

    for pdf_path in sorted(INVOICES_DIR.glob("*.pdf")):
        json_path = pdf_path.with_suffix(".json")
        if not json_path.exists():
            continue

        ground_truth = json.load(open(json_path, encoding="utf-8"))
        total += 1

        with open(pdf_path, "rb") as f:
            ocr_resp = requests.post(EXTRACT_URL, files={"file": f}, timeout=300)
        with open(pdf_path, "rb") as f:
            vision_resp = requests.post(EXTRACT_VISION_URL, files={"file": f}, timeout=600)

        ocr_ok = ocr_resp.status_code == 200
        vision_ok = vision_resp.status_code == 200

        ocr_s = score(ocr_resp.json(), ground_truth) if ocr_ok else {}
        vision_s = score(vision_resp.json(), ground_truth) if vision_ok else {}

        def mark(val): return "✓" if val else "✗"

        rows.append({
            "file": pdf_path.name,
            "ocr_company":  mark(ocr_s.get("company_ok")),
            "ocr_value":    mark(ocr_s.get("value_ok")),
            "ocr_date":     mark(ocr_s.get("date_ok")),
            "vis_company":  mark(vision_s.get("company_ok")),
            "vis_value":    mark(vision_s.get("value_ok")),
            "vis_date":     mark(vision_s.get("date_ok")),
            "expected_company": ground_truth["seller"]["name"],
            "expected_value":   ground_truth["total"],
            "expected_date":    parse_date(ground_truth["invoice_date"]),
            "ocr_raw_company":  ocr_s.get("company", "N/A"),
            "ocr_raw_value":    ocr_s.get("value", "N/A"),
            "ocr_raw_date":     ocr_s.get("date", "N/A"),
            "vis_raw_company":  vision_s.get("company", "N/A"),
            "vis_raw_value":    vision_s.get("value", "N/A"),
            "vis_raw_date":     vision_s.get("date", "N/A"),
        })

        for key in ("company", "value", "date"):
            if ocr_s.get(f"{key}_ok"): ocr_scores[key] += 1
            if vision_s.get(f"{key}_ok"): vision_scores[key] += 1

    if total == 0:
        pytest.skip(f"No invoices found in {INVOICES_DIR}")

    print(f"\n{'File':<25} {'--- OCR ---':^15} {'--- Vision ---':^15}")
    print(f"{'':25} {'Co':>3} {'Val':>4} {'Dt':>4}   {'Co':>3} {'Val':>4} {'Dt':>4}")
    print("-" * 55)
    for r in rows:
        print(f"{r['file']:<25} {r['ocr_company']:>3} {r['ocr_value']:>4} {r['ocr_date']:>4}   {r['vis_company']:>3} {r['vis_value']:>4} {r['vis_date']:>4}")
    print("-" * 55)
    print(f"{'TOTAL':<25} {ocr_scores['company']:>3} {ocr_scores['value']:>4} {ocr_scores['date']:>4}   {vision_scores['company']:>3} {vision_scores['value']:>4} {vision_scores['date']:>4}")
    print(f"{'%':<25} {100*ocr_scores['company']//total:>2}% {100*ocr_scores['value']//total:>3}% {100*ocr_scores['date']//total:>3}%   {100*vision_scores['company']//total:>2}% {100*vision_scores['value']//total:>3}% {100*vision_scores['date']//total:>3}%")

    print("\n--- Detail (expected → OCR extracted → Vision extracted) ---")
    for r in rows:
        print(f"\n{r['file']}")
        print(f"  company: {r['expected_company']!r:30} | OCR: {r['ocr_raw_company']!r:30} | Vision: {r['vis_raw_company']!r}")
        print(f"  value:   {r['expected_value']:<30} | OCR: {r['ocr_raw_value']:<30} | Vision: {r['vis_raw_value']}")
        print(f"  date:    {r['expected_date']!r:30} | OCR: {r['ocr_raw_date']!r:30} | Vision: {r['vis_raw_date']!r}")
