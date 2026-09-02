import { defineConfig } from 'vitest/config';

// Node-environment unit tests; workerd globals (`caches`, `ExecutionContext`)
// are stubbed per test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
