import { useDispatch } from 'react-redux'
import { openSettings } from '../features/uiSlice'
import useT from '../i18n/useT'
import Icon from './Icon'

export default function TopBar() {
  const t = useT()
  const dispatch = useDispatch()
  return (
    <header className="flex justify-between items-center h-16 px-6 w-full fixed top-0 left-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold tracking-tight text-slate-900">{t('brand')}</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => dispatch(openSettings())}
          aria-label={t('nav.settings')}
          className="text-slate-500 hover:bg-slate-50 transition-colors p-2 rounded-full flex items-center justify-center"
        >
          <Icon name="settings" />
        </button>
        <button className="ml-2 font-medium text-blue-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors">
          {t('topbar.logIn')}
        </button>
      </div>
    </header>
  )
}
