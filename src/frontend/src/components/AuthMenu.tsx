import { useEffect, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { selectUser } from '../features/authSlice'
import { useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'
import GoogleSignInButton from './GoogleSignInButton'

export default function AuthMenu() {
  const t = useT()
  const user = useAppSelector(selectUser)
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

  const handleSignOut = async () => {
    await signOut(auth)
    // onAuthStateChanged in App.tsx dispatches signedOut automatically
    setMenuOpen(false)
  }

  if (!user) return <GoogleSignInButton />

  const initials = user.displayName
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
        {user.photoURL ? (
          <img
            src={user.photoURL}
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
          {user.displayName}
        </span>
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-2"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
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
