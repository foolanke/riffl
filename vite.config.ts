import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
// Two pages: the designed app at / (index.html) and the plain test page
// at /test.html (the step 1-29 debug controls, kept unchanged).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        test: resolve(import.meta.dirname, 'test.html'),
      },
    },
  },
})
