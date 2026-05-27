import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Vite config for Add-ons window
export default defineConfig(({ mode }) => ({
  // Keep this renderer isolated from the main window's optimizer cache. The
  // dev servers start together, and a shared cache can force Vite to
  // re-optimize dependencies during the main window's first load.
  cacheDir: 'node_modules/.vite-addons',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Electron webview is a custom element
          isCustomElement: (tag) => tag === 'webview',
        },
      },
    }),
  ],
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
      input: path.resolve(__dirname, 'addons.html'),
      external: ['electron'],
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5175 // Port for addons window dev server
  }
}));
