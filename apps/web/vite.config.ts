/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import packageJson from './package.json'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // web consume el código fuente de shared; evita el rebuild del paquete y el interop CJS→ESM
    // del dist (Vite compila el TS a ESM). Los utils se importan por su subpath de src.
    alias: {
      '@project-workgroup/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_NAME__: JSON.stringify(packageJson.name),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ]
    }
  }
})
