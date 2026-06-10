import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../firebase'
import { signingIn } from '../features/authSlice'
import { useAppDispatch } from '../store/hooks'
import useT from '../i18n/useT'

type Mode = 'signIn' | 'signUp' | 'resetPassword'

function getErrorKey(code: string): string | null {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'auth.emailInUse'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'auth.invalidCredentials'
    case 'auth/weak-password':
      return 'auth.weakPassword'
    default:
      return null
  }
}

export default function EmailPasswordForm() {
  const t = useT()
  const dispatch = useAppDispatch()
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'resetPassword') {
      setBusy(true)
      try {
        await sendPasswordResetEmail(auth, email)
        setResetSent(true)
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? ''
        const key = getErrorKey(code)
        setError(key ? t(key as Parameters<typeof t>[0]) : (err as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }

    if (mode === 'signUp' && password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }

    dispatch(signingIn())
    setBusy(true)
    try {
      if (mode === 'signUp') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // onAuthStateChanged in App.tsx dispatches signedIn automatically
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      const key = getErrorKey(code)
      setError(key ? t(key as Parameters<typeof t>[0]) : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60'

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder={t('auth.emailLabel')}
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={busy}
        className={inputClass}
      />

      {mode !== 'resetPassword' && (
        <input
          type="password"
          required
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          placeholder={t('auth.passwordLabel')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={busy}
          className={inputClass}
        />
      )}

      {mode === 'signUp' && (
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder={t('auth.confirmPasswordLabel')}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          disabled={busy}
          className={inputClass}
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {resetSent && <p className="text-xs text-green-700">{t('auth.resetEmailSent')}</p>}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="w-full rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-6 py-3 text-base font-medium text-white shadow-sm"
      >
        {mode === 'resetPassword'
          ? t('auth.sendResetEmail')
          : mode === 'signUp'
            ? t('auth.createAccount')
            : t('auth.signInWithEmail')}
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
