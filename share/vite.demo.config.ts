import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Demo build #1: the AutoSlides Index (apex site), wired to fabricated data and
// published as a plain static bundle under /demo/ so anyone can click through
// the interface with no account, no published lecture and no network. It is
// also what scripts/screenshots.mjs drives to produce the README images.
//
// The demo has its own HTML shell (demo/index.html) pointing at its own entry,
// so no entry-rewriting plugin is needed: the entry installs the fetch stub and
// the two hooks in src/lib/demoRegistry.ts, then imports the real app.
//
// `__DEMO__` is defined false in both production configs, so Rollup drops every
// demo branch there and none of demo/ reaches a real build.
//
// `emptyOutDir: false` because dist/ already holds the two production builds by
// the time this runs, and dist/demo/v1 is emitted by vite.demo-v1.config.ts. Only the first build in
// the chain empties anything it owns, so `npm run build` wipes dist/ up front
// (`npm run clean`) — otherwise orphaned chunks accumulate and ship forever.
export default defineConfig({
  base: '/demo/',
  root: 'demo',
  // Favicons live in share/public/ so all builds can see them.
  publicDir: '../public',
  define: { __DEMO__: 'true' },
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist/demo',
    emptyOutDir: false,
    // The demo entry awaits installDemo() before importing the app.
    target: 'es2022',
  },
});
