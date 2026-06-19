import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

export interface AuthUser {
  uid: string
  email: string
  displayName: string
  photoURL?: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, loading: true } as AuthState,
  reducers: {
    signingIn(state) {
      state.loading = true
    },
    signedIn(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
      state.loading = false
    },
    signedOut(state) {
      state.user = null
      state.loading = false
    },
  },
})

export const { signingIn, signedIn, signedOut } = authSlice.actions
export const selectUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) => state.auth.user !== null
export const selectAuthLoading = (state: RootState) => state.auth.loading
export const selectUserId = (state: RootState) => state.auth.user?.uid ?? null
export default authSlice.reducer
