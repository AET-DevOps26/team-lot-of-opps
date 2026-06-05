import { useCallback, useRef, useState } from 'react'
import { useAppSelector } from '../store/hooks'
import { selectToken } from '../features/authSlice'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

/** A single RAG source surfaced by the agent (e.g. a retrieved document chunk). */
export interface ChatSource {
  /** The tool that produced this source, e.g. "search_documents". */
  tool: string
  /** Human-readable content of the retrieved snippet. */
  content: string
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
  type: 'token' | 'tool_start' | 'tool_end' | 'sources' | 'done' | 'error'
  content?: string
  tool?: string
  input?: string
  result?: string
  message?: string
  sources?: unknown
}

/** Tools whose results we surface to the user as RAG sources. */
function isSourceTool(tool: string | undefined): boolean {
  if (!tool) return false
  return /search|document|retriev/i.test(tool)
}

/** Split a search_documents tool result into individual source snippets. */
function parseToolSources(tool: string, result: string): ChatSource[] {
  const trimmed = result.trim()
  if (!trimmed || /^no matching documents/i.test(trimmed)) return []
  return trimmed
    .split(/\n-{2,}\n/)
    .map((part) => part.replace(/^Result\s*\d+:\s*/i, '').trim())
    .filter(Boolean)
    .map((content) => ({ tool, content }))
}

/** Normalize a structured `sources` event (defensive — backend may add this later). */
function normalizeSourcesEvent(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ChatSource | null => {
      if (typeof item === 'string') return { tool: 'source', content: item }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const content = obj.content ?? obj.text ?? obj.snippet ?? obj.page_content
        if (typeof content === 'string') {
          return { tool: String(obj.tool ?? obj.source ?? 'source'), content }
        }
      }
      return null
    })
    .filter((s): s is ChatSource => s !== null)
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useChat() {
  const token = useAppSelector(selectToken)
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
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`${BASE_URL}/api/agent/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ question: trimmed }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // Dedupe sources so a tool that streams partial results doesn't repeat.
        const seenSources = new Set<string>()
        const addSources = (incoming: ChatSource[]) => {
          const fresh = incoming.filter((s) => {
            if (seenSources.has(s.content)) return false
            seenSources.add(s.content)
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
              case 'tool_end':
                if (isSourceTool(evt.tool) && evt.result) {
                  addSources(parseToolSources(evt.tool!, evt.result))
                }
                break
              case 'sources':
                addSources(normalizeSourcesEvent(evt.sources))
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
    [token, isStreaming, updateAssistant],
  )

  return { messages, isStreaming, sendMessage, stop, reset }
}
