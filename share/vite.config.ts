import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The viewer lives under /v1 and is emitted physically into dist/v1 so every
// viewer path (/v1/, /v1/assets/*) is a real static asset served directly by
// Cloudflare's asset layer — NO Worker invocation. The apex landing is added to
// dist/ root by scripts/postbuild.mjs. `fs.allow: ['..']` lets the build import
// the canonical share-link codec from the sibling autoslides project.
export default defineConfig({
  base: '/v1/',
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist/v1',
    emptyOutDir: true,
  },
});
