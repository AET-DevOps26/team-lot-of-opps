import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { signInWithPopup } from 'firebase/auth'
import GoogleSignInButton from '../../src/components/GoogleSignInButton'
import translations from '../../src/i18n/translations'
import { renderWithProviders } from '../test-utils'

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}))

vi.mock('../../src/firebase', () => ({
  auth: { name: 'mock-auth' },
}))

const t = translations.en.auth

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the Google popup when clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithPopup).mockResolvedValue({} as never)
    renderWithProviders(<GoogleSignInButton />)

    await user.click(screen.getByRole('button', { name: t.signIn }))

    expect(signInWithPopup).toHaveBeenCalledTimes(1)
  })

  it('stays silent when the user closes the popup', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-closed-by-user' })
    renderWithProviders(<GoogleSignInButton />)

    await user.click(screen.getByRole('button', { name: t.signIn }))

    // No alert, and the button recovers so the user can retry.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.signIn })).toBeEnabled()
  })

  it('surfaces a friendly message when the popup is blocked', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-blocked' })
    renderWithProviders(<GoogleSignInButton />)

    await user.click(screen.getByRole('button', { name: t.signIn }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t.popupBlocked)
    expect(screen.getByRole('button', { name: t.signIn })).toBeEnabled()
  })

  it('never flips the global auth loading flag', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-closed-by-user' })
    const { store } = renderWithProviders(<GoogleSignInButton />, {
      preloadedState: { auth: { user: null, loading: false } },
    })

    await user.click(screen.getByRole('button', { name: t.signIn }))

    // Regression guard: sign-in actions must not drive the route-level loading state.
    expect(store.getState().auth.loading).toBe(false)
  })
})
