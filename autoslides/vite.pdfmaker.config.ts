import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Vite config for PDF Maker window
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
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
      input: path.resolve(__dirname, 'pdfmaker.html'),
      external: ['electron'],
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5175 // Different port for pdfmaker window dev server
  }
}));
