import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import useT from '../i18n/useT'
import Icon from '../components/Icon'
import { useAppSelector } from '../store/hooks'
import { selectToken } from '../features/authSlice'
import { apiGet, apiDelete } from '../api/client'

interface InvoiceResponse {
  id: number
  itemName: string
  company: string
  price: number
  category: string | null
  invoiceDate: string | null
  documentId: number | null
}

// Maps the backend `InvoiceCategory` enum values (sent verbatim by the API)
// to the human-readable labels shown in the UI. Keep keys in sync with
// backend/.../model/InvoiceCategory.java.
const CATEGORY_LABELS: Record<string, string> = {
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

function categoryLabel(value: string | null): string {
  if (!value) return '—'
  return CATEGORY_LABELS[value] ?? value
}

type SortKey = 'date' | 'vendor' | 'category' | 'amount'
type SortDir = 'asc' | 'desc'

interface Column {
  key: 'date' | 'vendor' | 'category' | 'amount' | 'action'
  sortKey?: SortKey
  align?: 'right' | 'center'
}

const COLUMNS: readonly Column[] = [
  { key: 'date', sortKey: 'date' },
  { key: 'vendor', sortKey: 'vendor' },
  { key: 'category', sortKey: 'category' },
  { key: 'amount', sortKey: 'amount', align: 'right' },
  { key: 'action', align: 'center' },
]

const inputClass =
  'w-full pl-10 pr-4 py-2 bg-surface rounded-lg border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'

const selectClass =
  'w-full appearance-none pl-4 pr-10 py-2 bg-surface rounded-lg border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function fmtEur(n: number): string {
  return `€ ${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Invoices() {
  const t = useT()
  const token = useAppSelector(selectToken)
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const [category, setCategory] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    apiGet<InvoiceResponse[]>('/api/invoices', token)
      .then(setInvoices)
      .catch(() => {})
  }, [token])

  // When arriving from a chat source (?invoice=<id>), clear any active filters
  // so the row is guaranteed visible, then mark it for highlight + scroll.
  useEffect(() => {
    const target = searchParams.get('invoice')
    if (!target) return
    const id = Number(target)
    if (!Number.isFinite(id) || !invoices.some((inv) => inv.id === id)) return
    setSearch('')
    setYear('')
    setCategory('')
    setMinAmount('')
    setMaxAmount('')
    setHighlightId(id)
    searchParams.delete('invoice')
    setSearchParams(searchParams, { replace: true })
  }, [invoices, searchParams, setSearchParams])

  // Scroll the highlighted row into view and let the highlight fade out.
  useEffect(() => {
    if (highlightId == null) return
    document
      .getElementById(`invoice-${highlightId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setHighlightId(null), 2500)
    return () => clearTimeout(timer)
  }, [highlightId])

  // Years present in the data, newest first — drives the year dropdown.
  const years = useMemo(() => {
    const found = new Set<string>()
    for (const inv of invoices) {
      if (inv.invoiceDate) found.add(inv.invoiceDate.slice(0, 4))
    }
    return [...found].sort((a, b) => b.localeCompare(a))
  }, [invoices])

  // Categories present in the data, sorted by their display label.
  const categories = useMemo(() => {
    const found = new Set<string>()
    for (const inv of invoices) {
      if (inv.category) found.add(inv.category)
    }
    return [...found].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
  }, [invoices])

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLowerCase()
    const min = minAmount === '' ? null : Number(minAmount)
    const max = maxAmount === '' ? null : Number(maxAmount)
    const filtered = invoices.filter((inv) => {
      if (query && !`${inv.company} ${inv.itemName}`.toLowerCase().includes(query)) return false
      if (year && inv.invoiceDate?.slice(0, 4) !== year) return false
      if (category && inv.category !== category) return false
      const price = Number(inv.price)
      if (min !== null && price < min) return false
      if (max !== null && price > max) return false
      return true
    })

    const direction = sortDir === 'asc' ? 1 : -1
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return direction * (a.invoiceDate ?? '').localeCompare(b.invoiceDate ?? '')
        case 'vendor':
          return direction * (a.company ?? '').localeCompare(b.company ?? '')
        case 'category':
          return direction * categoryLabel(a.category).localeCompare(categoryLabel(b.category))
        case 'amount':
          return direction * (Number(a.price) - Number(b.price))
        default:
          return 0
      }
    })
  }, [invoices, search, year, category, minAmount, maxAmount, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('invoices.confirmDelete') ?? 'Delete invoice?')) return
    try {
      await apiDelete<void>(`/api/invoices/${id}`, token)
      setInvoices((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(t('invoices.deleteFailed') ?? 'Delete failed')
    }
  }

  async function handleView(documentId: number | null) {
    if (!documentId) return
    try {
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
      const response = await fetch(`${baseUrl}/api/documents/${documentId}/content`, { headers })
      if (!response.ok) throw new Error(`Failed to load document: ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch {
      // eslint-disable-next-line no-alert
      alert(t('invoices.viewFailed') ?? 'Could not open invoice')
    }
  }

  const total = visibleInvoices.reduce((sum, inv) => sum + Number(inv.price), 0)

  return (
    <div className="space-y-lg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-h1 text-h1 text-on-background mb-2">{t('invoices.title')}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('invoices.subtitle')}
          </p>
        </div>
        <div className="bg-secondary-container text-on-secondary-container px-6 py-4 rounded-xl border border-secondary-fixed-dim/30 shadow-sm flex items-center gap-4 min-w-[250px]">
          <div className="p-3 bg-white/50 rounded-full flex items-center justify-center">
            <Icon name="account_balance_wallet" className="text-secondary" />
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-secondary-container/80 uppercase tracking-wider mb-1">
              {t('invoices.totalFiltered')}
            </p>
            <p className="font-h2 text-h2 text-on-secondary-container">{fmtEur(total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md shadow-[0px_4px_20px_rgba(26,43,60,0.02)] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center flex-1">
          <div className="relative min-w-[240px] flex-1 md:flex-none">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
            <input
              className={inputClass}
              placeholder={t('invoices.search')}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative min-w-[120px]">
            <select
              className={selectClass}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">{t('invoices.allYears')}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
          </div>

          <div className="relative min-w-[200px] flex-1 md:flex-none">
            <select
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t('invoices.allCategories')}</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowMoreFilters((open) => !open)}
          aria-expanded={showMoreFilters}
          className={`font-label-caps text-label-caps uppercase p-2 rounded transition-colors flex items-center gap-2 ${
            showMoreFilters ? 'text-primary bg-surface' : 'text-primary hover:bg-surface'
          }`}
        >
          <Icon name="filter_list" size={18} />
          {t('invoices.moreFilters')}
        </button>

        {showMoreFilters ? (
          <div className="w-full border-t border-outline-variant pt-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                {t('invoices.minAmount')}
              </label>
              <input
                className={`${inputClass} pl-4 min-w-[140px]`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                {t('invoices.maxAmount')}
              </label>
              <input
                className={`${inputClass} pl-4 min-w-[140px]`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="∞"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
            {(minAmount || maxAmount) && (
              <button
                type="button"
                onClick={() => {
                  setMinAmount('')
                  setMaxAmount('')
                }}
                className="font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-on-surface p-2 rounded transition-colors flex items-center gap-1"
              >
                <Icon name="close" size={18} />
                {t('invoices.clearAmount')}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(26,43,60,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-container-high bg-surface-bright">
                {COLUMNS.map(({ key, sortKey: colSort, align }) => (
                  <th
                    key={key}
                    aria-sort={
                      colSort === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={`py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold ${
                      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {colSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(colSort)}
                        className={`inline-flex items-center gap-1 uppercase hover:text-on-surface transition-colors ${
                          align === 'right' ? 'flex-row-reverse' : ''
                        } ${colSort === sortKey ? 'text-on-surface' : ''}`}
                      >
                        {t(`invoices.table.${key}`)}
                        <Icon
                          name={
                            colSort === sortKey
                              ? sortDir === 'asc'
                                ? 'arrow_upward'
                                : 'arrow_downward'
                              : 'unfold_more'
                          }
                          size={16}
                          className={colSort === sortKey ? '' : 'text-outline'}
                        />
                      </button>
                    ) : (
                      t(`invoices.table.${key}`)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {visibleInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  id={`invoice-${inv.id}`}
                  className={`transition-colors group ${
                    highlightId === inv.id
                      ? 'bg-primary/10 ring-2 ring-inset ring-primary'
                      : 'hover:bg-surface'
                  }`}
                >
                  <td className="py-4 px-6 font-data-mono text-data-mono text-on-surface">
                    {fmtDate(inv.invoiceDate)}
                  </td>
                  <td className="py-4 px-6 font-body-md text-body-md text-on-surface font-medium">
                    {inv.company || '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-body-sm text-body-sm border border-outline-variant/50">
                      {categoryLabel(inv.category)}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-data-mono text-data-mono text-on-surface text-right font-medium">
                    {fmtEur(inv.price)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleView(inv.documentId)}
                        className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={t('invoices.table.viewReceipt')}
                        disabled={!inv.documentId}
                      >
                        <Icon name="visibility" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={t('invoices.table.delete')}
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-surface-container-high bg-surface-bright flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t('invoices.pagination')}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="p-2 text-outline hover:text-on-surface transition-colors disabled:opacity-50"
              disabled
            >
              <Icon name="chevron_left" />
            </button>
            <button className="p-2 text-outline hover:text-on-surface transition-colors">
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
