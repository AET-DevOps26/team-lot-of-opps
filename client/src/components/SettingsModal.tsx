import { closeSettings, selectSettingsOpen } from '../features/uiSlice'
import { setLanguage, selectLanguage } from '../features/i18nSlice'
import { SUPPORTED_LANGUAGES } from '../i18n/translations'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import useT from '../i18n/useT'
import Icon from './Icon'

export default function SettingsModal() {
  const t = useT()
  const dispatch = useAppDispatch()
  const open = useAppSelector(selectSettingsOpen)
  const language = useAppSelector(selectLanguage)

  if (!open) return null

  const close = () => dispatch(closeSettings())

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_8px_30px_rgba(4,22,39,0.2)] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-h2 text-h2 text-primary">{t('settings.title')}</h2>
          <button
            aria-label={t('settings.close')}
            onClick={close}
            className="p-2 text-outline hover:text-on-surface hover:bg-surface rounded-full transition-colors"
          >
            <Icon name="close" />
          </button>
        </div>

        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-3">
            {t('settings.language')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SUPPORTED_LANGUAGES.map((code) => {
              const active = code === language
              return (
                <button
                  key={code}
                  onClick={() => dispatch(setLanguage(code))}
                  className={[
                    'flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline-variant text-on-surface hover:border-primary/40 hover:bg-surface',
                  ].join(' ')}
                >
                  <span className="font-body-md text-body-md font-medium">
                    {t(`settings.languages.${code}`)}
                  </span>
                  {active && <Icon name="check" size={18} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
