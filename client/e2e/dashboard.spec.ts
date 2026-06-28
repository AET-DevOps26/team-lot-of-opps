import { test, expect } from './fixtures'
import { defaultInvoices, sumPrices } from './mocks/data'

const eur = (n: number) => `€${n.toFixed(2)}`

test.describe('Dashboard', () => {
  test('shows expense totals computed from the invoices', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')
    const total = sumPrices(defaultInvoices())
    // Total Expenses / carryforward / recorded expenses all render this value.
    await expect(page.getByText(eur(total)).first()).toBeVisible()
  })

  test('recalculates the future refund when the tax rate changes', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')
    const total = sumPrices(defaultInvoices())

    const taxRate = page.getByRole('spinbutton', { name: 'Future tax rate (Est. 30%)' })
    await taxRate.fill('50')
    await expect(page.getByText(eur(total * 0.5), { exact: true })).toBeVisible()

    await taxRate.fill('0')
    await expect(page.getByText(eur(0), { exact: true }).first()).toBeVisible()
    // At 0% the decrement control is disabled.
    await expect(page.getByRole('button', { name: 'Future tax rate (Est. 30%) -' })).toBeDisabled()
  })

  test('renders AI suggestions', async ({ authedPage: page }) => {
    await page.goto('/')
    await expect(
      page.getByText('Your semester ticket may qualify as travel expenses.'),
    ).toBeVisible()
  })

  test('shows the empty state with an upload CTA when there are no suggestions', async ({
    authedPage: page,
    mockApi,
  }) => {
    mockApi.setSuggestions([])
    await page.goto('/')
    const aiSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'AI Suggestions' }),
    })
    await expect(
      aiSection.getByText('No suggestions yet — upload a document to get started.'),
    ).toBeVisible()
    await expect(aiSection.getByRole('link', { name: 'Upload' })).toBeVisible()
  })

  test('shows an error state when suggestions fail to load', async ({ authedPage: page, mockApi }) => {
    mockApi.setSuggestionsError()
    await page.goto('/')
    await expect(page.getByText('Could not load suggestions right now.')).toBeVisible()
  })

  test('shows a loading state while suggestions are in flight', async ({ authedPage: page, mockApi }) => {
    mockApi.setSuggestionsDelay(1000)
    await page.goto('/')
    await expect(page.getByText('Analyzing your invoices…')).toBeVisible()
    await expect(
      page.getByText('Your semester ticket may qualify as travel expenses.'),
    ).toBeVisible()
  })
})
