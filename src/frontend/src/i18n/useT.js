import { useSelector } from 'react-redux'
import translations from './translations'

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj)
}

export default function useT() {
  const language = useSelector((state) => state.i18n.language)
  const dict = translations[language] || translations.en

  return function t(key) {
    const value = resolve(dict, key)
    if (value == null) {
      const fallback = resolve(translations.en, key)
      return fallback ?? key
    }
    return value
  }
}
