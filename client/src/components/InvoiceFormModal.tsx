import { useState, useEffect, useRef } from 'react'
import useT from '../i18n/useT'
import Icon from './Icon'
import { apiPost, apiPut } from '../api/client'
import { CATEGORY_LABELS, type InvoiceResponse } from '../lib/invoices'
import type { InvoiceRequest, InvoiceCategory } from '../api/types'

interface InvoiceFormModalProps {
  mode: 'create' | 'edit'
  initial?: InvoiceResponse
  onSave: (invoice: InvoiceResponse) => void
  onClose: () => void
}

export default function InvoiceFormModal({ mode, initial, onSave, onClose }: InvoiceFormModalProps) {
  const t = useT()
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [itemName, setItemName] = useState(initial?.itemName ?? '')
  const [company, setCompany] = useState(initial?.company ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [category, setCategory] = useState<InvoiceCategory | ''>(initial?.category ?? '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const body: InvoiceRequest = {
      itemName,
      company,
      price: parseFloat(price),
      category: category || null,
      invoiceDate: invoiceDate || null,
    }
    try {
      let saved: InvoiceResponse
      if (mode === 'create') {
        saved = await apiPost<InvoiceResponse, InvoiceRequest>('/api/invoices', body)
      } else {
        saved = await apiPut<InvoiceResponse, InvoiceRequest>(`/api/invoices/${initial!.id}`, body)
      }
      onSave(saved)
    } catch {
      setError(t('invoices.form.saveFailed') ?? 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const labelClass =
    'block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1'
  const fieldInputClass =
    'w-full px-4 py-2.5 bg-surface rounded-lg border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
          <h2 className="font-h3 text-h3 text-on-surface">
            {mode === 'create' ? t('invoices.addInvoice') : t('invoices.editInvoice')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface transition-colors text-on-surface-variant"
            aria-label={t('settings.close')}
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>{t('invoices.form.itemName')}</label>
            <input
              ref={firstInputRef}
              required
              className={fieldInputClass}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t('invoices.form.company')}</label>
            <input
              required
              className={fieldInputClass}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('invoices.form.price')}</label>
              <input
                required
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={fieldInputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{t('invoices.form.date')}</label>
              <input
                type="date"
                className={fieldInputClass}
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('invoices.form.category')}</label>
            <div className="relative">
              <select
                className={`${fieldInputClass} appearance-none pr-10 cursor-pointer`}
                value={category}
                onChange={(e) => setCategory(e.target.value as InvoiceCategory | '')}
              >
                <option value="">{t('invoices.form.noCategory')}</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-error font-body-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full font-label-caps text-label-caps uppercase text-on-surface-variant hover:bg-surface transition-colors"
            >
              {t('invoices.form.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-full font-label-caps text-label-caps uppercase bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? '…' : t('invoices.form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
