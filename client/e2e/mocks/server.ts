import type { Page, Route } from '@playwright/test'
import type { InvoiceResponse, SuggestionResponse } from '../../src/api/types'
import { defaultInvoices, defaultSuggestions } from './data'

/**
 * A stateful, in-browser mock of the backend REST API. Routes mutate a shared
 * store so create/edit/delete/accept/upload flows are genuinely verifiable, and
 * suggestion responses are configurable (list / empty / error / delayed) so the
 * dashboard's loading and error branches can be exercised.
 */
export interface MockApi {
  /** Current invoices in the store (read-only view). */
  readonly invoices: InvoiceResponse[]
  setInvoices(list: InvoiceResponse[]): void
  setSuggestions(list: SuggestionResponse[]): void
  setSuggestionsError(on?: boolean): void
  setSuggestionsDelay(ms: number): void
}

export async function createMockApi(page: Page): Promise<MockApi> {
  const state = {
    invoices: defaultInvoices(),
    suggestions: defaultSuggestions(),
    suggestionsError: false,
    suggestionsDelay: 0,
    nextId: 7000,
  }

  // Pin the UI language so text/role selectors are deterministic.
  await page.addInitScript(() => {
    window.localStorage.setItem('app.language', 'en')
  })

  const json = (route: Route, status: number, data: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // ---- /api/v1/invoices (collection) ----
    if (/\/api\/v1\/invoices$/.test(path)) {
      if (method === 'GET') {
        const status = url.searchParams.get('status')
        const limit = url.searchParams.get('limit')
        let list = [...state.invoices]
        if (status) list = list.filter((inv) => inv.status === status)
        // The "recent" list (limit, no status) represents kept invoices only.
        if (limit) list = list.filter((inv) => inv.status !== 'PENDING').slice(0, Number(limit))
        return json(route, 200, list)
      }
      if (method === 'POST') {
        const body = request.postDataJSON() as Partial<InvoiceResponse>
        const created: InvoiceResponse = {
          id: state.nextId++,
          itemName: body.itemName ?? '',
          company: body.company ?? '',
          price: Number(body.price ?? 0),
          category: (body.category as InvoiceResponse['category']) ?? null,
          userId: 'e2e-user',
          invoiceDate: body.invoiceDate ?? null,
          createdAt: new Date().toISOString(),
          documentId: null,
          status: 'ACCEPTED',
        }
        state.invoices = [created, ...state.invoices]
        return json(route, 200, created)
      }
    }

    // ---- /api/v1/invoices/{id}/accept ----
    const acceptMatch = path.match(/\/api\/v1\/invoices\/(\d+)\/accept$/)
    if (acceptMatch && method === 'POST') {
      const inv = state.invoices.find((i) => i.id === Number(acceptMatch[1]))
      if (!inv) return json(route, 404, { message: 'not found' })
      inv.status = 'ACCEPTED'
      return json(route, 200, inv)
    }

    // ---- /api/v1/invoices/{id} ----
    const idMatch = path.match(/\/api\/v1\/invoices\/(\d+)$/)
    if (idMatch) {
      const id = Number(idMatch[1])
      const inv = state.invoices.find((i) => i.id === id)
      if (method === 'PUT') {
        if (!inv) return json(route, 404, { message: 'not found' })
        const body = request.postDataJSON() as Partial<InvoiceResponse>
        inv.itemName = body.itemName ?? inv.itemName
        inv.company = body.company ?? inv.company
        if (body.price != null) inv.price = Number(body.price)
        if (body.category !== undefined) inv.category = body.category as InvoiceResponse['category']
        if (body.invoiceDate !== undefined) inv.invoiceDate = body.invoiceDate ?? null
        return json(route, 200, inv)
      }
      if (method === 'DELETE') {
        state.invoices = state.invoices.filter((i) => i.id !== id)
        return json(route, 200, {})
      }
    }

    // ---- /api/v1/suggestions ----
    if (/\/api\/v1\/suggestions$/.test(path) && method === 'GET') {
      if (state.suggestionsDelay) await new Promise((r) => setTimeout(r, state.suggestionsDelay))
      if (state.suggestionsError) return json(route, 500, { message: 'boom' })
      return json(route, 200, state.suggestions)
    }

    // ---- /api/v1/documents/upload ----
    if (/\/api\/v1\/documents\/upload$/.test(path) && method === 'POST') {
      const id = state.nextId++
      const extracted: InvoiceResponse = {
        id,
        itemName: 'Uploaded item',
        company: 'Acme GmbH',
        price: 42.5,
        category: 'ARBEITSMITTEL',
        userId: 'e2e-user',
        invoiceDate: '2024-05-01',
        createdAt: new Date().toISOString(),
        documentId: id,
        status: 'PENDING',
      }
      state.invoices = [extracted, ...state.invoices]
      return json(route, 200, { message: 'ok', filename: 'receipt.pdf', documentId: id, invoiceIds: [id] })
    }

    // ---- /api/v1/documents/{id}/content ----
    if (/\/api\/v1\/documents\/(\d+)\/content$/.test(path) && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' })
    }

    // Anything unmatched: succeed with an empty body so nothing hangs.
    return json(route, 200, {})
  })

  return {
    get invoices() {
      return state.invoices
    },
    setInvoices(list) {
      state.invoices = list
    },
    setSuggestions(list) {
      state.suggestions = list
      state.suggestionsError = false
    },
    setSuggestionsError(on = true) {
      state.suggestionsError = on
    },
    setSuggestionsDelay(ms) {
      state.suggestionsDelay = ms
    },
  }
}
