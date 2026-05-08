import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  sub: string
  email: string
  name: string
  picture?: string
}

interface AuthState {
  user: AuthUser | null
  credential: string | null
}

const STORAGE_KEY = 'auth.session.v1'

function decodeIdToken(idToken: string): AuthUser | null {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = atob(padded)
    const decoded = JSON.parse(
      decodeURIComponent(
        Array.from(json)
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    ) as Record<string, unknown>
    if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') return null
    return {
      sub: decoded.sub,
      email: decoded.email,
      name: typeof decoded.name === 'string' ? decoded.name : decoded.email,
      picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
    }
  } catch {
    return null
  }
}

function loadInitialState(): AuthState {
  if (typeof window === 'undefined') return { user: null, credential: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, credential: null }
    const parsed = JSON.parse(raw) as { credential?: unknown }
    if (typeof parsed.credential !== 'string') return { user: null, credential: null }
    const user = decodeIdToken(parsed.credential)
    if (!user) {
      window.localStorage.removeItem(STORAGE_KEY)
      return { user: null, credential: null }
    }
    return { user, credential: parsed.credential }
  } catch {
    return { user: null, credential: null }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    signedIn(state, action: PayloadAction<string>) {
      const credential = action.payload
      const user = decodeIdToken(credential)
      if (!user) return
      state.user = user
      state.credential = credential
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ credential }))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    signedOut(state) {
      state.user = null
      state.credential = null
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
