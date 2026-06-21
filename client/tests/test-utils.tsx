import type { PropsWithChildren, ReactElement } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import { render, type RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import authReducer, { type AuthUser } from '../src/features/authSlice'
import i18nReducer from '../src/features/i18nSlice'
import uiReducer from '../src/features/uiSlice'
import type { RootState } from '../src/store'

/**
 * Builds a fresh store per test (without the persistence middleware) so tests
 * stay isolated from each other and from localStorage.
 */
export function makeTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      auth: authReducer,
      i18n: i18nReducer,
      ui: uiReducer,
    },
    preloadedState,
  })
}

export type TestStore = ReturnType<typeof makeTestStore>

interface ProviderRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>
  store?: TestStore
  /** Initial URL for the MemoryRouter. */
  route?: string
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = makeTestStore(preloadedState),
    route = '/',
    ...renderOptions
  }: ProviderRenderOptions = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    )
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

export const testUser: AuthUser = {
  uid: 'user-1',
  email: 'jane@example.com',
  displayName: 'Jane Doe',
}

/** Preloaded state for a signed-in session. */
export function authenticatedState(): Partial<RootState> {
  return { auth: { user: testUser, loading: false } }
}
