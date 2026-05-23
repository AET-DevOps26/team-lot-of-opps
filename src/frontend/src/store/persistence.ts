import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { AUTH_STORAGE_KEY, signedIn, signedOut } from '../features/authSlice'
import { LANGUAGE_STORAGE_KEY, setLanguage } from '../features/i18nSlice'
import type { RootState } from './index'

/**
 * Side effects (writing to localStorage) belong in middleware, not reducers —
 * reducers must stay pure. This listener mirrors the persisted slices to
 * localStorage whenever their relevant actions are dispatched.
 */
export const persistenceListener = createListenerMiddleware()

persistenceListener.startListening({
  matcher: isAnyOf(signedIn, signedOut),
  effect: (_action, api) => {
    const { user, token } = (api.getState() as RootState).auth
    try {
      if (user) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }))
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch {
      // ignore storage failures (private mode, quota)
    }
  },
})

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
