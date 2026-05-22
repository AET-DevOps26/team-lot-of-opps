import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }
const apiTarget = process.env.VITE_API_TARGET

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
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
