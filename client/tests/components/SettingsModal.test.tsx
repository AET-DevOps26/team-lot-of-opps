import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsModal from '../../src/components/SettingsModal'
import translations from '../../src/i18n/translations'
import { renderWithProviders } from '../test-utils'

const openUiState = { ui: { settingsOpen: true, mobileNavOpen: false } }

describe('SettingsModal', () => {
  it('renders nothing while settings are closed', () => {
    renderWithProviders(<SettingsModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the language options when open', () => {
    renderWithProviders(<SettingsModal />, { preloadedState: openUiState })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(translations.en.settings.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /English/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /German/ })).toBeInTheDocument()
  })

  it('switches the language and re-translates the UI immediately', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingsModal />, { preloadedState: openUiState })

    await user.click(screen.getByRole('button', { name: /German/ }))

    expect(store.getState().i18n.language).toBe('de')
    // The modal itself now renders in German.
    expect(screen.getByText(translations.de.settings.title)).toBeInTheDocument()
    expect(screen.queryByText(translations.en.settings.title)).not.toBeInTheDocument()
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingsModal />, { preloadedState: openUiState })

    await user.click(screen.getByRole('button', { name: translations.en.settings.close }))

    expect(store.getState().ui.settingsOpen).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when clicking the backdrop but not when clicking inside the dialog', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingsModal />, { preloadedState: openUiState })

    await user.click(screen.getByText(translations.en.settings.title))
    expect(store.getState().ui.settingsOpen).toBe(true)

    const backdrop = screen.getByRole('dialog').parentElement
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)
    expect(store.getState().ui.settingsOpen).toBe(false)
  })
})
