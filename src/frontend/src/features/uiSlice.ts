import { createSlice } from '@reduxjs/toolkit'
import type { RootState } from '../store'

interface UiState {
  settingsOpen: boolean
}

const initialState: UiState = {
  settingsOpen: false,
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
  },
})

export const { openSettings, closeSettings } = uiSlice.actions
export const selectSettingsOpen = (state: RootState) => state.ui.settingsOpen
export default uiSlice.reducer
