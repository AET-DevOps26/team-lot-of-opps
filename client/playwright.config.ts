import { defineConfig, devices } from '@playwright/test'

// The frontend talks to the Firebase Auth Emulator (port 9099) during e2e.
// Backend REST calls (/api/v1/**) are intercepted in-browser via page.route,
// so no real backend services are required.
// Dedicated port so e2e never clashes with a local dev server / docker stack on 5173.
const FRONTEND_PORT = 5273
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
const EMULATOR_PORT = 9099

// Offline, credential-free Firebase project (the "demo-" prefix tells the
// Firebase SDK/emulator to never reach out to Google).
const firebaseEnv = {
  E2E: '1',
  VITE_USE_FIREBASE_EMULATOR: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${EMULATOR_PORT}`,
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
  VITE_FIREBASE_PROJECT_ID: 'demo-e2e',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-e2e.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:demo',
  VITE_API_BASE_URL: '',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Runs from client/, so npx resolves the locally-installed firebase-tools.
      // A test-only firebase config keeps the emulator UI off (faster, offline).
      command:
        'npx firebase emulators:start --only auth --project demo-e2e --config e2e/firebase.emulator.json',
      port: EMULATOR_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Suppress the CLI's interactive data-collection prompt.
      env: { CI: '1' },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: firebaseEnv,
    },
  ],
})
