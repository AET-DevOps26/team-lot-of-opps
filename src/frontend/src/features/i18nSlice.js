import { createSlice } from '@reduxjs/toolkit'
import { SUPPORTED_LANGUAGES } from '../i18n/translations'

const STORAGE_KEY = 'app.language'

function detectInitialLanguage() {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage?.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored
  const browser = window.navigator?.language?.slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(browser) ? browser : 'en'
}

const i18nSlice = createSlice({
  name: 'i18n',
  initialState: {
    language: detectInitialLanguage(),
  },
  reducers: {
    setLanguage: (state, action) => {
      if (!SUPPORTED_LANGUAGES.includes(action.payload)) return
      state.language = action.payload
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem(STORAGE_KEY, action.payload)
      }
    },
  },
})

export const { setLanguage } = i18nSlice.actions
export default i18nSlice.reducer
