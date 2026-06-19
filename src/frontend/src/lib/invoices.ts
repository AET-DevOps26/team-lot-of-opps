// Shared invoice domain types and helpers used across the Invoices and Upload pages.

export type InvoiceStatus = 'PENDING' | 'ACCEPTED'

export interface InvoiceResponse {
  id: number
  itemName: string
  company: string
  price: number
  category: string | null
  invoiceDate: string | null
  documentId: number | null
  // Present since the review feature; absent on responses from older endpoints.
  status?: InvoiceStatus
}

// Maps the backend `InvoiceCategory` enum values (sent verbatim by the API)
// to the human-readable labels shown in the UI. Keep keys in sync with
// backend/.../model/InvoiceCategory.java.
export const CATEGORY_LABELS: Record<string, string> = {
  KONTOFUEHRUNGSGEBUEHREN: 'Kontoführungsgebühren',
  WEGE_ZUR_ARBEIT: 'Wege zur Arbeit',
  HOMEOFFICE_UND_ARBEITSZIMMER: 'Homeoffice und Arbeitszimmer',
  INTERNET_UND_TELEFON: 'Internet und Telefon',
  ARBEITSMITTEL: 'Arbeitsmittel',
  BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN: 'Berufsverbände und Gewerkschaften',
  STEUERBERATUNGSKOSTEN: 'Steuerberatungskosten',
  REISEKOSTEN: 'Reisekosten',
  BEWERBUNGEN: 'Bewerbungen',
  FORTBILDUNGEN: 'Fortbildungen',
  UMZUG: 'Umzug',
  BEWIRTUNG: 'Bewirtung',
  DOPPELTER_HAUSHALT: 'Doppelter Haushalt',
  AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN: 'Außergewöhnliche Fahrzeugkosten',
  SONSTIGE_AUSGABEN: 'Sonstige Ausgaben',
}

export function categoryLabel(value: string | null): string {
  if (!value) return '—'
  return CATEGORY_LABELS[value] ?? value
}
