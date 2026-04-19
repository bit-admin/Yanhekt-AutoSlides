import { defineConfig } from 'vite';

// Guest preload bundle injected into the <webview> in the Web Capture add-on.
// Mirrors vite.preload.config.ts but is built separately so main can resolve
// its on-disk path and pass it via the `preload` webview attribute.
export default defineConfig(({ mode }) => ({
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
