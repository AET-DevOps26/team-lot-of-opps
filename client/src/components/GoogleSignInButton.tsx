import { useState } from 'react'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase'
import { getAuthErrorMessage } from '../lib/authErrors'
import useT from '../i18n/useT'

interface Props {
  size?: 'sm' | 'lg'
  className?: string
}

export default function GoogleSignInButton({ size = 'sm', className = '' }: Props) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sizeClasses =
    size === 'lg' ? 'px-6 py-3 text-base gap-3' : 'px-4 py-2 text-sm gap-2'
  const iconSize = size === 'lg' ? 22 : 18

  async function handleSignIn() {
    setError(null)
    setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      // onAuthStateChanged in App.tsx dispatches signedIn automatically.
    } catch (err) {
      // Returns null when the user simply closed the popup themselves.
      setError(getAuthErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        aria-busy={busy}
        className={`w-full inline-flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium text-slate-700 shadow-sm ${sizeClasses}`}
      >
        {busy ? (
          <svg
            className="animate-spin text-slate-500"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg aria-hidden="true" width={iconSize} height={iconSize} viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
        )}
        <span className="ml-2">{busy ? t('auth.signingIn') : t('auth.signIn')}</span>
      </button>
      {error && (
        <p
          role="alert"
          className="absolute top-full left-0 right-0 mt-2 text-center text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  )
}
