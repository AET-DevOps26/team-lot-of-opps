import { useCallback, useEffect, useState } from 'react'
import { api, unwrap, authHeaders, BASE_URL } from '../api/client'
import type { ExportSummaryResponse } from '../api/types'
import Icon from '../components/Icon'
import useT from '../i18n/useT'
import { formatEuro, useCategoryLabel } from '../lib/invoices'

const CARD_SHADOW = 'shadow-[0px_4px_20px_rgba(26,43,60,0.05)]'
const CARD_BASE = `bg-surface-container-lowest border border-outline-variant rounded-xl p-6 ${CARD_SHADOW}`

type ExportFormat = 'zip' | 'pdf' | 'csv'

const FORMATS: readonly { format: ExportFormat; icon: string }[] = [
  { format: 'zip', icon: 'folder_zip' },
  { format: 'pdf', icon: 'picture_as_pdf' },
  { format: 'csv', icon: 'table_view' },
]

/**
 * The export endpoints need the Firebase bearer token, so a plain <a download> would 401.
 * Fetch the bytes, then hand the browser an object URL to save.
 */
async function downloadExport(format: ExportFormat, year: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1/exports/${format}?year=${year}`, {
    headers: await authHeaders(),
  })
  if (!response.ok) throw new Error(`Export failed: ${response.status}`)

  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `taxforward-export-${year}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export default function Export() {
  const t = useT()
  const categoryLabel = useCategoryLabel()

  const [years, setYears] = useState<number[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [summary, setSummary] = useState<ExportSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [downloading, setDownloading] = useState<ExportFormat | null>(null)
  const [downloadError, setDownloadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    unwrap(api.GET('/api/v1/exports/years'))
      .then((data) => {
        if (cancelled) return
        const available = data ?? []
        setYears(available)
        setYear(available[0] ?? null)
        if (available.length === 0) setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (year == null) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    unwrap(api.GET('/api/v1/exports/summary', { params: { query: { year } } }))
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  const handleDownload = useCallback(
    async (format: ExportFormat) => {
      if (year == null) return
      setDownloading(format)
      setDownloadError(false)
      try {
        await downloadExport(format, year)
      } catch {
        setDownloadError(true)
      } finally {
        setDownloading(null)
      }
    },
    [year],
  )

  return (
    <>
      <div className="mb-10">
        <h1 className="font-h1 text-h1 text-primary mb-2">{t('export.title')}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t('export.subtitle')}</p>
      </div>

      {years.length === 0 && !loading ? (
        <section className={CARD_BASE}>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {loadError ? t('export.loadFailed') : t('export.noYears')}
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className={CARD_BASE}>
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h3 className="font-h3 text-h3 text-primary">{t('export.summary.title')}</h3>
                <label className="flex items-center gap-2">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('export.taxYear')}
                  </span>
                  <select
                    value={year ?? ''}
                    onChange={(e) => setYear(Number(e.target.value))}
                    aria-label={t('export.taxYear')}
                    // pr-8 keeps the native dropdown arrow from overlapping the year.
                    className="rounded-lg border border-surface-container-highest bg-surface pl-3 pr-8 py-1.5 font-data-mono text-data-mono text-primary"
                  >
                    {years.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {loadError ? (
                <p className="font-body-sm text-body-sm text-error">{t('export.loadFailed')}</p>
              ) : loading || summary == null ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('export.summary.loading')}
                </p>
              ) : summary.invoiceCount === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('export.summary.empty')}
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                      <th className="pb-2">{t('export.table.category')}</th>
                      <th className="pb-2 text-right">{t('export.table.receipts')}</th>
                      <th className="pb-2 text-right">{t('export.table.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categories.map((row) => (
                      <tr
                        key={row.category ?? 'uncategorized'}
                        className="border-t border-surface-container-highest"
                      >
                        <td className="py-2 font-body-sm text-body-sm text-on-surface">
                          {row.category
                            ? categoryLabel(row.category)
                            : t('export.table.uncategorized')}
                        </td>
                        <td className="py-2 text-right font-body-sm text-body-sm text-on-surface-variant">
                          {row.invoiceCount}
                        </td>
                        <td className="py-2 text-right font-data-mono text-data-mono text-primary">
                          {formatEuro(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-container-highest">
                      <td className="pt-3 font-body-md text-body-md font-semibold text-primary">
                        {t('export.table.total')}
                      </td>
                      <td className="pt-3 text-right font-body-sm text-body-sm text-on-surface-variant">
                        {summary.invoiceCount}
                      </td>
                      <td className="pt-3 text-right font-data-mono text-data-mono text-secondary font-semibold">
                        {formatEuro(summary.totalExpenses)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className={CARD_BASE}>
              <h3 className="font-h3 text-h3 text-primary mb-4">{t('export.downloads.title')}</h3>
              <div className="space-y-3">
                {FORMATS.map(({ format, icon }) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleDownload(format)}
                    disabled={year == null || downloading != null}
                    className="w-full flex items-start gap-3 rounded-lg border border-outline-variant bg-white p-3 text-left transition-colors hover:bg-surface-container disabled:opacity-50"
                  >
                    <span className="mt-0.5 text-primary">
                      <Icon name={downloading === format ? 'hourglass_top' : icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-body-md text-body-md font-semibold text-primary">
                        {downloading === format
                          ? t('export.downloads.preparing')
                          : t(`export.downloads.${format}`)}
                      </span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant">
                        {t(`export.downloads.${format}Hint`)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {downloadError ? (
                <p role="alert" className="mt-4 font-body-sm text-body-sm text-error">
                  {t('export.downloads.failed')}
                </p>
              ) : null}

              <p className="mt-6 text-xs leading-snug text-on-surface-variant">
                {t('export.disclaimer')}
              </p>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
