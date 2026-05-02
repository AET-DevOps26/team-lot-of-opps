import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    settingsOpen: false,
  },
  reducers: {
    openSettings: (state) => {
      state.settingsOpen = true
    },
    closeSettings: (state) => {
      state.settingsOpen = false
    },
  },
})

export const { openSettings, closeSettings } = uiSlice.actions
export default uiSlice.reducer
