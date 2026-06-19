import { createSlice } from '@reduxjs/toolkit'
import type { RootState } from '../store'

interface UiState {
  settingsOpen: boolean
  mobileNavOpen: boolean
}

const initialState: UiState = {
  settingsOpen: false,
  mobileNavOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openSettings(state) {
      state.settingsOpen = true
    },
    closeSettings(state) {
      state.settingsOpen = false
    },
    toggleMobileNav(state) {
      state.mobileNavOpen = !state.mobileNavOpen
    },
    closeMobileNav(state) {
      state.mobileNavOpen = false
    },
  },
})

export const { openSettings, closeSettings, toggleMobileNav, closeMobileNav } = uiSlice.actions
export const selectSettingsOpen = (state: RootState) => state.ui.settingsOpen
export const selectMobileNavOpen = (state: RootState) => state.ui.mobileNavOpen
export default uiSlice.reducer
