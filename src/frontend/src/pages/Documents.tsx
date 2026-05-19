import { useState, useEffect } from 'react'
import useT from '../i18n/useT'
import Icon from '../components/Icon'
import { useAppSelector } from '../store/hooks'
import { selectToken } from '../features/authSlice'
import { apiGet } from '../api/client'

interface InvoiceResponse {
  id: number
  itemName: string
  company: string
  price: number
  category: string | null
  invoiceDate: string | null
}

const CATEGORIES: readonly string[] = [
  'Arbeitsmittel',
  'Fahrtkosten',
  'Fachliteratur',
  'Fortbildungskosten',
  'Bewerbungskosten',
  'Umzugskosten',
  'Reisekosten',
  'Verpflegungsmehraufwand',
  'Doppelte Haushaltsführung',
  'Kontoführungsgebühren',
  'Telekommunikation',
  'Berufskleidung',
  'Arbeitszimmer',
  'Sonstige Werbekosten',
  'Steuerberatungskosten',
]

const TABLE_COLUMNS = ['date', 'vendor', 'category'] as const

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

export default function Documents() {
  const t = useT()
  const token = useAppSelector(selectToken)
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])

  useEffect(() => {
    apiGet<InvoiceResponse[]>('/api/invoices', token)
      .then(setInvoices)
      .catch(() => {})
  }, [token])

  const total = invoices.reduce((sum, inv) => sum + Number(inv.price), 0)

  return (
    <div className="space-y-lg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-h1 text-h1 text-on-background mb-2">{t('documents.title')}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('documents.subtitle')}
          </p>
        </div>
        <div className="bg-secondary-container text-on-secondary-container px-6 py-4 rounded-xl border border-secondary-fixed-dim/30 shadow-sm flex items-center gap-4 min-w-[250px]">
          <div className="p-3 bg-white/50 rounded-full flex items-center justify-center">
            <Icon name="account_balance_wallet" className="text-secondary" />
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-secondary-container/80 uppercase tracking-wider mb-1">
              {t('documents.totalFiltered')}
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
            <input className={inputClass} placeholder={t('documents.search')} type="text" />
          </div>

          <div className="relative min-w-[120px]">
            <select className={selectClass} defaultValue="">
              <option value="">{t('documents.allYears')}</option>
              <option>2023</option>
              <option>2022</option>
              <option>2021</option>
            </select>
            <Icon
              name="expand_more"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
          </div>

          <div className="relative min-w-[200px] flex-1 md:flex-none">
            <select className={selectClass} defaultValue="">
              <option value="">{t('documents.allCategories')}</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
          </div>
        </div>
        <button className="font-label-caps text-label-caps uppercase text-primary hover:bg-surface p-2 rounded transition-colors flex items-center gap-2">
          <Icon name="filter_list" size={18} />
          {t('documents.moreFilters')}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0px_4px_20px_rgba(26,43,60,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-container-high bg-surface-bright">
                {TABLE_COLUMNS.map((key) => (
                  <th
                    key={key}
                    className="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold"
                  >
                    {t(`documents.table.${key}`)}
                  </th>
                ))}
                <th className="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                  {t('documents.table.amount')}
                </th>
                <th className="py-4 px-6 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold text-center">
                  {t('documents.table.action')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-surface transition-colors group"
                >
                  <td className="py-4 px-6 font-data-mono text-data-mono text-on-surface">
                    {fmtDate(inv.invoiceDate)}
                  </td>
                  <td className="py-4 px-6 font-body-md text-body-md text-on-surface font-medium">
                    {inv.company || '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-body-sm text-body-sm border border-outline-variant/50">
                      {inv.category ?? '—'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-data-mono text-data-mono text-on-surface text-right font-medium">
                    {fmtEur(inv.price)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title={t('documents.table.viewReceipt')}
                    >
                      <Icon name="visibility" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-surface-container-high bg-surface-bright flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t('documents.pagination')}
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
