import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../firebase'
import { getAuthErrorMessage } from '../lib/authErrors'
import useT from '../i18n/useT'

type Mode = 'signIn' | 'signUp' | 'resetPassword'

/** Firebase rejects shorter passwords with auth/weak-password; check it up front. */
const MIN_PASSWORD_LENGTH = 6

export default function EmailPasswordForm() {
  const t = useT()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResetSent(false)
    setPassword('')
    setConfirm('')
  }

  // Editing any field clears a stale error so the form doesn't look broken.
  function update(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      if (error) setError(null)
      setter(e.target.value)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'resetPassword') {
      setBusy(true)
      try {
        await sendPasswordResetEmail(auth, email)
        setResetSent(true)
      } catch (err: unknown) {
        setError(getAuthErrorMessage(err, t))
      } finally {
        setBusy(false)
      }
      return
    }

    if (mode === 'signUp') {
      // Validate locally for instant feedback instead of round-tripping to Firebase.
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(t('auth.weakPassword'))
        return
      }
      if (password !== confirm) {
        setError(t('auth.passwordMismatch'))
        return
      }
    }

    setBusy(true)
    try {
      if (mode === 'signUp') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // onAuthStateChanged in App.tsx dispatches signedIn automatically.
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60'

  const submitLabel =
    mode === 'resetPassword'
      ? t('auth.sendResetEmail')
      : mode === 'signUp'
        ? t('auth.createAccount')
        : t('auth.signInWithEmail')

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3" noValidate>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder={t('auth.emailLabel')}
        value={email}
        onChange={update(setEmail)}
        disabled={busy}
        className={inputClass}
      />

      {mode !== 'resetPassword' && (
        <div className="flex flex-col gap-1">
          <input
            type="password"
            required
            minLength={mode === 'signUp' ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            placeholder={t('auth.passwordLabel')}
            value={password}
            onChange={update(setPassword)}
            disabled={busy}
            className={inputClass}
          />
          {mode === 'signUp' && (
            <p className="text-xs text-slate-400 px-1">{t('auth.passwordHint')}</p>
          )}
        </div>
      )}

      {mode === 'signUp' && (
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder={t('auth.confirmPasswordLabel')}
          value={confirm}
          onChange={update(setConfirm)}
          disabled={busy}
          className={inputClass}
        />
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {resetSent && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
        >
          {t('auth.resetEmailSent')}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-6 py-3 text-base font-medium text-white shadow-sm"
      >
        {busy && (
          <svg
            className="animate-spin h-5 w-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {submitLabel}
      </button>

      <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
        {mode === 'signIn' && (
          <>
            <button
              type="button"
              onClick={() => switchMode('resetPassword')}
              className="hover:text-blue-600 transition-colors"
            >
              {t('auth.forgotPassword')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signUp')}
              className="hover:text-blue-600 transition-colors"
            >
              {t('auth.switchToSignUp')}
            </button>
          </>
        )}
        {mode === 'signUp' && (
          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className="hover:text-blue-600 transition-colors"
          >
            {t('auth.switchToSignIn')}
          </button>
        )}
        {mode === 'resetPassword' && (
          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className="hover:text-blue-600 transition-colors"
          >
            {t('auth.switchToSignIn')}
          </button>
        )}
      </div>
    </form>
  )
}
