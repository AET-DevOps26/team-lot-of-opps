import { test as base, expect, type Page } from '@playwright/test'
import { createMockApi, type MockApi } from './mocks/server'
import { TEST_USER } from './mocks/data'

const EMULATOR = 'http://127.0.0.1:9099'

/**
 * Create the shared e2e user in the Auth emulator. Idempotent: a repeated
 * sign-up returns EMAIL_EXISTS, which we ignore. Safe to call from any test
 * since the emulator is guaranteed running before tests start.
 */
export async function ensureTestUser(): Promise<void> {
  await fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...TEST_USER, returnSecureToken: true }),
  }).catch(() => {
    /* emulator not reachable / user exists — ignore */
  })
}

/** Sign in through the real /welcome form and wait for the dashboard. */
export async function signIn(page: Page, creds = TEST_USER): Promise<void> {
  await page.goto('/welcome')
  await page.getByPlaceholder('Email').fill(creds.email)
  await page.getByPlaceholder('Password', { exact: true }).fill(creds.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tax Overview' })).toBeVisible()
}

interface Fixtures {
  /** Stateful mock of the backend REST API, wired to the page. */
  mockApi: MockApi
  /** A page that is already authenticated (and has API mocks registered). */
  authedPage: Page
}

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    const api = await createMockApi(page)
    await use(api)
  },
  authedPage: async ({ page, mockApi }, use) => {
    void mockApi // ensures API routes + language are registered before navigation
    await ensureTestUser()
    await signIn(page)
    await use(page)
  },
})

export { expect }
