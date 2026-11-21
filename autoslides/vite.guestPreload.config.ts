import { defineConfig } from 'vite';
import path from 'path';

// Preload bundles for the embedded guest views: Web Capture, browser sign-in
// and the saved-logins menu. Mirrors vite.preload.config.ts but is built
// separately so GuestViewManager can pass each path to its WebContentsView.
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/renderer/shared'),
      '@common': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/renderer/features'),
    },
  },
  build: {
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      format: {
        comments: false
      }
    } : undefined,
    rollupOptions: {
      external: ['electron']
    }
  }
}));
