#!/usr/bin/env python3
"""Generate a large pool of dummy student-expense invoice PDFs (and/or PNGs)."""

import argparse
import io
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import fitz  # PyMuPDF — pure-Python wheel, no system libs
from faker import Faker
from fpdf import FPDF
from fpdf.enums import XPos, YPos

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT_BOLD    = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# ---------------------------------------------------------------------------
# Currencies
# ---------------------------------------------------------------------------

CURRENCIES = [
    {"code": "USD", "symbol": "$",   "locale": "en_US", "decimals": 2},
    {"code": "EUR", "symbol": "€",   "locale": "de_DE", "decimals": 2},
    {"code": "GBP", "symbol": "£",   "locale": "en_GB", "decimals": 2},
    {"code": "JPY", "symbol": "¥",   "locale": "ja_JP", "decimals": 0},
    {"code": "CHF", "symbol": "CHF", "locale": "de_CH", "decimals": 2},
    {"code": "CAD", "symbol": "CA$", "locale": "en_CA", "decimals": 2},
    {"code": "AUD", "symbol": "A$",  "locale": "en_AU", "decimals": 2},
    {"code": "SEK", "symbol": "kr",  "locale": "sv_SE", "decimals": 2},
    {"code": "NOK", "symbol": "kr",  "locale": "no_NO", "decimals": 2},
    {"code": "DKK", "symbol": "kr",  "locale": "da_DK", "decimals": 2},
]

CURRENCY_BY_CODE = {c["code"]: c for c in CURRENCIES}

# Approximate EUR-equivalent multipliers per currency
FX_RATES = {
    "USD": 1.10, "EUR": 1.00, "GBP": 0.86, "JPY": 163.0,
    "CHF": 0.96, "CAD": 1.50, "AUD": 1.65,
    "SEK": 11.4, "NOK": 11.5, "DKK": 7.46,
}

VAT_RATES = {
    "USD": 0.00, "EUR": 0.20, "GBP": 0.20, "JPY": 0.10,
    "CHF": 0.077, "CAD": 0.05, "AUD": 0.10,
    "SEK": 0.25, "NOK": 0.25, "DKK": 0.25,
}

VAT_LABELS = {
    "USD": "Sales Tax", "EUR": "VAT", "GBP": "VAT",
    "JPY": "Consumption Tax", "CHF": "MWST", "CAD": "GST",
    "AUD": "GST", "SEK": "MOMS", "NOK": "MVA", "DKK": "MOMS",
}

# ---------------------------------------------------------------------------
# Student expense items  (description, eur_min, eur_max, qty_min, qty_max)
# ---------------------------------------------------------------------------

EXPENSE_ITEMS = [
    # Housing
    ("Monthly Rent – Studio Apartment",    450, 1300, 1, 1),
    ("Monthly Rent – Room in Shared Flat", 250,  800, 1, 1),
    ("Dorm / Student Housing Fee",         200,  650, 1, 1),
    ("Electricity & Heating",               25,  110, 1, 1),
    ("Internet Service (Monthly)",          18,   55, 1, 1),
    # Food & Drink
    ("Grocery Shopping",                    15,  160, 1, 4),
    ("Restaurant / Café",                    8,   50, 1, 3),
    ("Food Delivery",                       10,   38, 1, 2),
    ("Coffee Shop",                          3,   12, 1, 6),
    # Education
    ("Textbook",                            22,  130, 1, 3),
    ("Course / Seminar Fee",                60,  500, 1, 1),
    ("Printing & Stationery",               3,   28, 1, 5),
    ("Online Learning Subscription",        9,   40, 1, 1),
    ("Tutor Session",                       22,   85, 1, 5),
    ("Language Course",                     70,  320, 1, 1),
    ("Student Admin / ID Fee",              5,   55, 1, 1),
    # Transport
    ("Monthly Transit Pass",                38,  115, 1, 1),
    ("Train / Bus Ticket",                  12,  130, 1, 3),
    ("Bike Repair",                         18,  160, 1, 1),
    ("Rideshare / Taxi",                     7,   35, 1, 4),
    # Health & Personal Care
    ("Pharmacy / Medication",               5,   65, 1, 2),
    ("Doctor Visit / Co-pay",              15,   90, 1, 1),
    ("Health Insurance (Monthly)",          70,  220, 1, 1),
    ("Gym Membership (Monthly)",            18,   70, 1, 1),
    ("Haircut",                             14,   50, 1, 1),
    # Technology & Subscriptions
    ("Second-hand Laptop",                 150,  600, 1, 1),
    ("Laptop Repair",                       55,  320, 1, 1),
    ("USB Hub / Peripherals",               10,   60, 1, 2),
    ("Smartphone Plan (Monthly)",           10,   45, 1, 1),
    ("Streaming Subscription",              7,    18, 1, 2),
    ("Cloud Storage Subscription",          2,    13, 1, 1),
    ("Software License (Student)",          12,   85, 1, 1),
    # Clothing & Lifestyle
    ("Clothing & Apparel",                  18,  160, 1, 3),
    ("Shoes",                               28,  130, 1, 1),
    ("Second-hand Clothing",               5,    60, 1, 4),
    # Entertainment
    ("Concert / Event Ticket",              15,   90, 1, 4),
    ("Cinema Ticket",                        8,   16, 1, 4),
    ("Novel / Book",                         8,   28, 1, 3),
    ("Museum / Gallery Entry",              5,    20, 1, 2),
    # Household
    ("Household Supplies",                  8,   65, 1, 3),
    ("Laundry Service",                     4,   22, 1, 5),
    ("Desk Lamp / Lighting",               12,   65, 1, 1),
    ("Desk Chair (Used)",                  40,  260, 1, 1),
    # Travel
    ("Hostel Accommodation",               14,   55, 1, 7),
    ("Flight Ticket (Budget)",             30,  350, 1, 2),
]

PAYMENT_TERMS        = ["Due on Receipt", "Net 14", "Net 30"]
PAYMENT_TERM_WEIGHTS = [0.60,             0.28,     0.12]

# ---------------------------------------------------------------------------
# Colors  (R, G, B)
# ---------------------------------------------------------------------------

NAVY  = (44,  62,  80)
GREY  = (127, 140, 141)
LIGHT = (248, 249, 250)
WHITE = (255, 255, 255)
DARK  = (68,  68,  68)
EDGE  = (229, 232, 234)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _net_days(terms: str) -> int:
    return {"Net 14": 14, "Net 30": 30, "Net 60": 60,
            "Due on Receipt": 0, "2/10 Net 30": 30}.get(terms, 30)


def fmt(amount: float, currency: dict) -> str:
    sym = currency["symbol"]
    dec = currency["decimals"]
    if dec == 0:
        return f"{sym} {int(round(amount)):,}"
    return f"{sym} {amount:,.{dec}f}"


def pct(rate: float) -> str:
    s = f"{rate * 100:.1f}".rstrip("0").rstrip(".")
    return s + "%"


# ---------------------------------------------------------------------------
# Data builder
# ---------------------------------------------------------------------------

def build_invoice_data(rng: random.Random, seq: int, currency_filter=None) -> dict:
    currency = currency_filter if currency_filter else rng.choice(CURRENCIES)
    fake = Faker(currency["locale"])
    fake.seed_instance(rng.randint(0, 2**31))

    invoice_date = date.today() - timedelta(days=rng.randint(0, 540))
    terms        = rng.choices(PAYMENT_TERMS, weights=PAYMENT_TERM_WEIGHTS, k=1)[0]
    due_date     = invoice_date + timedelta(days=_net_days(terms))

    num_items = rng.randint(1, 4)
    selected  = rng.sample(EXPENSE_ITEMS, k=num_items)
    fx        = FX_RATES[currency["code"]]

    items = []
    for (desc, eur_min, eur_max, qty_min, qty_max) in selected:
        qty       = rng.randint(qty_min, qty_max)
        raw_price = rng.uniform(eur_min, eur_max) * fx
        if currency["decimals"] == 0:
            unit_price = float(round(raw_price))
        else:
            unit_price = round(raw_price, 2)
        subtotal = round(qty * unit_price, currency["decimals"])
        items.append({
            "description":    desc,
            "qty":            qty,
            "unit_price":     unit_price,
            "unit_price_fmt": fmt(unit_price, currency),
            "subtotal":       subtotal,
            "subtotal_fmt":   fmt(subtotal, currency),
        })

    subtotal   = round(sum(i["subtotal"] for i in items), currency["decimals"])
    vat_rate   = VAT_RATES[currency["code"]]
    vat_amount = round(subtotal * vat_rate, currency["decimals"])
    total      = round(subtotal + vat_amount, currency["decimals"])

    if currency["code"] == "USD":
        ref_label = "Routing / Account"
        ref_value = (f"{rng.randint(100000000, 999999999)} / "
                     f"{rng.randint(1000000000, 9999999999)}")
        bic = ""
    else:
        ref_label = "IBAN"
        try:    ref_value = fake.iban()
        except: ref_value = "N/A"
        try:    bic = fake.swift()
        except: bic = ""

    days = _net_days(terms)
    footer_note = (
        f"Payment is due within {days} days of the invoice date."
        if days > 0 else
        "Payment is due upon receipt of this invoice."
    )

    # Buyer is a student (individual), not a company
    non_jp_locales = [c["locale"] for c in CURRENCIES if c["code"] != "JPY"]
    buyer_fake = Faker(rng.choice(non_jp_locales))
    buyer_fake.seed_instance(rng.randint(0, 2**31))

    return {
        "invoice_number": f"INV-{invoice_date.year}-{seq:04d}",
        "invoice_date":   invoice_date.strftime("%d %b %Y"),
        "due_date":       due_date.strftime("%d %b %Y"),
        "terms":          terms,
        "currency":       currency,
        "seller": {
            "name":       fake.company(),
            "address":    fake.street_address(),
            "city_state": f"{fake.city()}, {fake.country()}",
            "tax_id":     f"VAT: {fake.numerify('??#########')}",
            "email":      fake.company_email(),
            "phone":      fake.phone_number(),
        },
        "buyer": {
            "name":       f"{buyer_fake.first_name()} {buyer_fake.last_name()}",
            "address":    buyer_fake.street_address(),
            "city_state": f"{buyer_fake.city()}, {buyer_fake.country()}",
        },
        "items":          items,
        "subtotal":       subtotal,
        "subtotal_fmt":   fmt(subtotal, currency),
        "vat_rate":       vat_rate,
        "vat_label":      VAT_LABELS[currency["code"]],
        "vat_pct":        pct(vat_rate),
        "vat_amount":     vat_amount,
        "vat_amount_fmt": fmt(vat_amount, currency),
        "total":          total,
        "total_fmt":      fmt(total, currency),
        "payment": {
            "bank":       fake.company() + " Bank",
            "ref_label":  ref_label,
            "ref_value":  ref_value,
            "bic":        bic,
        },
        "footer_note":    footer_note,
        "_currency_code": currency["code"],
        "_items_count":   len(items),
    }


# ---------------------------------------------------------------------------
# Ground-truth JSON
# ---------------------------------------------------------------------------

def build_ground_truth(inv: dict) -> dict:
    return {
        "invoice_number": inv["invoice_number"],
        "invoice_date":   inv["invoice_date"],
        "due_date":       inv["due_date"],
        "payment_terms":  inv["terms"],
        "currency":       inv["_currency_code"],
        "seller": {
            "name":       inv["seller"]["name"],
            "address":    inv["seller"]["address"],
            "city":       inv["seller"]["city_state"],
            "tax_id":     inv["seller"]["tax_id"],
            "email":      inv["seller"]["email"],
            "phone":      inv["seller"]["phone"],
        },
        "buyer": {
            "name":       inv["buyer"]["name"],
            "address":    inv["buyer"]["address"],
            "city":       inv["buyer"]["city_state"],
        },
        "line_items": [
            {
                "description": item["description"],
                "quantity":    item["qty"],
                "unit_price":  item["unit_price"],
                "subtotal":    item["subtotal"],
            }
            for item in inv["items"]
        ],
        "subtotal":    inv["subtotal"],
        "vat_label":   inv["vat_label"],
        "vat_rate":    inv["vat_rate"],
        "vat_amount":  inv["vat_amount"],
        "total":       inv["total"],
        "payment": {
            "bank":      inv["payment"]["bank"],
            inv["payment"]["ref_label"]: inv["payment"]["ref_value"],
            **({"bic": inv["payment"]["bic"]} if inv["payment"]["bic"] else {}),
        },
    }


# ---------------------------------------------------------------------------
# PDF renderer → raw bytes
# ---------------------------------------------------------------------------

def render_invoice_pdf_bytes(inv: dict) -> bytes:
    pdf = FPDF("P", "mm", "A4")
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_font("Reg",  "", FONT_REGULAR)
    pdf.add_font("Bold", "", FONT_BOLD)
    pdf.add_page()

    W = 180.0

    # ── Header ──────────────────────────────────────────────────────────────
    seller = inv["seller"]

    pdf.set_xy(15, 15)
    pdf.set_font("Reg", size=16)
    pdf.set_text_color(*NAVY)
    pdf.cell(110, 8, seller["name"], new_x=XPos.LEFT, new_y=YPos.NEXT)

    pdf.set_font("Reg", size=8)
    pdf.set_text_color(*GREY)
    for line in [seller["address"], seller["city_state"], seller["tax_id"],
                 f"{seller['email']}  |  {seller['phone']}"]:
        pdf.set_x(15)
        pdf.cell(110, 4.5, line, new_x=XPos.LEFT, new_y=YPos.NEXT)

    header_bottom = pdf.get_y()

    pdf.set_xy(125, 15)
    pdf.set_font("Bold", size=22)
    pdf.set_text_color(*NAVY)
    pdf.cell(70, 10, "INVOICE", align="R", new_x=XPos.LEFT, new_y=YPos.NEXT)

    logo_x, logo_y, logo_w, logo_h = 162, 27, 33, 18
    pdf.set_fill_color(*LIGHT)
    pdf.set_draw_color(189, 195, 199)
    pdf.set_line_width(0.4)
    pdf.rect(logo_x, logo_y, logo_w, logo_h, style="FD")
    pdf.set_font("Reg", size=7)
    pdf.set_text_color(189, 195, 199)
    pdf.set_xy(logo_x, logo_y + (logo_h - 4) / 2)
    pdf.cell(logo_w, 4, "LOGO", align="C", new_x=XPos.LEFT, new_y=YPos.NEXT)

    rule_y = max(header_bottom, logo_y + logo_h) + 3
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.5)
    pdf.line(15, rule_y, 195, rule_y)

    y = rule_y + 5

    # ── Bill To + Meta ───────────────────────────────────────────────────────
    buyer = inv["buyer"]

    pdf.set_xy(15, y)
    pdf.set_font("Reg", size=7)
    pdf.set_text_color(*GREY)
    pdf.cell(85, 4, "BILL TO", new_x=XPos.LEFT, new_y=YPos.NEXT)

    pdf.set_x(15)
    pdf.set_font("Reg", size=11)
    pdf.set_text_color(*NAVY)
    pdf.cell(85, 6, buyer["name"], new_x=XPos.LEFT, new_y=YPos.NEXT)

    pdf.set_font("Reg", size=8.5)
    pdf.set_text_color(*DARK)
    for line in [buyer["address"], buyer["city_state"]]:
        pdf.set_x(15)
        pdf.cell(85, 4.5, line, new_x=XPos.LEFT, new_y=YPos.NEXT)

    meta_rows = [
        ("Invoice No.",   inv["invoice_number"]),
        ("Invoice Date",  inv["invoice_date"]),
        ("Due Date",      inv["due_date"]),
        ("Payment Terms", inv["terms"]),
        ("Currency",      inv["currency"]["code"]),
    ]
    meta_y = y
    for label, value in meta_rows:
        pdf.set_xy(107, meta_y)
        pdf.set_font("Reg", size=8.5)
        pdf.set_text_color(*GREY)
        pdf.cell(30, 5, label, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Bold", size=8.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(53, 5, value, align="R", new_x=XPos.LEFT, new_y=YPos.NEXT)
        meta_y += 5

    y = max(pdf.get_y(), meta_y) + 5

    # ── Line items ───────────────────────────────────────────────────────────
    col_w     = [8, 91, 14, 33, 34]
    col_align = ["C", "L", "C", "R", "R"]
    headers   = ["#", "Description", "Qty", "Unit Price", "Subtotal"]
    row_h     = 7

    pdf.set_xy(15, y)
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Bold", size=8)
    for header, w, align in zip(headers, col_w, col_align):
        pdf.cell(w, row_h, header, border=0, align=align, fill=True,
                 new_x=XPos.RIGHT, new_y=YPos.TOP)
    y += row_h

    for idx, item in enumerate(inv["items"]):
        pdf.set_fill_color(*(LIGHT if idx % 2 == 0 else WHITE))
        pdf.set_text_color(*DARK)
        pdf.set_font("Reg", size=8.5)
        pdf.set_xy(15, y)
        for val, w, align in zip(
            [str(idx + 1), item["description"], str(item["qty"]),
             item["unit_price_fmt"], item["subtotal_fmt"]],
            col_w, col_align,
        ):
            pdf.cell(w, row_h, val, border=0, align=align, fill=True,
                     new_x=XPos.RIGHT, new_y=YPos.TOP)
        y += row_h

    y += 3

    # ── Totals ───────────────────────────────────────────────────────────────
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.3)
    pdf.line(15, y, 195, y)
    y += 4

    tx       = 115
    tw_label = 45
    tw_value = 35

    def totals_row(label, value, bold=False, large=False):
        nonlocal y
        sz = 11 if large else 9
        pdf.set_xy(tx, y)
        pdf.set_font("Bold" if bold else "Reg", size=sz)
        pdf.set_text_color(*(NAVY if bold else GREY))
        pdf.cell(tw_label, 5.5, label, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Bold" if bold else "Reg", size=sz)
        pdf.set_text_color(*(NAVY if bold else DARK))
        pdf.cell(tw_value, 5.5, value, align="R", new_x=XPos.LEFT, new_y=YPos.NEXT)
        y += 5.5

    totals_row("Subtotal", inv["subtotal_fmt"])
    if inv["vat_rate"] > 0:
        totals_row(f"{inv['vat_label']} ({inv['vat_pct']})", inv["vat_amount_fmt"])
    else:
        totals_row(inv["vat_label"], "—")

    y += 1
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.5)
    pdf.line(tx, y, 195, y)
    y += 2
    totals_row("Total Due", inv["total_fmt"], bold=True, large=True)
    y += 5

    # ── Payment details ──────────────────────────────────────────────────────
    payment   = inv["payment"]
    pay_items = [("Bank", payment["bank"]), (payment["ref_label"], payment["ref_value"])]
    if payment["bic"]:
        pay_items.append(("BIC / SWIFT", payment["bic"]))
    pay_items.append(("Payment Reference", inv["invoice_number"]))

    n_rows = (len(pay_items) + 1) // 2
    box_h  = 11 + n_rows * 8 + 2

    pdf.set_fill_color(*LIGHT)
    pdf.set_draw_color(*EDGE)
    pdf.set_line_width(0.3)
    pdf.rect(15, y, W, box_h, style="FD")
    pdf.set_fill_color(*NAVY)
    pdf.rect(15, y, 1.5, box_h, style="F")

    pdf.set_xy(20, y + 3)
    pdf.set_font("Reg", size=7)
    pdf.set_text_color(*GREY)
    pdf.cell(W - 5, 4, "PAYMENT DETAILS", new_x=XPos.LEFT, new_y=YPos.NEXT)

    item_y = y + 9
    for i, (label, value) in enumerate(pay_items):
        ix = 20 + (i % 2) * 80
        iy = item_y + (i // 2) * 8
        pdf.set_xy(ix, iy)
        pdf.set_font("Bold", size=7)
        pdf.set_text_color(*GREY)
        pdf.cell(75, 3.5, label.upper(), new_x=XPos.LEFT, new_y=YPos.NEXT)
        pdf.set_xy(ix, iy + 3.5)
        pdf.set_font("Reg", size=8.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(75, 4, value, new_x=XPos.LEFT, new_y=YPos.NEXT)

    y += box_h + 5

    # ── Footer ───────────────────────────────────────────────────────────────
    pdf.set_draw_color(*EDGE)
    pdf.set_line_width(0.3)
    pdf.line(15, y, 195, y)
    y += 3

    pdf.set_xy(15, y)
    pdf.set_font("Reg", size=7.5)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(
        W, 4.5,
        f"{inv['footer_note']}  Late payments are subject to 1.5% monthly interest.  "
        "Please include the invoice number as the payment reference.  "
        "Thank you for your business!",
        align="C",
    )

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Output writers
# ---------------------------------------------------------------------------

def write_pdf(pdf_bytes: bytes, path: Path) -> None:
    path.write_bytes(pdf_bytes)


def write_png(pdf_bytes: bytes, path: Path, dpi: int = 150) -> None:
    scale = dpi / 72.0
    doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
    page  = doc[0]
    pix   = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
    pix.save(str(path))
    doc.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate dummy student-expense invoice PDFs/PNGs")
    parser.add_argument("--count",    type=int, default=50,           help="Number of invoices (default: 50)")
    parser.add_argument("--output",   type=str, default="./invoices", help="Output directory (default: ./invoices)")
    parser.add_argument("--seed",     type=int, default=None,         help="Random seed for reproducibility")
    parser.add_argument(
        "--currency", type=str, default=None,
        help=f"Lock all invoices to one currency code. Valid: {', '.join(sorted(CURRENCY_BY_CODE))}",
    )
    parser.add_argument(
        "--format", choices=["pdf", "png", "random"], default="random",
        help="Output format: pdf, png, or random (default: random)",
    )
    args = parser.parse_args()

    currency_filter = None
    if args.currency:
        code = args.currency.upper()
        if code not in CURRENCY_BY_CODE:
            print(f"Error: unknown currency '{args.currency}'. "
                  f"Valid codes: {', '.join(sorted(CURRENCY_BY_CODE))}", file=sys.stderr)
            sys.exit(1)
        currency_filter = CURRENCY_BY_CODE[code]

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)

    currency_note = f" ({args.currency.upper()})" if args.currency else " (random currencies)"
    print(f"Generating {args.count} invoice(s){currency_note} → {output_dir.resolve()}")

    for i in range(1, args.count + 1):
        inv       = build_invoice_data(rng, i, currency_filter)
        pdf_bytes = render_invoice_pdf_bytes(inv)

        # Choose format
        if args.format == "pdf":
            fmt_choice = "pdf"
        elif args.format == "png":
            fmt_choice = "png"
        else:
            fmt_choice = rng.choice(["pdf", "png"])

        stem     = inv["invoice_number"]
        out_path = output_dir / f"{stem}.{fmt_choice}"

        if fmt_choice == "pdf":
            write_pdf(pdf_bytes, out_path)
        else:
            write_png(pdf_bytes, out_path)

        # Ground-truth JSON alongside the invoice
        gt = build_ground_truth(inv)
        (output_dir / f"{stem}.json").write_text(
            json.dumps(gt, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        total = fmt(inv["total"], inv["currency"])
        print(f"  [{i:>3}/{args.count}] {out_path.name:<28}  "
              f"{inv['_currency_code']}  {inv['_items_count']} items  {total}")

    print(f"\nDone — {args.count} invoice(s) in {output_dir.resolve()}")


if __name__ == "__main__":
    main()
