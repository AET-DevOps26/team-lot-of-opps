import { useCallback } from 'react'
import { useAppSelector } from '../store/hooks'
import { selectLanguage } from '../features/i18nSlice'
import translations from './translations'

function resolve(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export type Translator = (key: string) => string

export default function useT(): Translator {
  const language = useAppSelector(selectLanguage)

  return useCallback<Translator>(
    (key) => {
      const value = resolve(translations[language], key) ?? resolve(translations.en, key)
      return typeof value === 'string' ? value : key
    },
    [language],
  )
}
