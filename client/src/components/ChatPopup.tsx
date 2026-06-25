import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChat, type ChatMessage } from '../hooks/useChat'
import useT, { type Translator } from '../i18n/useT'
import Icon from './Icon'
import { categoryLabel } from '../lib/invoices'

interface ChatPopupProps {
  open: boolean
  onClose: () => void
}

export default function ChatPopup({ open, onClose }: ChatPopupProps) {
  const t = useT()
  const { messages, isStreaming, sendMessage, stop } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the composer with its content, starting from a single row.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  // Focus the composer when the popup opens; close on Escape.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = () => {
    const value = input.trim()
    if (!value || isStreaming) return
    void sendMessage(value)
    setInput('')
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('chat.title')}
      className="fixed bottom-28 right-8 z-50 flex h-[min(600px,calc(100vh-9rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(4,22,39,0.25)]"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-outline-variant bg-primary px-4 py-3 text-on-primary">
        <div className="flex items-center gap-2">
          <Icon name="smart_toy" filled size={22} />
          <h2 className="font-h3 text-h3 text-on-primary">{t('chat.title')}</h2>
        </div>
        <button
          aria-label={t('chat.close')}
          onClick={onClose}
          className="rounded-full p-1.5 text-on-primary/80 transition-colors hover:bg-white/10 hover:text-on-primary"
        >
          <Icon name="close" size={20} />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} t={t} onClose={onClose} />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-outline-variant bg-surface-container-lowest p-3">
        <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 focus-within:border-primary">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            placeholder={t('chat.placeholder')}
            className="max-h-40 flex-1 resize-none border-0 bg-transparent p-0 font-body-md text-body-md text-on-surface outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-on-surface-variant/60"
          />
          {isStreaming ? (
            <button
              aria-label={t('chat.stop')}
              onClick={stop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              <Icon name="stop" filled size={20} />
            </button>
          ) : (
            <button
              aria-label={t('chat.send')}
              onClick={submit}
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40"
            >
              <Icon name="send" filled size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ t }: { t: Translator }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name="smart_toy" filled size={26} />
      </div>
      <p className="font-body-md text-body-md text-on-surface">{t('chat.emptyTitle')}</p>
      <p className="max-w-[16rem] font-body-sm text-body-sm text-on-surface-variant">
        {t('chat.emptyBody')}
      </p>
    </div>
  )
}

function MessageBubble({
  message,
  t,
  onClose,
}: {
  message: ChatMessage
  t: Translator
  onClose: () => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 font-body-md text-body-md text-on-primary">
          {message.content}
        </div>
      </div>
    )
  }

  const showTyping = message.pending && !message.content && !message.error

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-surface-container px-3.5 py-2 font-body-md text-body-md text-on-surface">
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        )}
        {message.error && (
          <p className="mt-1 font-body-sm text-body-sm text-red-600">{message.error}</p>
        )}
      </div>
      {message.sources.length > 0 && <Sources sources={message.sources} t={t} onClose={onClose} />}
    </div>
  )
}

function fmtEur(n: number): string {
  return `€ ${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function Sources({
  sources,
  t,
  onClose,
}: {
  sources: ChatMessage['sources']
  t: Translator
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const label = sources.length === 1 ? t('chat.sources.one') : t('chat.sources.other')

  const jumpToInvoice = (invoiceId: number) => {
    navigate(`/invoices?invoice=${invoiceId}`)
    onClose()
  }

  return (
    <div className="w-full max-w-[85%] rounded-lg border border-outline-variant bg-surface px-3 py-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          <Icon name="article" size={15} />
          {sources.length} {label}
        </span>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-variant" />
      </button>
      {expanded && (
        <ul className="mt-2 space-y-2">
          {sources.map((source) => {
            const date = fmtDate(source.invoiceDate)
            const title = source.itemName ?? source.company ?? `Invoice #${source.invoiceId}`
            return (
              <li key={source.invoiceId}>
                <button
                  type="button"
                  onClick={() => jumpToInvoice(source.invoiceId)}
                  title={t('chat.sources.jump')}
                  className="block w-full rounded border-l-2 border-secondary bg-surface-container-lowest px-2.5 py-1.5 text-left transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words font-body-sm text-body-sm font-medium text-on-surface">
                      {title}
                    </p>
                    {source.price !== null && (
                      <p className="shrink-0 font-body-sm text-body-sm text-on-surface">
                        {fmtEur(source.price)}
                      </p>
                    )}
                  </div>
                  {(source.company && source.itemName) || date || source.category ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-body-sm text-body-sm text-on-surface-variant">
                      {source.company && source.itemName && <span>{source.company}</span>}
                      {date && <span>· {date}</span>}
                      {source.category && (
                        <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-caps text-label-caps uppercase tracking-wide">
                          {categoryLabel(source.category)}
                        </span>
                      )}
                    </p>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
