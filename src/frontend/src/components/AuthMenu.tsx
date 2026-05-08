import { useEffect, useRef, useState } from 'react'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { signedIn, signedOut } from '../features/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'

export default function AuthMenu() {
  const t = useT()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const language = useAppSelector((state) => state.i18n.language)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

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

  const handleSignOut = () => {
    googleLogout()
    dispatch(signedOut())
    setMenuOpen(false)
  }

  if (!user) {
    return (
      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) dispatch(signedIn(response.credential))
        }}
        onError={() => {
          // Failure surfaces in the GIS UI; nothing else to do here.
        }}
        locale={language}
        theme="outline"
        size="medium"
        shape="pill"
        useOneTap
      />
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
