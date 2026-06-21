import { Link } from 'react-router-dom'
import { openSettings, toggleMobileNav, selectMobileNavOpen } from '../features/uiSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'
import AuthMenu from './AuthMenu'
import Icon from './Icon'

export default function TopBar() {
  const t = useT()
  const dispatch = useAppDispatch()
  const mobileNavOpen = useAppSelector(selectMobileNavOpen)

  return (
    <header className="flex justify-between items-center h-16 px-6 w-full fixed top-0 left-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch(toggleMobileNav())}
          aria-label={t('nav.menu')}
          aria-expanded={mobileNavOpen}
          className="md:hidden text-slate-600 hover:bg-slate-50 transition-colors p-2 rounded-full flex items-center justify-center"
        >
          <Icon name={mobileNavOpen ? 'close' : 'menu'} />
        </button>
        <Link
          to="/"
          className="text-xl font-bold tracking-tight text-slate-900 hover:text-blue-700 transition-colors"
        >
          {t('brand')}
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => dispatch(openSettings())}
          aria-label={t('nav.settings')}
          className="text-slate-500 hover:bg-slate-50 transition-colors p-2 rounded-full flex items-center justify-center"
        >
          <Icon name="settings" />
        </button>
        <AuthMenu />
      </div>
    </header>
  )
}
