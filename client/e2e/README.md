# End-to-end tests (Playwright)

This folder holds the **end-to-end** tests that drive the real frontend in a real
browser through complete user journeys.

> Unit & component tests live in [`../tests/`](../tests/) and run on **Vitest**
> (jsdom, `*.test.tsx`). They are kept separate because they use a different
> runner, environment, and CI stage. E2E tests here use **Playwright**
> (`*.spec.ts`) and never overlap with the Vitest suite.

## Running

```bash
npm run e2e        # headless
npm run e2e:ui     # interactive UI mode
```

`npm run e2e` is self-contained — [`../playwright.config.ts`](../playwright.config.ts)
boots the Firebase Auth emulator and a Vite dev server (port `5273`) automatically.
**Java** is the only system prerequisite (for the emulator).

## How it works

- **Auth** runs against the Firebase Auth emulator (`firebase.emulator.json`), wired
  in via an env-gated `connectAuthEmulator` in `src/firebase.ts`. `fixtures.ts` seeds
  a test user and signs in through the real `/welcome` form.
- **Backend** (`/api/v1/**`) is mocked in-browser by `mocks/server.ts` — a stateful
  store so create/edit/delete/accept/upload flows are genuinely verifiable, and
  suggestion responses are configurable (list / empty / error / delayed).
- Tests use **role / label / text** selectors (the app has no `data-testid`); the UI
  language is pinned to English for determinism.

## Layout

```
e2e/
  fixtures.ts             # `test` extended with mockApi + authedPage fixtures
  firebase.emulator.json  # test-only emulator config (auth only, UI off)
  mocks/
    data.ts               # fixture data + factories
    server.ts             # in-browser mock of /api/v1/**
  *.spec.ts               # one spec per flow: auth, dashboard, invoices, upload
```

## Adding a test

Import `test`/`expect` from `./fixtures`. Use `authedPage` for an already-signed-in
page and `mockApi` to shape backend responses:

```ts
import { test, expect } from './fixtures'

test('does the thing', async ({ authedPage: page, mockApi }) => {
  mockApi.setInvoices([/* ... */])
  await page.goto('/invoices')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
})
```
