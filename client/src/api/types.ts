// Friendly aliases over the generated OpenAPI types in `schema.ts`.
// `schema.ts` is generated from api/openapi.yaml (npm run openapi:types) and is
// the single source of truth — import domain types from here, not by hand.

import type { components } from './schema'

type Schemas = components['schemas']

export type InvoiceResponse = Schemas['InvoiceResponse']
export type InvoiceRequest = Schemas['InvoiceRequest']
export type DocumentResponse = Schemas['DocumentResponse']
export type UploadResponse = Schemas['UploadResponse']
export type SuggestionResponse = Schemas['SuggestionResponse']
export type InvoiceCategory = Schemas['InvoiceCategory']
export type InvoiceStatus = Schemas['InvoiceStatus']
export type ExportSummaryResponse = Schemas['ExportSummaryResponse']
export type ExportCategoryTotal = Schemas['ExportCategoryTotal']
