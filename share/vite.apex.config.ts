import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The apex site (AutoSlides Index — search + discovery) is the second Vite build.
// It is rooted at apex/ and emitted to dist/ root (base '/') so "/" and its
// hashed /assets are real static assets served directly by Cloudflare's asset
// layer — NO Worker invocation. `emptyOutDir: false` so it does not wipe the
// viewer that the primary build already emitted into dist/v1. Only the first build in
// the chain empties anything it owns, so `npm run build` wipes dist/ up front
// (`npm run clean`) — otherwise orphaned chunks accumulate and ship forever.
export default defineConfig({
  base: '/',
  // Compile-time constant: dead-codes every demo branch out of the real build.
  define: { __DEMO__: 'false' },
  root: 'apex',
  // Favicons live in share/public/ (not apex/public) so both Vite builds can
  // see them. Relative to `root`, that is ../public → copied to dist/.
  publicDir: '../public',
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,
  },
});
