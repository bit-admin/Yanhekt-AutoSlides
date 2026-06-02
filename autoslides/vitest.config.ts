import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Unit tests run in plain node — the pure orchestration machines have no
// Electron/Vue/DOM dependencies. Aliases mirror tsconfig.json so test imports
// resolve the same way as production code.
export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/renderer/shared'),
      '@common': resolve(__dirname, 'src/shared'),
      '@features': resolve(__dirname, 'src/renderer/features')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
