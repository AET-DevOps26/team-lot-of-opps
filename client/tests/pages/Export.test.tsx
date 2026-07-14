import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Export from '../../src/pages/Export'
import translations from '../../src/i18n/translations'
import type { ExportSummaryResponse } from '../../src/api/types'
import { renderWithProviders } from '../test-utils'

const apiGet = vi.fn()

vi.mock('../../src/api/client', () => ({
  api: { GET: (...args: unknown[]) => apiGet(...args) },
  unwrap: (promise: Promise<unknown>) => promise,
  authHeaders: async () => ({ Authorization: 'Bearer token' }),
  BASE_URL: '',
}))

const t = translations.en.export

/** The download labels contain "(ZIP)" etc., so they need escaping before becoming a matcher. */
const byLabel = (label: string) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

function summary(overrides: Partial<ExportSummaryResponse> = {}): ExportSummaryResponse {
  return {
    year: 2025,
    invoiceCount: 2,
    totalExpenses: 1400.5,
    lumpSumAllowance: 1230,
    deductibleAboveLumpSum: 170.5,
    categories: [
      { category: 'ARBEITSMITTEL', invoiceCount: 1, total: 999.99 },
      { category: null, invoiceCount: 1, total: 400.51 },
    ],
    ...overrides,
  }
}

/** Routes each endpoint the page calls; `years` first, then `summary` for the selected year. */
function stubApi(
  years: number[],
  summaries: Record<number, ExportSummaryResponse | Promise<ExportSummaryResponse>> = {},
) {
  apiGet.mockImplementation((path: string, options?: { params?: { query?: { year: number } } }) => {
    if (path === '/api/v1/exports/years') return Promise.resolve(years)
    if (path === '/api/v1/exports/summary') {
      const year = options?.params?.query?.year as number
      return summaries[year]
        ? Promise.resolve(summaries[year])
        : Promise.reject(new Error('no summary'))
    }
    return Promise.reject(new Error(`unexpected path ${path}`))
  })
}

describe('Export page', () => {
  beforeEach(() => {
    apiGet.mockReset()
    vi.unstubAllGlobals()
  })

  it('tells the user there is nothing to export before any invoice is accepted', async () => {
    stubApi([])
    renderWithProviders(<Export />)

    expect(await screen.findByText(t.noYears)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: byLabel(t.downloads.zip) })).toBeNull()
  })

  it('defaults to the most recent tax year and shows its figures', async () => {
    stubApi([2025, 2024], { 2025: summary() })
    renderWithProviders(<Export />)

    expect(await screen.findByText('€ 1.400,50')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: t.taxYear })).toHaveValue('2025')
    expect(screen.getByText(t.table.total)).toBeInTheDocument()
    expect(screen.getByText('€ 999,99')).toBeInTheDocument()
    // The allowance calculation lives in the exported PDF, not on the page.
    expect(screen.queryByText(/1\.230/)).toBeNull()
  })

  it('labels the null category as uncategorized rather than dropping the row', async () => {
    stubApi([2025], { 2025: summary() })
    renderWithProviders(<Export />)

    expect(await screen.findByText(t.table.uncategorized)).toBeInTheDocument()
    expect(screen.getByText('€ 400,51')).toBeInTheDocument()
  })

  it('shows a loading state instead of the previous year while switching', async () => {
    const user = userEvent.setup()
    let release!: (value: ExportSummaryResponse) => void
    const pending = new Promise<ExportSummaryResponse>((resolve) => {
      release = resolve
    })
    stubApi([2025, 2024], { 2025: summary(), 2024: pending })
    renderWithProviders(<Export />)

    await screen.findByText('€ 1.400,50')
    await user.selectOptions(screen.getByRole('combobox', { name: t.taxYear }), '2024')

    // 2025's figures must not linger under the 2024 selection.
    expect(screen.getByText(t.summary.loading)).toBeInTheDocument()
    expect(screen.queryByText('€ 1.400,50')).toBeNull()

    release(summary({ year: 2024, totalExpenses: 50 }))
    expect(await screen.findByText('€ 50,00')).toBeInTheDocument()
  })

  it('reloads the summary when another tax year is picked', async () => {
    const user = userEvent.setup()
    stubApi([2025, 2024], {
      2025: summary(),
      2024: summary({ year: 2024, totalExpenses: 50, deductibleAboveLumpSum: 0 }),
    })
    renderWithProviders(<Export />)

    await screen.findByText('€ 1.400,50')
    await user.selectOptions(screen.getByRole('combobox', { name: t.taxYear }), '2024')

    expect(await screen.findByText('€ 50,00')).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/api/v1/exports/summary', {
      params: { query: { year: 2024 } },
    })
  })

  it('downloads the selected year with the auth header and the right filename', async () => {
    const user = userEvent.setup()
    stubApi([2025], { 2025: summary() })

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['zip']) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderWithProviders(<Export />)
    await screen.findByText('€ 1.400,50')
    await user.click(screen.getByRole('button', { name: byLabel(t.downloads.zip) }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/exports/zip?year=2025', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(click).toHaveBeenCalledOnce()
  })

  it('surfaces a failed download instead of silently saving nothing', async () => {
    const user = userEvent.setup()
    stubApi([2025], { 2025: summary() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    renderWithProviders(<Export />)
    await screen.findByText('€ 1.400,50')
    await user.click(screen.getByRole('button', { name: byLabel(t.downloads.pdf) }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t.downloads.failed)
  })

  it('reports a load failure rather than rendering an empty year', async () => {
    stubApi([2025])
    renderWithProviders(<Export />)

    expect(await screen.findByText(t.loadFailed)).toBeInTheDocument()
  })
})
