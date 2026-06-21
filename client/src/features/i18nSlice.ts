import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { isLanguage, type Language } from '../i18n/translations'
import type { RootState } from '../store'

export const LANGUAGE_STORAGE_KEY = 'app.language'
const DEFAULT_LANGUAGE: Language = 'en'

interface I18nState {
  language: Language
}

function detectInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE

  const stored = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
  if (isLanguage(stored)) return stored

  const browser = window.navigator?.language?.slice(0, 2)
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

const initialState: I18nState = {
  language: detectInitialLanguage(),
}

const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload
    },
  },
})

export const { setLanguage } = i18nSlice.actions
export const selectLanguage = (state: RootState) => state.i18n.language
export default i18nSlice.reducer
