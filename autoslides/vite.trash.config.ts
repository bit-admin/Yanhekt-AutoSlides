import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Vite config for trash window
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
      input: path.resolve(__dirname, 'trash.html'),
      external: ['electron'],
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5174 // Different port for trash window dev server
  }
}));
