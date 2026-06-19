import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPopup from '../../src/components/ChatPopup'
import type { ChatMessage } from '../../src/hooks/useChat'
import translations from '../../src/i18n/translations'
import { renderWithProviders } from '../test-utils'

const sendMessage = vi.fn()
const stop = vi.fn()

let chatState: { messages: ChatMessage[]; isStreaming: boolean }

vi.mock('../../src/hooks/useChat', () => ({
  useChat: () => ({ ...chatState, sendMessage, stop, reset: vi.fn() }),
}))

const t = translations.en.chat

function assistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'a1',
    role: 'assistant',
    content: 'You spent € 120 on books.',
    sources: [],
    ...overrides,
  }
}

function userMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'u1',
    role: 'user',
    content: 'How much did I spend on books?',
    sources: [],
    ...overrides,
  }
}

describe('ChatPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatState = { messages: [], isStreaming: false }
  })

  it('renders nothing while closed', () => {
    renderWithProviders(<ChatPopup open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the empty state and focuses the composer when opened', () => {
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: t.title })).toBeInTheDocument()
    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(t.placeholder)).toHaveFocus()
  })

  it('sends the trimmed message on Enter and clears the input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText(t.placeholder)
    await user.type(input, '  What can I deduct?  ')
    await user.keyboard('{Enter}')

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('What can I deduct?')
    expect(input).toHaveValue('')
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: t.send })).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('closes on Escape and via the close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithProviders(<ChatPopup open onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: t.close }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders the conversation messages', () => {
    chatState.messages = [userMessage(), assistantMessage()]
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    expect(screen.getByText('How much did I spend on books?')).toBeInTheDocument()
    expect(screen.getByText('You spent € 120 on books.')).toBeInTheDocument()
  })

  it('shows an inline error on a failed assistant message', () => {
    chatState.messages = [userMessage(), assistantMessage({ content: '', error: 'Request failed (500)' })]
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    expect(screen.getByText('Request failed (500)')).toBeInTheDocument()
  })

  it('replaces the send button with a stop button while streaming', async () => {
    const user = userEvent.setup()
    chatState.isStreaming = true
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: t.send })).not.toBeInTheDocument()
    const stopButton = screen.getByRole('button', { name: t.stop })

    await user.click(stopButton)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('does not send while a response is streaming', async () => {
    const user = userEvent.setup()
    chatState.isStreaming = true
    renderWithProviders(<ChatPopup open onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(t.placeholder), 'another question')
    await user.keyboard('{Enter}')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('expands invoice sources and closes the popup when jumping to one', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    chatState.messages = [
      assistantMessage({
        sources: [
          {
            invoiceId: 7,
            itemName: 'MacBook Pro',
            company: 'Apple',
            price: 1999,
            category: 'Equipment',
            invoiceDate: '2026-01-15',
            documentId: 3,
          },
        ],
      }),
    ]
    renderWithProviders(<ChatPopup open onClose={onClose} />)

    // Collapsed by default: only the summary line is visible.
    expect(screen.getByText(`1 ${t.sources.one}`)).toBeInTheDocument()
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument()

    await user.click(screen.getByText(`1 ${t.sources.one}`))

    expect(screen.getByText('MacBook Pro')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('€ 1.999,00')).toBeInTheDocument()
    expect(screen.getByText('· 15.01.2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /MacBook Pro/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
