import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Vite config for Add-ons window
export default defineConfig(({ mode }) => ({
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
