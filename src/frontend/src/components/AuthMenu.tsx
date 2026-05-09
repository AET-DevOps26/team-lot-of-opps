import { useEffect, useRef, useState } from 'react'
import { googleLogout, useGoogleLogin } from '@react-oauth/google'
import { signedIn, signedOut, type AuthUser } from '../features/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

interface GoogleUserInfo {
  sub: string
  email: string
  name?: string
  picture?: string
}

async function fetchUserInfo(accessToken: string): Promise<AuthUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`userinfo request failed: ${res.status}`)
  const data = (await res.json()) as GoogleUserInfo
  if (!data.sub || !data.email) throw new Error('userinfo response missing required fields')
  return {
    sub: data.sub,
    email: data.email,
    name: data.name ?? data.email,
    picture: data.picture,
  }
}

export default function AuthMenu() {
  const t = useT()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: async (tokenResponse) => {
      try {
        const profile = await fetchUserInfo(tokenResponse.access_token)
        dispatch(signedIn(profile))
      } catch (err) {
        console.error('Failed to load Google user profile', err)
      } finally {
        setBusy(false)
      }
    },
    onError: () => setBusy(false),
    onNonOAuthError: () => setBusy(false),
  })

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleSignIn = () => {
    setBusy(true)
    login()
  }

  const handleSignOut = () => {
    googleLogout()
    dispatch(signedOut())
    setMenuOpen(false)
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-4 py-2 text-sm font-medium text-slate-700"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
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
        {t('auth.signIn')}
      </button>
    )
  }

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t('auth.accountMenu')}
        className="flex items-center gap-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors p-1 pr-3"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
            {initials || '?'}
          </span>
        )}
        <span className="text-sm font-medium text-slate-700 max-w-[10rem] truncate">
          {user.name}
        </span>
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-2"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="mt-1 w-full text-left px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('auth.signOut')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
