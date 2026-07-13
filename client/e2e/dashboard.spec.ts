import { test, expect } from './fixtures'
import { defaultInvoices, sumPrices } from './mocks/data'
import { refundPrognose, verlustvortrag, type StudyYearInput } from '../src/lib/taxCalculator'

const eur = (n: number) => `€${n.toFixed(2)}`

const yearInput = (belegausgaben: number, extra: Partial<StudyYearInput> = {}): StudyYearInput => ({
  belegausgaben,
  pendlertage: 0,
  entfernungKm: 0,
  homeofficeTage: 0,
  bewerbungenSchriftlich: 0,
  bewerbungenOnline: 0,
  umzug: false,
  einnahmenWerkstudent: 0,
  ...extra,
})

const belegByYear = (): Record<string, number> =>
  defaultInvoices().reduce<Record<string, number>>((acc, inv) => {
    const year = String(new Date(inv.invoiceDate!).getFullYear())
    acc[year] = (acc[year] || 0) + inv.price
    return acc
  }, {})

test.describe('Dashboard', () => {
  test('shows expense totals computed from the invoices', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')
    const total = sumPrices(defaultInvoices())
    // Total Expenses / carryforward / recorded expenses all render this value.
    await expect(page.getByText(eur(total)).first()).toBeVisible()
  })

  test('recalculates the refund when the gross salary changes', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')

    const carryforward = verlustvortrag(Object.values(belegByYear()).map((b) => yearInput(b)))
    await expect(page.getByText(eur(carryforward)).first()).toBeVisible()

    const salary = page.getByRole('spinbutton', { name: 'Expected gross starting salary (€/year)' })
    await salary.fill('48000')
    await expect(
      page.getByText(eur(refundPrognose(48000, carryforward).erstattung), { exact: true }),
    ).toBeVisible()

    await salary.fill('0')
    await expect(page.getByText(eur(0), { exact: true }).first()).toBeVisible()
  })

  test('per-year pauschale inputs increase the carryforward', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')

    const beleg = belegByYear()
    const year2024 = page.locator('details', { hasText: 'Study year 2024' })
    await year2024.locator('summary').click()
    await year2024.getByLabel('Home-office days').fill('100')

    const carryforward = verlustvortrag(
      Object.entries(beleg).map(([year, b]) =>
        yearInput(b, year === '2024' ? { homeofficeTage: 100 } : {}),
      ),
    )
    await expect(page.getByText(eur(carryforward)).first()).toBeVisible()
  })

  test('advanced deduction rate changes the projected refund', async ({ authedPage: page, mockApi }) => {
    mockApi.setInvoices(defaultInvoices())
    await page.goto('/')

    const carryforward = verlustvortrag(Object.values(belegByYear()).map((b) => yearInput(b)))
    const salary = page.getByRole('spinbutton', { name: 'Expected gross starting salary (€/year)' })
    await salary.fill('48000')

    const advanced = page.locator('details', { hasText: 'Advanced assumptions' })
    await advanced.locator('summary').click()
    await advanced.getByLabel('Est. deductions on salary (%)').fill('30')

    await expect(
      page.getByText(eur(refundPrognose(48000, carryforward, 0.3).erstattung), { exact: true }),
    ).toBeVisible()
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
