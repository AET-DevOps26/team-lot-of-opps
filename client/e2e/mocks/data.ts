import type { InvoiceResponse, SuggestionResponse } from '../../src/api/types'

/** Shared account seeded into the Firebase Auth emulator for e2e. */
export const TEST_USER = { email: 'e2e@example.com', password: 'password123' }

let autoId = 9000

/** Build an InvoiceResponse, filling in sane defaults for omitted fields. */
export function makeInvoice(
  partial: Partial<InvoiceResponse> & { price: number },
): InvoiceResponse {
  const id = partial.id ?? autoId++
  return {
    id,
    itemName: partial.itemName ?? `Item ${id}`,
    company: partial.company ?? `Vendor ${id}`,
    price: partial.price,
    category: partial.category ?? null,
    userId: 'e2e-user',
    invoiceDate: partial.invoiceDate ?? null,
    createdAt: partial.createdAt ?? '2024-01-01T00:00:00Z',
    documentId: partial.documentId ?? null,
    status: partial.status ?? 'ACCEPTED',
  }
}

/** Deterministic dataset spanning multiple years/categories/amounts. */
export function defaultInvoices(): InvoiceResponse[] {
  return [
    makeInvoice({ id: 1, itemName: 'Laptop', company: 'TechStore', price: 999.99, category: 'ARBEITSMITTEL', invoiceDate: '2024-03-15' }),
    makeInvoice({ id: 2, itemName: 'Semester ticket', company: 'Deutsche Bahn', price: 350, category: 'REISEKOSTEN', invoiceDate: '2024-09-01' }),
    makeInvoice({ id: 3, itemName: 'Textbooks', company: 'Bookshop', price: 120.5, category: 'FORTBILDUNGEN', invoiceDate: '2023-10-20' }),
    makeInvoice({ id: 4, itemName: 'Internet', company: 'Telekom', price: 45, category: 'INTERNET_UND_TELEFON', invoiceDate: '2024-01-10' }),
    makeInvoice({ id: 5, itemName: 'Desk', company: 'IKEA', price: 200, category: 'HOMEOFFICE_UND_ARBEITSZIMMER', invoiceDate: '2023-05-05' }),
    makeInvoice({ id: 6, itemName: 'Course fee', company: 'Udemy', price: 89.99, category: 'FORTBILDUNGEN', invoiceDate: '2024-06-30' }),
  ]
}

export function defaultSuggestions(): SuggestionResponse[] {
  return [
    { suggestion: 'Consider deducting your **Laptop** as work equipment.', createdAt: '2024-04-01T10:00:00Z' },
    { suggestion: 'Your semester ticket may qualify as travel expenses.', createdAt: '2024-04-02T10:00:00Z' },
  ]
}

/** Sum of invoice prices — mirrors the dashboard's total calculation. */
export const sumPrices = (list: InvoiceResponse[]): number =>
  list.reduce((total, inv) => total + Number(inv.price || 0), 0)
