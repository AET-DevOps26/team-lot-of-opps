import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/authSlice'
import i18nReducer from '../features/i18nSlice'
import uiReducer from '../features/uiSlice'
import invoicesReducer from '../features/invoicesSlice'
import { persistenceListener } from './persistence'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    i18n: i18nReducer,
    ui: uiReducer,
    invoices: invoicesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(persistenceListener.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
