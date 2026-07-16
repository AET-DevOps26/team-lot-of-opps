import { createSlice } from '@reduxjs/toolkit'
import type { RootState } from '../store'

interface InvoicesState {
  /** Bumped whenever the chat agent writes an invoice, so pages know to refetch. */
  refreshToken: number
}

const initialState: InvoicesState = {
  refreshToken: 0,
}

const invoicesSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    invoicesChanged(state) {
      state.refreshToken += 1
    },
  },
})

export const { invoicesChanged } = invoicesSlice.actions
export const selectInvoicesRefreshToken = (state: RootState) => state.invoices.refreshToken
export default invoicesSlice.reducer
