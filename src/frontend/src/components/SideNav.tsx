import { NavLink } from 'react-router-dom'
import { openSettings } from '../features/uiSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'
import Icon from './Icon'

interface NavItem {
  to: string
  icon: string
  labelKey: string
  end?: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard', end: true },
  { to: '/documents', icon: 'description', labelKey: 'nav.documents' },
  { to: '/upload', icon: 'upload_file', labelKey: 'nav.upload' },
]

const NAV_BASE =
  'flex items-center gap-3 p-3 rounded-lg transition-colors text-sm font-semibold tracking-wide'

function activeClass({ isActive }: { isActive: boolean }): string {
  return [
    NAV_BASE,
    isActive
      ? 'bg-white text-blue-700 shadow-sm'
      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700',
  ].join(' ')
}

export default function SideNav() {
  const t = useT()
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null)

  return (
    <aside className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-64 p-4 flex-col justify-between bg-slate-50 border-r border-slate-200 z-40">
      <div>
        <div className="mb-8 px-3">
          <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-wide">
            {t('sidebar.title')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('sidebar.subtitle')}</p>
        </div>
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              {isAuthenticated ? (
                <NavLink to={item.to} end={item.end} className={activeClass}>
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} filled={isActive} />
                      {t(item.labelKey)}
                    </>
                  )}
                </NavLink>
              ) : (
                <span
                  aria-disabled="true"
                  className={`${NAV_BASE} text-slate-400 cursor-not-allowed select-none`}
                >
                  <Icon name={item.icon} />
                  <span className="flex-1">{t(item.labelKey)}</span>
                  <Icon name="lock" />
                </span>
              )}
            </li>
          ))}
        </ul>
        {!isAuthenticated ? (
          <div
            role="note"
            className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600"
          >
            <span className="text-slate-400 mt-0.5">
              <Icon name="lock" />
            </span>
            <span className="leading-snug">{t('nav.signInRequired')}</span>
          </div>
        ) : null}
      </div>
      <ul className="space-y-2 border-t border-slate-200 pt-4">
        <li>
          <button
            onClick={() => dispatch(openSettings())}
            className="w-full flex items-center gap-3 text-slate-600 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors text-sm font-semibold tracking-wide"
          >
            <Icon name="settings" />
            {t('nav.settings')}
          </button>
        </li>
      </ul>
    </aside>
  )
}
