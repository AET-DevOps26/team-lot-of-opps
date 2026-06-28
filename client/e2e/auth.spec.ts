import { test, expect, signIn, ensureTestUser } from './fixtures'
import { TEST_USER } from './mocks/data'

test.describe('Auth & route guards', () => {
  test.beforeEach(async () => {
    await ensureTestUser()
  })

  test('redirects unauthenticated users to /welcome', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByPlaceholder('Email')).toBeVisible()
  })

  test('signs in with email and password', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await expect(page.getByRole('heading', { name: 'Tax Overview' })).toBeVisible()
  })

  test('shows an error for invalid credentials', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/welcome')
    await page.getByPlaceholder('Email').fill(TEST_USER.email)
    await page.getByPlaceholder('Password', { exact: true }).fill('definitely-wrong')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/welcome$/)
  })

  test('validates the password confirmation on sign up (no network)', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/welcome')
    await page.getByRole('button', { name: "Don't have an account? Sign up" }).click()
    await page.getByPlaceholder('Email').fill(`new+${Date.now()}@example.com`)
    await page.getByPlaceholder('Password', { exact: true }).fill('password123')
    await page.getByPlaceholder('Confirm password').fill('does-not-match')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
  })

  test('signs up a new account and lands on the dashboard', async ({ page, mockApi }) => {
    void mockApi
    const email = `new+${Date.now()}@example.com`
    await page.goto('/welcome')
    await page.getByRole('button', { name: "Don't have an account? Sign up" }).click()
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password', { exact: true }).fill('password123')
    await page.getByPlaceholder('Confirm password').fill('password123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Tax Overview' })).toBeVisible()
  })

  test('redirects authenticated users away from /welcome', async ({ authedPage: page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: 'Tax Overview' })).toBeVisible()
  })

  test('signs out from the account menu', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByPlaceholder('Email')).toBeVisible()
  })
})
