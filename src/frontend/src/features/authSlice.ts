import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  sub: string
  email: string
  name: string
  picture?: string
}

interface AuthState {
  user: AuthUser | null
}

const STORAGE_KEY = 'auth.session.v1'

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') return { user: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null }
    const parsed = JSON.parse(raw) as { user?: AuthUser }
    if (!parsed.user || typeof parsed.user.sub !== 'string') return { user: null }
    return { user: parsed.user }
  } catch {
    return { user: null }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    signedIn(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: action.payload }))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    signedOut(state) {
      state.user = null
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    },
  },
})

export const { signedIn, signedOut } = authSlice.actions
export default authSlice.reducer
