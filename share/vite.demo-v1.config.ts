import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Demo build #2: the v1 slides viewer, under /demo/v1/ — the same one-level-down
// relationship the real site has between / and /v1/, so the demo's links have
// production's shape. See vite.demo.config.ts for the rest of the reasoning.
//
// It writes INTO dist/demo, so it must run after vite.demo.config.ts.
export default defineConfig({
  base: '/demo/v1/',
  root: 'demo/v1',
  publicDir: '../../public',
  define: { __DEMO__: 'true' },
  plugins: [react()],
  server: {
    fs: { allow: ['../..'] },
  },
  build: {
    outDir: '../../dist/demo/v1',
    emptyOutDir: false,
    target: 'es2022',
  },
});
