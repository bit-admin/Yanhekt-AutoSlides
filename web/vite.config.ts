import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// The Vue frontend lives in frontend/ and builds into dist/, which the
// Worker serves through its ASSETS binding (see wrangler.jsonc). During
// development, `npm run dev:web` proxies /api to `npm run dev` (wrangler on
// :8787) so the real Worker routes answer.
export default defineConfig({
  root: "frontend",
  plugins: [vue()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
