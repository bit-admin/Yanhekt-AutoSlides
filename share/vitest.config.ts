import { defineConfig } from 'vitest/config';

// Worker + lib unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
