import { defineConfig } from 'vitest/config';

// Worker + lib unit tests. `include` is explicit so the autoslides shared
// files pulled in by tsconfig (and their tests) are never collected here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
