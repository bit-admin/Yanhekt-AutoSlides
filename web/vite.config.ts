import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { featureFlags, manualChunks } from "./vite.shared";

// The Vue frontend lives in frontend/ and builds into dist/, which the
// Worker serves through its ASSETS binding (see wrangler.jsonc). During
// development, `npm run dev:web` proxies /api, /playlist, and /segment to
// `npm run dev` (wrangler on :8787) so the real Worker routes answer.
export default defineConfig({
  root: "frontend",
  plugins: [vue()],
  // Compile-time off switch for the demo build's hooks (see vite.demo.config.ts).
  // A constant, so Rollup drops those branches — and everything under
  // frontend/src/demo/ — from the production bundle. featureFlags does the
  // same for Vue's and vue-i18n's own optional runtime paths (see
  // vite.flags.ts for what each one asserts about this app).
  define: { __DEMO__: "false", ...featureFlags },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks } },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/playlist": "http://localhost:8787",
      "/segment": "http://localhost:8787",
    },
  },
});
