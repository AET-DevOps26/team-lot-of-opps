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
}

const STORAGE_KEY = 'auth.session.v1'

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') return { user: null, token: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw) as { user?: AuthUser; token?: string }
    if (!parsed.user || typeof parsed.user.sub !== 'string') return { user: null, token: null }
    return { user: parsed.user, token: parsed.token ?? null }
  } catch {
    return { user: null, token: null }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    signedIn(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    signedOut(state) {
      state.user = null
      state.token = null
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    },
  },
})

export const { signedIn, signedOut } = authSlice.actions
export const selectToken = (state: RootState) => state.auth.token
export default authSlice.reducer
