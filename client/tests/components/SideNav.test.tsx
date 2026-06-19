import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SideNav from '../../src/components/SideNav'
import translations from '../../src/i18n/translations'
import { authenticatedState, renderWithProviders } from '../test-utils'

const t = translations.en

describe('SideNav', () => {
  it('locks all navigation while signed out', () => {
    renderWithProviders(<SideNav />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(t.nav.signInRequired)).toBeInTheDocument()

    // Each entry is still listed, but disabled.
    for (const label of [t.nav.dashboard, t.nav.invoices, t.nav.upload]) {
      expect(screen.getByText(label).closest('[aria-disabled="true"]')).toBeInTheDocument()
    }
  })

  it('renders navigation links once signed in', () => {
    renderWithProviders(<SideNav />, { preloadedState: authenticatedState() })

    expect(screen.queryByText(t.nav.signInRequired)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(t.nav.dashboard) })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: new RegExp(t.nav.invoices) })).toHaveAttribute(
      'href',
      '/invoices',
    )
    expect(screen.getByRole('link', { name: new RegExp(t.nav.upload) })).toHaveAttribute(
      'href',
      '/upload',
    )
  })

  it('opens the settings modal and closes the mobile nav', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SideNav />, {
      preloadedState: {
        ...authenticatedState(),
        ui: { settingsOpen: false, mobileNavOpen: true },
      },
    })

    await user.click(screen.getByRole('button', { name: new RegExp(t.nav.settings) }))

    expect(store.getState().ui.settingsOpen).toBe(true)
    expect(store.getState().ui.mobileNavOpen).toBe(false)
  })

  it('closes the mobile nav when a navigation link is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SideNav />, {
      preloadedState: {
        ...authenticatedState(),
        ui: { settingsOpen: false, mobileNavOpen: true },
      },
    })

    await user.click(screen.getByRole('link', { name: new RegExp(t.nav.invoices) }))

    expect(store.getState().ui.mobileNavOpen).toBe(false)
  })
})
