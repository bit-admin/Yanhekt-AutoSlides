import { defineConfig } from "vitest/config";

// Worker-side tests plus the few pure frontend ones (the frontend has its own
// Vite root, so its sources are listed explicitly). Tests import from "vitest"
// explicitly so `tsc --noEmit` needs no extra `types` entry. The setup file
// shims localStorage, which frontend modules read at import time.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "frontend/src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
