import { createSlice } from '@reduxjs/toolkit'

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
export default uiSlice.reducer
