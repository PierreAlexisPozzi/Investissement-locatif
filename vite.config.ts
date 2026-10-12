import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { pluginServiceWorker } from './pwa/plugin-service-worker.ts'

// https://vite.dev/config/ — https://vitest.dev/config/
export default defineConfig({
  // Chemins relatifs : le site fonctionne à la racine d'un domaine comme dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [react(), pluginServiceWorker(readFileSync(new URL('./pwa/service-worker.js', import.meta.url), 'utf8'))],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
