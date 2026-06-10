import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import useT, { type Translator } from '../i18n/useT'
import Icon from '../components/Icon'
import { useAppSelector } from '../store/hooks'
import { selectToken } from '../features/authSlice'
import { apiGet, apiPostFormData } from '../api/client'

type QueueItemType = 'processing' | 'verified' | 'error'

interface ExtractedField {
  label: string
  value: string
  mono?: boolean
}

interface QueueItem {
  id: string
  type: QueueItemType
  name: string
  meta: string
  metaClass?: string
  status: string
  statusClass: string
  icon: string
  iconWrap: string
  borderClass?: string
  extracted?: readonly ExtractedField[]
}

interface UploadResponse {
  message: string
  filename: string
  documentId: number
  invoiceIds: number[]
}

interface InvoiceResponse {
  id: number
  itemName: string
  company: string
  price: number
  invoiceDate: string | null
}

const CARD_SHADOW = 'shadow-[0_4px_20px_rgba(26,43,60,0.05)]'

/**
 * Turn an upload failure into a readable message. The api client throws errors
 * shaped like `API POST /path failed: 500 <backend body>`, so we strip the
 * request prefix and surface whatever the backend actually returned. On crashes
 * (5xx / network errors with no body) we fall back to a generic message.
 */
function extractUploadError(err: unknown, t: Translator): string {
  const raw = err instanceof Error ? err.message : String(err)
  const match = raw.match(/failed:\s*(\d{3})\s*([\s\S]*)$/)
  if (match) {
    const [, status, body] = match
    const detail = body.trim()
    return detail ? `${status}: ${detail}` : `${t('upload.meta.uploadFailed')} (${status})`
  }
  return raw.trim() || t('upload.meta.uploadFailed')
}

function invoiceToQueueItem(inv: InvoiceResponse, t: Translator): QueueItem {
  return {
    id: `invoice-${inv.id}`,
    type: 'verified',
    name: inv.itemName || inv.company || String(inv.id),
    meta: inv.invoiceDate ?? '',
    status: t('upload.status.verified'),
    statusClass: 'bg-secondary-container text-on-secondary-container',
    icon: 'check_circle',
    iconWrap: 'bg-[#ECFDF5] text-secondary',
    extracted: [
      { label: t('upload.fields.vendor'), value: inv.company || '—' },
      { label: t('upload.fields.amount'), value: `€ ${Number(inv.price).toFixed(2)}`, mono: true },
    ],
  }
}

function QueueItemCard({ item, t }: { item: QueueItem; t: Translator }) {
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
            {t('upload.review')} <Icon name="arrow_forward" size={16} />
          </button>
        </div>
      )}
    </article>
  )
}

export default function Upload() {
  const t = useT()
  const token = useAppSelector(selectToken)
  const [queue, setQueue] = useState<QueueItem[]>([])

  useEffect(() => {
    apiGet<InvoiceResponse[]>('/api/invoices?limit=5', token)
      .then((invoices) => setQueue(invoices.map((inv) => invoiceToQueueItem(inv, t))))
      .catch(() => {})
  }, [token])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach((file) => {
        const tempId = `upload-${Date.now()}-${file.name}`
        const processingItem: QueueItem = {
          id: tempId,
          type: 'processing',
          name: file.name,
          meta: t('upload.meta.uploadedToday'),
          status: t('upload.status.extracting'),
          statusClass: 'bg-primary-fixed text-on-primary-fixed',
          icon: 'receipt_long',
          iconWrap: 'bg-surface-container text-outline',
        }
        setQueue((prev) => [processingItem, ...prev])

        const form = new FormData()
        form.append('file', file)

        apiPostFormData<UploadResponse>('/api/documents/upload', form, token)
          .then((res) => {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      id: `invoice-doc-${res.documentId}`,
                      type: 'verified',
                      name: res.filename,
                      meta: t('upload.meta.uploadedToday'),
                      status: t('upload.status.verified'),
                      statusClass: 'bg-secondary-container text-on-secondary-container',
                      icon: 'check_circle',
                      iconWrap: 'bg-[#ECFDF5] text-secondary',
                    }
                  : item,
              ),
            )
          })
          .catch((err: unknown) => {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      type: 'error',
                      meta: extractUploadError(err, t),
                      metaClass: 'text-error',
                      status: t('upload.status.actionNeeded'),
                      statusClass: 'bg-tertiary-container text-on-tertiary-container',
                      icon: 'error',
                      iconWrap: 'bg-error-container text-error',
                      borderClass: 'border-error-container',
                    }
                  : item,
              ),
            )
          })
      })
    },
    [token, t],
  )

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-base">
        <h1 className="font-h1 text-h1 text-on-surface">{t('upload.title')}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          {t('upload.subtitle')}
        </p>
      </header>

      <section className="bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant hover:border-primary focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-fixed cursor-pointer flex flex-col items-center justify-center py-20 px-6 text-center relative overflow-hidden group transition-colors">
        <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-[0.02] pointer-events-none" />
        <div className="w-16 h-16 mb-6 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
          <Icon name="cloud_upload" size={32} />
        </div>
        <h2 className="font-h2 text-h2 text-on-surface mb-2">{t('upload.dropzone.title')}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          {t('upload.dropzone.subtitle')}
        </p>
        <div className="flex items-center gap-4 text-outline font-label-caps text-label-caps uppercase">
          <span>PDF</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>JPG</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>PNG</span>
          <div className="w-1 h-1 rounded-full bg-outline-variant" />
          <span>{t('upload.dropzone.maxSize')}</span>
        </div>
        <input
          aria-label={t('upload.dropzone.title')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
          type="file"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </section>

      <section className="flex flex-col gap-md">
        <div className="flex items-center justify-between border-b border-surface-variant pb-2">
          <h3 className="font-h3 text-h3 text-on-surface">{t('upload.queue.title')}</h3>
          <Link
            to="/invoices"
            className="font-body-sm text-body-sm text-primary font-medium hover:underline"
          >
            {t('upload.queue.viewAll')}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-sm">
          {queue.map((item) => (
            <QueueItemCard key={item.id} item={item} t={t} />
          ))}
        </div>
      </section>
    </div>
  )
}
