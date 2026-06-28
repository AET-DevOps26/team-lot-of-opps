import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }
const apiTarget = process.env.VITE_API_TARGET

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5173,
    // Don't pop a browser tab when the dev server is managed by Playwright (E2E=1).
    open: !process.env.E2E,
    ...(apiTarget && {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    }),
  },
})
