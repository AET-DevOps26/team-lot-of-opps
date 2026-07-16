// Shared invoice domain types and helpers used across the Invoices and Upload pages.
//
// Types are generated from api/openapi.yaml (see client/src/api/schema.ts) and
// re-exported here so existing import sites keep working unchanged.

import { useCallback } from 'react'
import useT from '../i18n/useT'

export type { InvoiceResponse, InvoiceStatus } from '../api/types'

// Backend `InvoiceCategory` enum values, sent verbatim by the API. Keep in sync
// with backend/.../model/InvoiceCategory.java and the `categories` blocks in
// i18n/translations.ts (which hold the localized labels).
export const CATEGORY_KEYS = [
  'KONTOFUEHRUNGSGEBUEHREN',
  'WEGE_ZUR_ARBEIT',
  'HOMEOFFICE_UND_ARBEITSZIMMER',
  'INTERNET_UND_TELEFON',
  'ARBEITSMITTEL',
  'BERUFSVERBÄNDE_UND_GEWERKSCHAFTEN',
  'STEUERBERATUNGSKOSTEN',
  'REISEKOSTEN',
  'BEWERBUNGEN',
  'FORTBILDUNGEN',
  'UMZUG',
  'BEWIRTUNG',
  'DOPPELTER_HAUSHALT',
  'AUSSERGEWOEHNLICHE_FAHRZEUGKOSTEN',
  'SONSTIGE_AUSGABEN',
] as const

// Returns a `(category) => localized label` function bound to the active language.
export function useCategoryLabel(): (value: string | null) => string {
  const t = useT()
  return useCallback((value) => (value ? t(`categories.${value}`) : '—'), [t])
}

// Formats an amount the way German tax documents expect it: `€ 1.234,56`.
// Used everywhere money is shown so on-screen figures match the exported PDF,
// which renders the same de-DE convention.
export function formatEuro(amount: number): string {
  return `€ ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
