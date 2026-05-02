import { configureStore } from '@reduxjs/toolkit'
import counterReducer from '../features/counterSlice'
import i18nReducer from '../features/i18nSlice'
import uiReducer from '../features/uiSlice'

const store = configureStore({
  reducer: {
    counter: counterReducer,
    i18n: i18nReducer,
    ui: uiReducer,
  },
})

export default store
