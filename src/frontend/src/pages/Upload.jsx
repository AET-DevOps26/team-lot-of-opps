import Icon from '../components/Icon'

const QUEUE_ITEMS = [
  {
    type: 'processing',
    name: 'Q3_Office_Supplies_Invoice.pdf',
    meta: 'Uploaded Today, 10:42 AM',
    status: 'AI Extracting',
    statusClass: 'bg-primary-fixed text-on-primary-fixed',
    icon: 'receipt_long',
    iconWrap: 'bg-surface-container text-outline',
  },
  {
    type: 'verified',
    name: 'AWS_Server_Hosting_Aug2023.pdf',
    meta: 'Uploaded Yesterday',
    status: 'Verified',
    statusClass: 'bg-secondary-container text-on-secondary-container',
    icon: 'check_circle',
    iconWrap: 'bg-[#ECFDF5] text-secondary',
    extracted: [
      { label: 'Vendor', value: 'Amazon Web Services' },
      { label: 'Amount', value: '€ 1,245.00', mono: true },
    ],
  },
  {
    type: 'error',
    name: 'Unknown_Receipt_Scan_001.jpg',
    meta: 'Missing vendor information',
    metaClass: 'text-error',
    status: 'Action Needed',
    statusClass: 'bg-tertiary-container text-on-tertiary-container',
    icon: 'error',
    iconWrap: 'bg-error-container text-error',
    borderClass: 'border-error-container',
  },
]

const CARD_SHADOW = 'shadow-[0_4px_20px_rgba(26,43,60,0.05)]'

function QueueItem({ item }) {
  return (
    <article
      className={`bg-surface-container-lowest rounded-lg border ${CARD_SHADOW} overflow-hidden flex flex-col sm:flex-row items-start sm:items-center p-sm gap-md relative ${
        item.borderClass || 'border-surface-variant'
      }`}
    >
      {item.type === 'processing' && (
        <div className="absolute top-0 left-0 w-full h-1 bg-[linear-gradient(90deg,#8b5cf6,#3b82f6)]" />
      )}
      <div className={`p-3 rounded-md ${item.iconWrap}`}>
        <Icon name={item.icon} />
      </div>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body-md text-body-md font-medium text-on-surface truncate">
            {item.name}
          </span>
          <span
            className={`font-label-caps text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${item.statusClass}`}
          >
            {item.status}
          </span>
        </div>
        <p className={`font-body-sm text-body-sm ${item.metaClass || 'text-on-surface-variant'}`}>
          {item.meta}
        </p>
      </div>
      {item.type === 'processing' && (
        <div className="hidden md:flex items-center gap-xl pr-md">
          <div className="flex flex-col gap-1 w-24">
            <div className="h-3 bg-surface-container rounded w-full" />
            <div className="h-4 bg-surface-variant rounded w-3/4" />
          </div>
          <div className="flex flex-col gap-1 w-24">
            <div className="h-3 bg-surface-container rounded w-full" />
            <div className="h-4 bg-surface-variant rounded w-1/2" />
          </div>
        </div>
      )}
      {item.extracted && (
        <div className="hidden md:flex items-center gap-xl pr-md text-right">
          {item.extracted.map((field) => (
            <div key={field.label} className="flex flex-col">
              <span className="font-label-caps text-label-caps text-outline uppercase">
                {field.label}
              </span>
              <span
                className={
                  field.mono
                    ? 'font-data-mono text-data-mono text-on-surface'
                    : 'font-body-md text-body-md text-on-surface font-medium'
                }
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}
      {item.type === 'error' && (
        <div className="hidden md:flex items-center pr-md">
          <button className="font-body-sm text-body-sm text-primary font-medium hover:underline flex items-center gap-1">
            Review Document <Icon name="arrow_forward" size={16} />
          </button>
        </div>
      )}
    </article>
  )
}

export default function Upload() {
  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-base">
        <h1 className="font-h1 text-h1 text-on-surface">Intelligent Upload</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Securely deposit your financial documents. Our AI will automatically extract key data,
          classify expenses, and identify potential tax-loss carryforwards.
        </p>
      </header>

      <section className="bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant hover:border-primary focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-fixed cursor-pointer flex flex-col items-center justify-center py-20 px-6 text-center relative overflow-hidden group transition-colors">
        <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-[0.02] pointer-events-none" />
        <div className="w-16 h-16 mb-6 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
          <Icon name="cloud_upload" size={32} />
        </div>
        <h2 className="font-h2 text-h2 text-on-surface mb-2">Drag &amp; drop your invoices here</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          or click to browse from your device
        </p>
        <div className="flex items-center gap-4 text-outline font-label-caps text-label-caps uppercase">
          <span>PDF</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>JPG</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>PNG</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>Max 25MB</span>
        </div>
        <input
          aria-label="File upload input"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
          type="file"
        />
      </section>

      <section className="flex flex-col gap-md">
        <div className="flex items-center justify-between border-b border-surface-variant pb-2">
          <h3 className="font-h3 text-h3 text-on-surface">Processing Queue</h3>
          <button className="font-body-sm text-body-sm text-primary font-medium hover:underline">
            View All Documents
          </button>
        </div>
        <div className="grid grid-cols-1 gap-sm">
          {QUEUE_ITEMS.map((item) => (
            <QueueItem key={item.name} item={item} />
          ))}
        </div>
      </section>
    </div>
  )
}
