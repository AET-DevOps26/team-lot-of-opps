import { createListenerMiddleware } from '@reduxjs/toolkit'
import { LANGUAGE_STORAGE_KEY, setLanguage } from '../features/i18nSlice'

export const persistenceListener = createListenerMiddleware()

persistenceListener.startListening({
  actionCreator: setLanguage,
  effect: (action) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, action.payload)
    } catch {
      // ignore storage failures (private mode, quota)
    }
  },
})
