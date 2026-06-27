import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The apex site (AutoSlides Index — search + discovery) is the second Vite build.
// It is rooted at apex/ and emitted to dist/ root (base '/') so "/" and its
// hashed /assets are real static assets served directly by Cloudflare's asset
// layer — NO Worker invocation. `emptyOutDir: false` so it does not wipe the
// viewer that the primary build already emitted into dist/v1.
export default defineConfig({
  base: '/',
  root: 'apex',
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,
  },
});
