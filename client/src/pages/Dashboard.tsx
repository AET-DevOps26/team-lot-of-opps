import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useT from '../i18n/useT'
import Icon from '../components/Icon'
import { apiGet } from '../api/client'
import type { SuggestionResponse } from '../api/types'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAppSelector } from '../store/hooks'
import { selectLanguage } from '../features/i18nSlice'
import { categoryLabel } from '../lib/invoices'

const TAX_RATE_STORAGE_KEY = 'dashboard.taxRatePercent'
const UPLOAD_SNAPSHOT_STORAGE_KEY = 'dashboard.uploadSnapshot'
const DEFAULT_TAX_RATE_PERCENT = 30
const MIN_TAX_RATE_PERCENT = 0
const MAX_TAX_RATE_PERCENT = 50

const clampTaxRate = (value: number) =>
  Math.max(MIN_TAX_RATE_PERCENT, Math.min(MAX_TAX_RATE_PERCENT, value))

interface ExpenseBar {
  label: string
  amount: string
  width: string
  bar: string
}


function formatSuggestionDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Lightweight rendering for the simple markdown the LLM emits (bullet lists and
// **bold**). Avoids pulling in a full markdown dependency for these few cases.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  )
}

function renderSuggestion(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const blocks: JSX.Element[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      bullets.push(bullet[1])
    } else {
      flushBullets()
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>)
    }
  }
  flushBullets()
  return blocks
}

interface SummaryCardProps {
  label: string
  value: string
  icon: string
  hint?: string
  hintIcon?: string
  hintColor?: string
  highlight?: boolean
}

// placeholder until we fetch real data
const EMPTY_BARS: readonly ExpenseBar[] = []

const CARD_SHADOW = 'shadow-[0px_4px_20px_rgba(26,43,60,0.05)]'
const CARD_BASE = `bg-surface-container-lowest border border-outline-variant rounded-xl p-6 ${CARD_SHADOW}`
const SUMMARY_CARD_BASE = `bg-surface-container-lowest border border-outline-variant rounded-xl p-4 ${CARD_SHADOW}`

function IntelligenceRail() {
  return <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#9333ea] to-[#2563eb]" />
}

function SummaryCard({ label, value, icon, hint, hintIcon, hintColor, highlight = false }: SummaryCardProps) {
  const containerClass = highlight
    ? `relative overflow-hidden bg-[#ECFDF5] border border-secondary-fixed-dim rounded-xl p-4 ${CARD_SHADOW}`
    : SUMMARY_CARD_BASE

  const labelClass = highlight ? 'text-on-secondary-container' : 'text-on-surface-variant'
  const valueClass = highlight ? 'text-secondary' : 'text-primary'
  const hintTextClass = highlight ? 'text-on-secondary-fixed-variant' : hintColor || 'text-on-surface-variant'
  const iconClass = highlight
    ? 'bg-white/60 text-secondary'
    : 'bg-primary/10 text-primary'

  return (
    <div className={containerClass}>
      {highlight && <IntelligenceRail />}
      <div className="flex items-center justify-between gap-4 mb-1">
        <p className={`min-w-0 break-words font-label-caps text-label-caps uppercase tracking-widest ${labelClass}`}>
          {label}
        </p>
        <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`font-h3 text-h3 ${valueClass}`}>{value}</p>
      {hint && (
        <div className={`flex items-start gap-1 mt-0.5 ${hintTextClass}`}>
          {hintIcon && <Icon name={hintIcon} size={14} />}
          <span className="text-xs">{hint}</span>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const t = useT()
  const language = useAppSelector(selectLanguage)
  const [reversed, setReversed] = useState(false)
  const [taxRatePercent, setTaxRatePercent] = usePersistentState(
    TAX_RATE_STORAGE_KEY,
    DEFAULT_TAX_RATE_PERCENT,
  )
  const [invoices, setInvoices] = useState<
    {
      id: number
      itemName?: string | null
      company?: string | null
      price: number
      category?: string | null
      invoiceDate?: string | null
    }[]
  >([])

  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState(false)

  const [uploadSnapshot, setUploadSnapshot] = usePersistentState(
    UPLOAD_SNAPSHOT_STORAGE_KEY,
    { total: 0, count: 0, delta: 0 },
  )
  const [sinceLastUpload, setSinceLastUpload] = useState(uploadSnapshot.delta)
  const [invoicesLoaded, setInvoicesLoaded] = useState(false)
  const hasSnapshotted = useRef(false)

  useEffect(() => {
    apiGet<typeof invoices>('/api/invoices')
      .then((data) => setInvoices(data || []))
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoaded(true))
  }, [])

  useEffect(() => {
    if (!invoicesLoaded || hasSnapshotted.current) return
    hasSnapshotted.current = true
    const total = invoices.reduce((s, inv) => s + Number(inv.price || 0), 0)
    const count = invoices.length

    // Only move the baseline when the invoice count actually changed (a real
    // upload or deletion) — otherwise keep showing the last computed delta so
    // it survives navigating away and back.
    if (count === uploadSnapshot.count) {
      setSinceLastUpload(uploadSnapshot.delta)
      return
    }
    const delta = Math.max(0, total - uploadSnapshot.total)
    setSinceLastUpload(delta)
    setUploadSnapshot({ total, count, delta })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicesLoaded, invoices])

  useEffect(() => {
    let cancelled = false
    setSuggestionsLoading(true)
    setSuggestionsError(false)
    apiGet<SuggestionResponse[]>(`/api/suggestions?language=${language}`)
      .then((data) => {
        if (cancelled) return
        setSuggestions(data || [])
      })
      .catch(() => {
        if (cancelled) return
        setSuggestionsError(true)
        setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [language])

  const totalExpenses = invoices.reduce((s, inv) => s + Number(inv.price || 0), 0)
  const carryforward = totalExpenses // placeholder: same as recorded expenses
  const taxRate = taxRatePercent / 100
  const futureRefund = totalExpenses * taxRate

  // compute top categories
  const byCategory = invoices.reduce<Record<string, number>>((acc, inv) => {
    const cat = inv.category || 'Sonstige'
    acc[cat] = (acc[cat] || 0) + Number(inv.price || 0)
    return acc
  }, {})

  const sorted = Object.entries(byCategory)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)

  const EXPENSE_BARS: readonly ExpenseBar[] = sorted.slice(0, 4).map((row) => ({
    label: categoryLabel(row.label),
    amount: `€${row.amount.toFixed(2)}`,
    width: `${Math.min(100, (row.amount / (totalExpenses || 1)) * 100).toFixed(0)}%`,
    bar: 'bg-primary',
  }))

  const displayedBars = reversed ? [...EXPENSE_BARS].reverse() : EXPENSE_BARS

  const summaryCards: readonly SummaryCardProps[] = [
    {
      label: t('dashboard.cards.totalExpenses'),
      value: `€${totalExpenses.toFixed(2)}`,
      icon: 'payments',
      hint: `+€${sinceLastUpload.toFixed(2)} ${t('dashboard.cards.sinceLastUpload')}`,
      hintIcon: 'trending_up',
      hintColor: 'text-secondary',
    },
    {
      label: t('dashboard.cards.carryforward'),
      value: `€${carryforward.toFixed(2)}`,
      icon: 'account_balance',
      highlight: true,
    },
    {
      label: t('dashboard.cards.futureRefund'),
      value: `~€${futureRefund.toFixed(2)}`,
      icon: 'savings',
      hint: t('dashboard.cards.taxRateNote'),
      hintIcon: 'info',
    },
  ]

  return (
    <>
      <div className="mb-10">
        <h1 className="font-h1 text-h1 text-primary mb-2">{t('dashboard.title')}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className={CARD_BASE}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-h3 text-h3 text-primary">{t('dashboard.categories.title')}</h3>
              <button
                type="button"
                onClick={() => setReversed((r) => !r)}
                aria-pressed={reversed}
                aria-label={t('dashboard.categories.reverseOrder')}
                title={t('dashboard.categories.reverseOrder')}
                className="text-surface-tint hover:text-primary transition-colors"
              >
                <Icon
                  name="filter_list"
                  size={18}
                  className={`transition-transform duration-200 ${reversed ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            <div className="space-y-4">
              {(displayedBars.length ? displayedBars : EMPTY_BARS).map((row) => (
                <div key={row.label} className="flex items-center gap-4">
                  <div className="w-32 font-body-sm text-body-sm text-on-surface-variant truncate">
                    {row.label}
                  </div>
                  <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${row.bar}`} style={{ width: row.width }} />
                  </div>
                  <div className="w-16 text-right font-data-mono text-data-mono text-primary">
                    {row.amount}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={CARD_BASE}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-h3 text-h3 text-primary flex items-center gap-2">
                <Icon name="calculate" className="text-surface-tint" />
                {t('dashboard.savings.title')}
              </h3>
              <div
                className="flex items-center gap-0.5 rounded-lg border border-surface-container-highest bg-surface pl-2 pr-1 py-0.5"
                role="group"
                aria-label={t('dashboard.savings.futureTaxRate')}
              >
                <input
                  type="number"
                  min={MIN_TAX_RATE_PERCENT}
                  max={MAX_TAX_RATE_PERCENT}
                  value={taxRatePercent}
                  onChange={(e) => setTaxRatePercent(clampTaxRate(Number(e.target.value)))}
                  aria-label={t('dashboard.savings.futureTaxRate')}
                  className="w-9 bg-transparent text-right font-data-mono text-data-mono text-primary border-0 outline-none focus:outline-none focus:ring-0 p-0 m-0 appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="font-data-mono text-data-mono text-on-surface-variant">%</span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setTaxRatePercent((p) => clampTaxRate(p + 1))}
                    disabled={taxRatePercent >= MAX_TAX_RATE_PERCENT}
                    aria-label={`${t('dashboard.savings.futureTaxRate')} +`}
                    className="text-surface-tint hover:text-primary disabled:opacity-30 disabled:hover:text-surface-tint transition-colors leading-none"
                  >
                    <Icon name="keyboard_arrow_up" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRatePercent((p) => clampTaxRate(p - 1))}
                    disabled={taxRatePercent <= MIN_TAX_RATE_PERCENT}
                    aria-label={`${t('dashboard.savings.futureTaxRate')} -`}
                    className="text-surface-tint hover:text-primary disabled:opacity-30 disabled:hover:text-surface-tint transition-colors leading-none"
                  >
                    <Icon name="keyboard_arrow_down" size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-surface p-4 rounded-lg border border-surface-container-highest">
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                {t('dashboard.savings.intro')}
              </p>
              <div className="space-y-2 border-l-2 border-primary-fixed-dim pl-4">
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.recordedExpenses')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">€{totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.futureTaxRate')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">
                    x {taxRate.toFixed(2)} ({taxRatePercent}%)
                  </span>
                </div>
                <div className="w-full h-px bg-surface-container-highest my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md font-semibold text-primary">
                    {t('dashboard.savings.futureRefund')}
                  </span>
                  <span className="font-data-mono text-data-mono text-secondary font-semibold">
                    €{futureRefund.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={`relative overflow-hidden ${CARD_BASE}`}>
            <IntelligenceRail />
            <div className="flex items-center gap-2 mb-1">
              <Icon name="auto_awesome" className="text-[#9333ea]" />
              <h3 className="font-h3 text-h3 text-primary">{t('dashboard.ai.title')}</h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
              {t('dashboard.ai.subtitle')}
            </p>
            <div className="space-y-4">
              {suggestionsLoading ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('dashboard.ai.loading')}
                </p>
              ) : suggestionsError ? (
                <p className="font-body-sm text-body-sm text-error">
                  {t('dashboard.ai.error')}
                </p>
              ) : suggestions.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('dashboard.ai.empty')}
                </p>
              ) : (
                suggestions.map((s, i) => (
                  <div
                    key={`${s.createdAt}-${i}`}
                    className="bg-surface p-4 rounded-lg border border-surface-container-highest"
                  >
                    <div className="font-body-sm text-body-sm text-on-surface mb-2 space-y-2">
                      {renderSuggestion(s.suggestion)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-data-mono text-xs text-on-surface-variant">
                        {formatSuggestionDate(s.createdAt)}
                      </p>
                      <Link
                        to="/upload"
                        className="shrink-0 bg-white border border-outline-variant text-primary font-body-sm text-body-sm px-3 py-1.5 rounded hover:bg-surface-container transition-colors flex items-center gap-1"
                      >
                        <Icon name="upload" size={16} /> {t('dashboard.ai.uploadCta')}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
