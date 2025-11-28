import { defineConfig } from 'vite';

// https://vitejs.dev/config
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
      external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'ffmpeg-static']
    }
  }
}));
