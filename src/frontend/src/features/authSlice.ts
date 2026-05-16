import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

export interface AuthUser {
  sub: string
  email: string
  name: string
  picture?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading?: boolean
}

const STORAGE_KEY = 'auth.session.v1'

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') return { user: null, token: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw) as { user?: AuthUser; token?: string }
    if (!parsed.user || typeof parsed.user.sub !== 'string') return { user: null, token: null }
    return { user: parsed.user, token: parsed.token ?? null, loading: false }
  } catch {
    return { user: null, token: null, loading: false }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    signingIn(state) {
      state.loading = true
    },
    signedIn(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      state.loading = false
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    signedOut(state) {
      state.user = null
      state.token = null
      state.loading = false
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    },
  },
})

export const { signingIn, signedIn, signedOut } = authSlice.actions
export const selectAuthLoading = (state: RootState) => !!state.auth.loading
export const selectToken = (state: RootState) => state.auth.token
export default authSlice.reducer
