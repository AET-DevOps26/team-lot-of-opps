import { test, expect } from './fixtures'
import { defaultInvoices } from './mocks/data'

const rows = (page: import('@playwright/test').Page) => page.locator('[id^="invoice-"]')

test.describe('Invoices', () => {
  test.beforeEach(async ({ mockApi, authedPage: page }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
    await expect(rows(page)).toHaveCount(6)
  })

  test('searches by vendor / item name', async ({ authedPage: page }) => {
    await page.getByPlaceholder('Search vendors or notes...').fill('laptop')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.locator('#invoice-1')).toContainText('TechStore')
  })

  test('filters by year', async ({ authedPage: page }) => {
    await page.getByRole('combobox').first().selectOption('2023')
    await expect(rows(page)).toHaveCount(2) // Textbooks (2023), Desk (2023)
  })

  test('filters by category', async ({ authedPage: page }) => {
    await page.getByRole('combobox').nth(1).selectOption('FORTBILDUNGEN')
    await expect(rows(page)).toHaveCount(2) // Textbooks, Course fee
  })

  test('filters by amount range', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'More Filters' }).click()
    await page.getByPlaceholder('0.00').fill('100')
    await expect(rows(page)).toHaveCount(4) // excludes Internet (45) and Course fee (89.99)
  })

  test('sorts by amount ascending then descending', async ({ authedPage: page }) => {
    // The header button's accessible name includes the sort icon ligature,
    // e.g. "Amount unfold_more", so match on the substring rather than exact.
    await page.getByRole('button', { name: 'Amount' }).click()
    await expect(rows(page).first()).toContainText('Telekom') // 45.00 — lowest
    await page.getByRole('button', { name: 'Amount' }).click()
    await expect(rows(page).first()).toContainText('TechStore') // 999.99 — highest
  })

  test('creates a new invoice', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'Add Invoice' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Item Name' }).fill('Monitor')
    await dialog.getByRole('textbox', { name: 'Vendor' }).fill('Dell')
    await dialog.getByRole('spinbutton', { name: 'Amount (€)' }).fill('300')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toBeHidden()
    await expect(rows(page)).toHaveCount(7)
    await expect(page.getByRole('cell', { name: 'Dell' })).toBeVisible()
  })

  test('edits an existing invoice', async ({ authedPage: page }) => {
    await page.locator('#invoice-1').getByTitle('Edit').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('spinbutton', { name: 'Amount (€)' }).fill('1500')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.locator('#invoice-1')).toContainText('1.500,00')
  })

  test('deletes an invoice after confirmation', async ({ authedPage: page }) => {
    page.on('dialog', (d) => d.accept())
    await page.locator('#invoice-6').getByTitle('Delete').click()
    await expect(page.locator('#invoice-6')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(5)
  })
})
