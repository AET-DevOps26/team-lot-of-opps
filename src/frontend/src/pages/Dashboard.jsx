import useT from '../i18n/useT'
import Icon from '../components/Icon'

const EXPENSE_BARS = [
  { label: 'Fachliteratur', amount: '€850', width: '65%', bar: 'bg-primary' },
  { label: 'Fahrtkosten', amount: '€420', width: '45%', bar: 'bg-surface-tint' },
  { label: 'Arbeitsmittel', amount: '€310', width: '30%', bar: 'bg-primary-fixed-dim' },
  { label: 'Reisekosten', amount: '€1200', width: '80%', bar: 'bg-surface-container-highest' },
]

const CARD_SHADOW = 'shadow-[0px_4px_20px_rgba(26,43,60,0.05)]'
const CARD_BASE = `bg-surface-container-lowest border border-outline-variant rounded-xl p-6 ${CARD_SHADOW}`

function IntelligenceRail() {
  return <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#9333ea] to-[#2563eb]" />
}

function SummaryCard({ label, value, hint, hintIcon, hintColor, highlight }) {
  return (
    <div
      className={
        highlight
          ? `relative overflow-hidden bg-[#ECFDF5] border border-secondary-fixed-dim rounded-xl p-6 ${CARD_SHADOW}`
          : CARD_BASE
      }
    >
      {highlight && <IntelligenceRail />}
      <p
        className={`font-label-caps text-label-caps mb-2 uppercase tracking-widest ${
          highlight ? 'text-on-secondary-container' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </p>
      <p className={`font-h2 text-h2 mb-1 ${highlight ? 'text-secondary' : 'text-primary'}`}>{value}</p>
      {hint && (
        <div
          className={`flex items-center gap-1 ${
            highlight ? 'text-on-secondary-fixed-variant' : hintColor || 'text-on-surface-variant'
          }`}
        >
          {hintIcon && <Icon name={hintIcon} size={16} />}
          <span className="font-body-sm text-body-sm">{hint}</span>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const t = useT()

  const summaryCards = [
    {
      label: t('dashboard.cards.totalExpenses'),
      value: '€4,250.00',
      hint: t('dashboard.cards.sinceLastUpload'),
      hintIcon: 'trending_up',
      hintColor: 'text-secondary',
    },
    {
      label: t('dashboard.cards.carryforward'),
      value: '€3,800.00',
      highlight: true,
    },
    {
      label: t('dashboard.cards.futureRefund'),
      value: '~€1,140.00',
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
              <button className="font-body-sm text-body-sm text-surface-tint flex items-center gap-1 hover:text-primary transition-colors">
                {t('dashboard.categories.filter')} <Icon name="filter_list" size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {EXPENSE_BARS.map((row) => (
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
            <h3 className="font-h3 text-h3 text-primary mb-4 flex items-center gap-2">
              <Icon name="calculate" className="text-surface-tint" />
              {t('dashboard.savings.title')}
            </h3>
            <div className="bg-surface p-4 rounded-lg border border-surface-container-highest">
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                {t('dashboard.savings.intro')}
              </p>
              <div className="space-y-2 border-l-2 border-primary-fixed-dim pl-4">
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.recordedExpenses')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">€3,800</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('dashboard.savings.futureTaxRate')}
                  </span>
                  <span className="font-data-mono text-data-mono text-primary">x 0.30</span>
                </div>
                <div className="w-full h-px bg-surface-container-highest my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md font-semibold text-primary">
                    {t('dashboard.savings.futureRefund')}
                  </span>
                  <span className="font-data-mono text-data-mono text-secondary font-semibold">
                    €1,140
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={`relative overflow-hidden ${CARD_BASE}`}>
            <IntelligenceRail />
            <div className="flex items-center gap-2 mb-4">
              <Icon name="auto_awesome" className="text-[#9333ea]" />
              <h3 className="font-h3 text-h3 text-primary">{t('dashboard.ai.title')}</h3>
            </div>
            <div className="space-y-4">
              <div className="bg-error-container/30 border border-error-container p-4 rounded-lg">
                <p className="font-body-sm text-body-sm text-on-surface mb-3">
                  {t('dashboard.ai.suggestion1')}
                </p>
                <button className="bg-white border border-outline-variant text-primary font-body-sm text-body-sm px-3 py-1.5 rounded hover:bg-surface-container transition-colors flex items-center gap-1 w-full justify-center">
                  <Icon name="upload" size={16} /> {t('dashboard.ai.uploadFlight')}
                </button>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-surface-container-highest">
                <p className="font-body-sm text-body-sm text-on-surface mb-3">
                  {t('dashboard.ai.suggestion2')}
                </p>
                <button className="text-surface-tint font-body-sm text-body-sm hover:text-primary transition-colors flex items-center gap-1">
                  {t('dashboard.ai.addPauschale')} <Icon name="arrow_forward" size={16} />
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
