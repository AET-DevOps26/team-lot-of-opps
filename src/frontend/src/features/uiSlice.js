import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    settingsOpen: false,
};
const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        openSettings(state) {
            state.settingsOpen = true;
        },
        closeSettings(state) {
            state.settingsOpen = false;
        },
    },
});
export const { openSettings, closeSettings } = uiSlice.actions;
export default uiSlice.reducer;
