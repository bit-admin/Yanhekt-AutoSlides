import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [vue()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('vue') && !id.includes('vue-i18n')) {
              return 'vue';
            }
            if (id.includes('vue-i18n')) {
              return 'vue-i18n';
            }
            if (id.includes('hls.js')) {
              return 'hls';
            }
            if (id.includes('axios')) {
              return 'axios';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5173
  }
});
