import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useT from '../i18n/useT'
import Icon from '../components/Icon'
import { api, unwrap } from '../api/client'
import type { SuggestionResponse } from '../api/types'
import { usePersistentState } from '../hooks/usePersistentState'
import { useCategoryLabel } from '../lib/invoices'
import { useAppSelector } from '../store/hooks'
import { selectLanguage } from '../features/i18nSlice'
import {
  jahresverlust,
  refundPrognose,
  TAX_2024,
  verlustvortrag,
  type StudyYearInput,
} from '../lib/taxCalculator'

const TAX_PLANNER_STORAGE_KEY = 'dashboard.taxPlanner'

type ManualYearInput = Omit<StudyYearInput, 'belegausgaben'>

interface TaxPlannerState {
  brutto: number
  years: Record<string, ManualYearInput>
  vorsorgeRate: number
  pauschbetrag: number
}

const EMPTY_YEAR: ManualYearInput = {
  pendlertage: 0,
  entfernungKm: 0,
  homeofficeTage: 0,
  bewerbungenSchriftlich: 0,
  bewerbungenOnline: 0,
  umzug: false,
  einnahmenWerkstudent: 0,
}

const DEFAULT_VORSORGE_RATE = 20
const DEFAULT_PAUSCHBETRAG = 1230

const DEFAULT_PLANNER: TaxPlannerState = {
  brutto: 45000,
  years: {},
  vorsorgeRate: DEFAULT_VORSORGE_RATE,
  pauschbetrag: DEFAULT_PAUSCHBETRAG,
}

const toNonNegative = (value: string) => Math.max(0, Number(value) || 0)

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

interface YearFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
}

function YearField({ label, value, onChange }: YearFieldProps) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(toNonNegative(e.target.value))}
        className="w-24 rounded border border-surface-container-highest bg-surface px-2 py-1 text-right font-data-mono text-data-mono text-primary"
      />
    </label>
  )
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg bg-surface px-3 py-2">
      <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant/70">
        {title}
      </p>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const t = useT()
  const categoryLabel = useCategoryLabel()
  const language = useAppSelector(selectLanguage)
  const [reversed, setReversed] = useState(false)
  const [planner, setPlanner] = usePersistentState<TaxPlannerState>(
    TAX_PLANNER_STORAGE_KEY,
    DEFAULT_PLANNER,
  )
  const [invoices, setInvoices] = useState<
    {
      id: number
      itemName?: string | null
      company?: string | null
      price: number
      category?: string | null
      invoiceDate?: string | null
      status?: string | null
      createdAt?: string | null
      documentId?: number | null
    }[]
  >([])

  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState(false)

  useEffect(() => {
    // The endpoint defaults to ACCEPTED only, so fetch both review states to get
    // every recorded expense; the status field then separates confirmed from pending.
    Promise.all([
      unwrap(api.GET('/api/v1/invoices', { params: { query: { status: 'ACCEPTED' } } })),
      unwrap(api.GET('/api/v1/invoices', { params: { query: { status: 'PENDING' } } })),
    ])
      .then(([accepted, pending]) => setInvoices([...(accepted || []), ...(pending || [])]))
      .catch(() => setInvoices([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setSuggestionsLoading(true)
    setSuggestionsError(false)
    unwrap(api.GET('/api/v1/suggestions', { params: { query: { language } } }))
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
  // The carryforward only counts expenses the user has reviewed and accepted —
  // pending invoices are unreviewed AI extractions and cannot be claimed yet.
  const confirmedExpenses = invoices
    .filter((inv) => inv.status === 'ACCEPTED')
    .reduce((s, inv) => s + Number(inv.price || 0), 0)

  const currentYear = new Date().getFullYear()
  const belegByYear = invoices.reduce<Record<string, number>>((acc, inv) => {
    const parsed = inv.invoiceDate ? new Date(inv.invoiceDate).getFullYear() : NaN
    const year = String(Number.isNaN(parsed) ? currentYear : parsed)
    acc[year] = (acc[year] || 0) + Number(inv.price || 0)
    return acc
  }, {})

  const studyYears = Object.keys(belegByYear).length
    ? Object.keys(belegByYear).sort()
    : [String(currentYear)]

  const yearInputs = studyYears.map((year) => ({
    year,
    input: {
      belegausgaben: belegByYear[year] || 0,
      ...(planner.years[year] ?? EMPTY_YEAR),
    } satisfies StudyYearInput,
  }))

  const pauschbetrag = planner.pauschbetrag ?? DEFAULT_PAUSCHBETRAG
  const vorsorgeRate = planner.vorsorgeRate ?? DEFAULT_VORSORGE_RATE
  const constants = { ...TAX_2024, arbeitnehmerPauschbetrag: pauschbetrag }

  const carryforward = verlustvortrag(
    yearInputs.map((y) => y.input),
    constants,
  )
  const prognose = refundPrognose(planner.brutto, carryforward, vorsorgeRate / 100, constants)
  const futureRefund = prognose.erstattung

  const setYearField = (year: string, patch: Partial<ManualYearInput>) =>
    setPlanner((p) => ({
      ...p,
      years: { ...p.years, [year]: { ...(p.years[year] ?? EMPTY_YEAR), ...patch } },
    }))

  // How much the most recent upload added. Invoices from one upload share a
  // documentId, so the newest upload is the batch of the most recently created
  // invoice; null when nothing has been uploaded yet (manual entries excluded).
  const uploadedInvoices = invoices.filter((inv) => inv.documentId != null && inv.createdAt != null)
  const newestUpload = uploadedInvoices.reduce<(typeof uploadedInvoices)[number] | null>(
    (newest, inv) => (newest == null || inv.createdAt! > newest.createdAt! ? inv : newest),
    null,
  )
  const lastUploadTotal =
    newestUpload == null
      ? null
      : uploadedInvoices
          .filter((inv) => inv.documentId === newestUpload.documentId)
          .reduce((s, inv) => s + Number(inv.price || 0), 0)

  // compute top categories
  const byCategory = invoices.reduce<Record<string, number>>((acc, inv) => {
    const cat = inv.category || 'Sonstige'
    acc[cat] = (acc[cat] || 0) + Number(inv.price || 0)
    return acc
  }, {})

  const sorted = Object.entries(byCategory)
    .map(([key, amount]) => ({ label: categoryLabel(key), amount }))
    .sort((a, b) => b.amount - a.amount)

  const EXPENSE_BARS: readonly ExpenseBar[] = sorted.slice(0, 4).map((row) => ({
    label: row.label,
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
      hint:
        lastUploadTotal == null
          ? undefined
          : `+€${lastUploadTotal.toFixed(2)} ${t('dashboard.cards.sinceLastUpload')}`,
      hintIcon: 'trending_up',
      hintColor: 'text-secondary',
    },
    {
      label: t('dashboard.cards.carryforward'),
      value: `€${confirmedExpenses.toFixed(2)}`,
      icon: 'account_balance',
      highlight: true,
      hint: t('dashboard.cards.carryforwardNote'),
      hintIcon: 'verified',
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
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-h3 text-h3 text-primary flex items-center gap-2">
                <Icon name="calculate" className="text-surface-tint" />
                {t('dashboard.savings.title')}
              </h3>
            </div>
            <div className="bg-surface p-4 rounded-lg border border-surface-container-highest">
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                {t('dashboard.savings.intro')}
              </p>

              <label className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-surface-container-highest bg-surface-container-lowest p-3">
                <span className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name="work" size={16} />
                  </span>
                  {t('dashboard.savings.grossSalary')}
                </span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={planner.brutto}
                    onChange={(e) => setPlanner((p) => ({ ...p, brutto: toNonNegative(e.target.value) }))}
                    aria-label={t('dashboard.savings.grossSalary')}
                    className="w-28 rounded border border-surface-container-highest bg-surface px-2 py-1 text-right font-data-mono text-data-mono text-primary"
                  />
                  <span className="font-data-mono text-data-mono text-on-surface-variant">€</span>
                </span>
              </label>

              <div className="space-y-2 mb-4">
                {yearInputs.map(({ year, input }) => (
                  <details
                    key={year}
                    className="rounded-lg border border-surface-container-highest bg-surface-container-lowest px-4 py-2"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2">
                      <span className="font-body-md text-body-md font-semibold text-primary">
                        {t('dashboard.savings.yearHeading')} {year}
                      </span>
                      <span className="font-data-mono text-data-mono text-primary">
                        {t('dashboard.savings.yearLoss')}: €{jahresverlust(input, constants).toFixed(2)}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {t('dashboard.savings.invoiceExpenses')}
                        </span>
                        <span className="font-data-mono text-data-mono text-primary">
                          €{input.belegausgaben.toFixed(2)}
                        </span>
                      </div>
                      <FieldGroup title={t('dashboard.savings.groupCommute')}>
                        <YearField
                          label={t('dashboard.savings.pendlertage')}
                          value={input.pendlertage}
                          onChange={(v) => setYearField(year, { pendlertage: v })}
                        />
                        <YearField
                          label={t('dashboard.savings.entfernungKm')}
                          value={input.entfernungKm}
                          onChange={(v) => setYearField(year, { entfernungKm: v })}
                        />
                      </FieldGroup>
                      <FieldGroup title={t('dashboard.savings.groupHomeoffice')}>
                        <YearField
                          label={t('dashboard.savings.homeofficeTage')}
                          value={input.homeofficeTage}
                          onChange={(v) => setYearField(year, { homeofficeTage: v })}
                        />
                      </FieldGroup>
                      <FieldGroup title={t('dashboard.savings.groupApplications')}>
                        <YearField
                          label={t('dashboard.savings.bewerbungenSchriftlich')}
                          value={input.bewerbungenSchriftlich}
                          onChange={(v) => setYearField(year, { bewerbungenSchriftlich: v })}
                        />
                        <YearField
                          label={t('dashboard.savings.bewerbungenOnline')}
                          value={input.bewerbungenOnline}
                          onChange={(v) => setYearField(year, { bewerbungenOnline: v })}
                        />
                      </FieldGroup>
                      <FieldGroup title={t('dashboard.savings.groupIncome')}>
                        <YearField
                          label={t('dashboard.savings.werkstudentIncome')}
                          value={input.einnahmenWerkstudent}
                          onChange={(v) => setYearField(year, { einnahmenWerkstudent: v })}
                        />
                        <label className="flex items-center justify-between gap-2">
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {t('dashboard.savings.umzug')}
                          </span>
                          <input
                            type="checkbox"
                            checked={input.umzug}
                            onChange={(e) => setYearField(year, { umzug: e.target.checked })}
                            className="h-4 w-4 accent-primary"
                          />
                        </label>
                      </FieldGroup>
                    </div>
                  </details>
                ))}
              </div>
              <div className="space-y-2 border-l-2 border-primary-fixed-dim pl-4">
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.carryforwardTotal')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">€{carryforward.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.taxRegular')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">
                    €{prognose.estRegulaer.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.taxWithCarryforward')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">
                    €{prognose.estNeu.toFixed(2)}
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

              <details className="mt-4 rounded-lg border border-surface-container-highest bg-surface-container-lowest px-4 py-2">
                <summary className="flex cursor-pointer items-center gap-2 font-body-sm text-body-sm font-semibold text-on-surface-variant">
                  <Icon name="tune" size={16} className="text-surface-tint" />
                  {t('dashboard.savings.advanced')}
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="font-body-sm text-body-sm text-on-surface-variant/80">
                    {t('dashboard.savings.advancedNote')}
                  </p>
                  <YearField
                    label={t('dashboard.savings.vorsorgeRate')}
                    value={vorsorgeRate}
                    onChange={(v) => setPlanner((p) => ({ ...p, vorsorgeRate: v }))}
                  />
                  <YearField
                    label={t('dashboard.savings.pauschbetrag')}
                    value={pauschbetrag}
                    onChange={(v) => setPlanner((p) => ({ ...p, pauschbetrag: v }))}
                  />
                </div>
              </details>
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
                <div className="space-y-4">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.ai.empty')}
                  </p>
                  <Link
                    to="/upload"
                    className="inline-flex items-center gap-1 bg-white border border-outline-variant text-primary font-body-sm text-body-sm px-3 py-1.5 rounded hover:bg-surface-container transition-colors"
                  >
                    <Icon name="upload" size={16} /> {t('dashboard.ai.uploadCta')}
                  </Link>
                </div>
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
