import { useCallback, useRef, useState } from 'react'
import { authHeaders, BASE_URL } from '../api/client'

/** An invoice the agent referenced while answering, surfaced to the user as a source. */
export interface ChatSource {
  invoiceId: number
  itemName: string | null
  company: string | null
  price: number | null
  category: string | null
  invoiceDate: string | null
  documentId: number | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: ChatSource[]
  /** True while the assistant message is still streaming in. */
  pending?: boolean
  error?: string
}

/** SSE event shapes emitted by the agent backend. */
interface AgentEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'references' | 'done' | 'error'
  content?: string
  tool?: string
  input?: string
  result?: string
  message?: string
  invoices?: unknown
}

/** Normalize the structured `references` event into invoice sources. */
function normalizeReferences(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ChatSource | null => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      if (typeof obj.invoice_id !== 'number') return null
      return {
        invoiceId: obj.invoice_id,
        itemName: typeof obj.item_name === 'string' ? obj.item_name : null,
        company: typeof obj.company === 'string' ? obj.company : null,
        price: typeof obj.price === 'number' ? obj.price : null,
        category: typeof obj.category === 'string' ? obj.category : null,
        invoiceDate: typeof obj.invoice_date === 'string' ? obj.invoice_date : null,
        documentId: typeof obj.document_id === 'number' ? obj.document_id : null,
      }
    })
    .filter((s): s is ChatSource => s !== null)
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const updateAssistant = useCallback(
    (id: string, updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))
    },
    [],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setMessages([])
  }, [stop])

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || isStreaming) return

      // Prior turns, sent so the backend agent can resolve confirm-gated tools
      // (e.g. "yes" after a proposed invoice edit) — each request is otherwise stateless.
      const history = messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg: ChatMessage = {
        id: randomId(),
        role: 'user',
        content: trimmed,
        sources: [],
      }
      const assistantId = randomId()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: [],
        pending: true,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const headers: Record<string, string> = {
          ...(await authHeaders()),
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        }

        const res = await fetch(`${BASE_URL}/api/v1/agent/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ question: trimmed, history }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // Dedupe sources by invoice so the same document isn't listed twice.
        const seenSources = new Set<number>()
        const addSources = (incoming: ChatSource[]) => {
          const fresh = incoming.filter((s) => {
            if (seenSources.has(s.invoiceId)) return false
            seenSources.add(s.invoiceId)
            return true
          })
          if (fresh.length === 0) return
          updateAssistant(assistantId, (m) => ({ ...m, sources: [...m.sources, ...fresh] }))
        }

        let done = false
        while (!done) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue

            let evt: AgentEvent
            try {
              evt = JSON.parse(raw) as AgentEvent
            } catch {
              continue
            }

            switch (evt.type) {
              case 'token':
                if (evt.content) {
                  updateAssistant(assistantId, (m) => ({
                    ...m,
                    content: m.content + evt.content,
                  }))
                }
                break
              case 'references':
                addSources(normalizeReferences(evt.invoices))
                break
              case 'error':
                updateAssistant(assistantId, (m) => ({
                  ...m,
                  error: evt.message ?? 'Something went wrong.',
                  pending: false,
                }))
                break
              case 'done':
                done = true
                break
            }
          }
        }

        updateAssistant(assistantId, (m) => ({ ...m, pending: false }))
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          updateAssistant(assistantId, (m) => ({ ...m, pending: false }))
        } else {
          updateAssistant(assistantId, (m) => ({
            ...m,
            pending: false,
            error: m.content ? undefined : (err as Error).message,
          }))
        }
      } finally {
        abortRef.current = null
        setIsStreaming(false)
      }
    },
    [isStreaming, updateAssistant, messages],
  )

  return { messages, isStreaming, sendMessage, stop, reset }
}
