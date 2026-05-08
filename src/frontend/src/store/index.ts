import { configureStore } from '@reduxjs/toolkit'
import i18nReducer from '../features/i18nSlice'
import uiReducer from '../features/uiSlice'

export const store = configureStore({
  reducer: {
    i18n: i18nReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
