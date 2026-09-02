import { defineConfig } from "vitest/config";

// Worker-side unit tests only (frontend has its own Vite root). Tests import
// from "vitest" explicitly so `tsc --noEmit` needs no extra `types` entry.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
