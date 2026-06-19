# Problem Statement — TaxForward

## The problem

In Germany, students and trainees are allowed to deduct study- and job-related
expenses (Werbungskosten / Sonderausgaben) from their taxes. Because most of
them earn little or nothing while studying, they don't owe tax yet — so they
assume filing is pointless and throw their receipts away.

That assumption is expensive. By filing a tax return with these expenses, a
student creates a **loss carry-forward** (*Verlustvortrag*): the accumulated
deductible costs are carried into future years and reduce the tax bill once they
start earning a real salary. A few years of saved receipts can translate into a
four-figure refund after graduation.

The practical barriers are:

- **It's tedious.** Receipts and invoices pile up as paper and PDFs, in
  different formats and languages, with no structure.
- **It's confusing.** Most people don't know which expenses are deductible, or
  which category they belong to.
- **Things get forgotten.** Deductible costs often come in pairs (a conference
  fee implies travel and a hotel; a home-office claim implies an internet bill).
  Users upload one and never realize the matching document is missing.

**TaxForward** removes these barriers: users drop in their receipts, and the app
does the structuring, categorizing, and reminding for them.

## Main functionality

TaxForward is a full-stack web application that turns a pile of receipts into an
organized, tax-ready overview of deductible expenses.

1. **Upload** — The user uploads a receipt or invoice (PDF or image).
2. **Automatic extraction** — An AI pipeline reads the document and pulls out the
   individual line items: what was bought, from which seller, the amount, the
   date, and the matching German tax category.
3. **Organized overview** — Extracted items are stored and shown in a dashboard,
   grouped by tax category, so the user always sees their running total of
   deductible expenses.
4. **Proactive suggestions** — The app analyzes what's already uploaded and
   suggests complementary documents the user is probably missing, to maximize
   the eventual refund.
5. **Conversational assistant** — A chatbot lets the user ask questions about
   their own documents in plain language ("What did I spend on training this
   year?", "What should I still upload?") and answers with references to specific
   invoices.

## Intended users

- **German university students** who work part-time, do internships, or have
  study costs (laptops, books, courses, commuting, a study room at home).
- **Trainees and apprentices** (*Auszubildende*) in their first low-income years.
- **Early-career young professionals** who kept receipts during their studies and
  now want to claim the loss carry-forward in their first full tax year.

These users are typically **tax novices**: comfortable with apps, but unfamiliar
with tax rules and unwilling to spend money on a tax advisor. They need guidance,
not a spreadsheet.

## How GenAI is integrated meaningfully

GenAI is not a bolt-on feature — it is what makes the app possible. Three
distinct, purposeful integrations:

### 1. Document understanding (vision + extraction)
When a document is uploaded, the `invoice-service` renders it to an image and
sends it to a vision-capable LLM with a carefully engineered prompt. The model
returns **structured line items** — product, seller, net amount, date, and tax
category — handling messy real-world details that rule-based OCR can't: German
decimal commas, distinguishing the seller from the buyer and the bank, ignoring
subtotal/VAT/payment rows, and normalizing dates. This replaces hours of manual
data entry.

### 2. Proactive tax suggestions
The `suggestions-service` feeds the user's extracted invoices to an LLM that
reasons about **German tax deduction pairs** (e.g. *hotel receipt → train/flight
receipt*, *internet bill → phone bill*, *home-office claim → internet bill*). It
returns a few specific, actionable prompts that reference the user's real items —
"You uploaded a hotel in Berlin; do you have the train or flight receipt?" — so
the user doesn't leave money on the table.

### 3. Conversational RAG assistant
The `llm-chat` service runs a LangChain agent over a **pgvector** semantic index
of the user's documents. The agent has tools to list documents, run semantic
search, and analyze missing categories. It answers natural-language questions,
responds in the user's language (German or English), and **cites the specific
invoices** (company, date, amount) behind every answer, so responses are
grounded and verifiable rather than hallucinated.

Together these turn raw receipts into structured data (1), tell the user what's
missing (2), and let them explore everything conversationally (3).

## Example scenarios

**Scenario A — Uploading a receipt.**
Lena, a CS student, photographs the invoice for a Python course she paid for.
She uploads it. Within seconds the app extracts "Python course — 149.00 € —
2026-03-12 — FORTBILDUNGEN" and adds it to her dashboard under *Further
education*. She didn't type anything.

**Scenario B — Catching a missing document.**
The dashboard shows a suggestion: *"You uploaded a hotel in Berlin — do you have
the train or flight ticket? Travel costs (Reisekosten) require both."* Lena
remembers the train booking in her inbox, uploads it, and her deductible total
goes up.

**Scenario C — Asking a question.**
Before the filing deadline Lena opens the chat and asks, *"How much did I spend
on work equipment this year?"* The assistant runs a semantic search, lists her
laptop and desk lamp invoices with amounts and dates, and gives the total.

**Scenario D — Maximizing the refund.**
Lena asks, *"What should I still upload to get the most back?"* The assistant
checks which tax categories she has no documents in and replies with concrete
recommendations — commuting tickets, internet bill, union membership proof — so
she can gather the last few receipts before filing.

The result: a student who would have skipped filing entirely ends the year with a
clean, categorized, AI-assisted record that becomes a real tax refund later.
