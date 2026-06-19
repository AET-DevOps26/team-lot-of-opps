import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import EmailPasswordForm from '../../src/components/EmailPasswordForm'
import { auth } from '../../src/firebase'
import translations from '../../src/i18n/translations'
import { renderWithProviders } from '../test-utils'

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('../../src/firebase', () => ({
  auth: { name: 'mock-auth' },
}))

const t = translations.en.auth

describe('EmailPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sign-in mode by default', () => {
    renderWithProviders(<EmailPasswordForm />)

    expect(screen.getByPlaceholderText(t.emailLabel)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(t.passwordLabel)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(t.confirmPasswordLabel)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.signInWithEmail })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.forgotPassword })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.switchToSignUp })).toBeInTheDocument()
  })

  it('signs in with the entered credentials', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({} as never)
    renderWithProviders(<EmailPasswordForm />)

    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.type(screen.getByPlaceholderText(t.passwordLabel), 'secret123')
    await user.click(screen.getByRole('button', { name: t.signInWithEmail }))

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'jane@example.com', 'secret123')
  })

  it('shows a translated message for known Firebase error codes', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue({ code: 'auth/invalid-credential' })
    renderWithProviders(<EmailPasswordForm />)

    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.type(screen.getByPlaceholderText(t.passwordLabel), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: t.signInWithEmail }))

    expect(await screen.findByText(t.invalidCredentials)).toBeInTheDocument()
    // The form recovers so the user can retry.
    expect(screen.getByRole('button', { name: t.signInWithEmail })).toBeEnabled()
  })

  it('rejects sign-up when the passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EmailPasswordForm />)

    await user.click(screen.getByRole('button', { name: t.switchToSignUp }))
    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.type(screen.getByPlaceholderText(t.passwordLabel), 'secret123')
    await user.type(screen.getByPlaceholderText(t.confirmPasswordLabel), 'different')
    await user.click(screen.getByRole('button', { name: t.createAccount }))

    expect(await screen.findByText(t.passwordMismatch)).toBeInTheDocument()
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled()
  })

  it('creates an account when sign-up passwords match', async () => {
    const user = userEvent.setup()
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({} as never)
    renderWithProviders(<EmailPasswordForm />)

    await user.click(screen.getByRole('button', { name: t.switchToSignUp }))
    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.type(screen.getByPlaceholderText(t.passwordLabel), 'secret123')
    await user.type(screen.getByPlaceholderText(t.confirmPasswordLabel), 'secret123')
    await user.click(screen.getByRole('button', { name: t.createAccount }))

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'jane@example.com',
      'secret123',
    )
  })

  it('sends a password reset email and confirms it', async () => {
    const user = userEvent.setup()
    vi.mocked(sendPasswordResetEmail).mockResolvedValue()
    renderWithProviders(<EmailPasswordForm />)

    await user.click(screen.getByRole('button', { name: t.forgotPassword }))
    // The password field is hidden in reset mode.
    expect(screen.queryByPlaceholderText(t.passwordLabel)).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: t.sendResetEmail }))

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'jane@example.com')
    expect(await screen.findByText(t.resetEmailSent)).toBeInTheDocument()
  })

  it('clears the error when switching modes', async () => {
    const user = userEvent.setup()
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue({ code: 'auth/wrong-password' })
    renderWithProviders(<EmailPasswordForm />)

    await user.type(screen.getByPlaceholderText(t.emailLabel), 'jane@example.com')
    await user.type(screen.getByPlaceholderText(t.passwordLabel), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: t.signInWithEmail }))
    expect(await screen.findByText(t.invalidCredentials)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.switchToSignUp }))
    expect(screen.queryByText(t.invalidCredentials)).not.toBeInTheDocument()
  })
})
