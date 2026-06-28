import { test, expect } from './fixtures'
import { makeInvoice } from './mocks/data'

const pdf = {
  name: 'receipt.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 mock receipt'),
}

test.describe('Upload', () => {
  test('shows pending invoices for review and kept invoices as verified', async ({
    mockApi,
    authedPage: page,
  }) => {
    mockApi.setInvoices([
      makeInvoice({ id: 10, itemName: 'Scanned receipt', company: 'Pending Vendor', price: 12.34, status: 'PENDING' }),
      makeInvoice({ id: 11, itemName: 'Kept receipt', company: 'Kept Vendor', price: 56.78, status: 'ACCEPTED' }),
    ])
    await page.goto('/upload')

    await expect(page.getByText('Pending Vendor')).toBeVisible()
    await expect(page.getByText('Needs Review')).toBeVisible()
    await expect(page.getByText('Kept Vendor')).toBeVisible()
    await expect(page.getByText('Verified')).toBeVisible()
  })

  test('uploads a file, reviews the extraction, and keeps it', async ({ mockApi, authedPage: page }) => {
    mockApi.setInvoices([])
    await page.goto('/upload')
    await expect(page.getByRole('heading', { name: 'Processing Queue' })).toBeVisible()

    await page.getByLabel('Drag & drop your invoices here').setInputFiles(pdf)

    // Extracted data surfaces as a review card.
    await expect(page.getByText('Acme GmbH')).toBeVisible()
    await expect(page.getByText('€ 42.50')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep' })).toBeVisible()

    await page.getByRole('button', { name: 'Keep' }).click()

    await expect(page.getByText('Verified')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep' })).toHaveCount(0)
  })

  test('undoes an extracted invoice', async ({ mockApi, authedPage: page }) => {
    mockApi.setInvoices([
      makeInvoice({ id: 20, itemName: 'To discard', company: 'Discard Vendor', price: 9.99, status: 'PENDING' }),
    ])
    await page.goto('/upload')
    await expect(page.getByText('Discard Vendor')).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Discard Vendor')).toHaveCount(0)
  })
})
