import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No @types/node in this package.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

// The Index site at `/`: a static React app emitted into dist/ next to the
// viewer's dist/v1, so `/` and `/assets/*` are served by the asset layer with
// no Worker invocation. /search and /course/{id} get the same shell from the
// Worker (src/worker.ts). `npm run dev:site` proxies /api to a local
// `wrangler dev` (port 8787) or, with INDEX_API=…, to any deployed Worker.
export default defineConfig({
  root: 'site',
  // Icons live in share/public/ (shared with the viewer).
  publicDir: '../public',
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: env.INDEX_API ?? 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    outDir: '../dist',
    // dist/v1 (the viewer) is built first; keep it.
    emptyOutDir: false,
  },
});
