import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2500 },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
} as any)
