import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Run in a Node environment — all auth logic is server-side only
    environment: 'node',
    // Make vi.mock() hoist to the top of each file automatically
    globals: true,
    // Clear all mocks between tests to prevent state leakage
    clearMocks: true,
    restoreMocks: true,
    // Global setup: mock `server-only` before any test file runs
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/db/connect.ts', 'lib/supabaseClient.ts'],
    },
  },
  resolve: {
    alias: {
      // Mirror the @/* path alias defined in tsconfig.json
      '@': path.resolve(__dirname, '.'),
    },
  },
})
