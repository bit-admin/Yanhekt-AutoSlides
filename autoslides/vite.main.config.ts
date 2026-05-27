import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

// Copy PDFKit's bundled font metric files (AFM) and the sRGB ICC profile next
// to the built main.js. PDFKit's StandardFont loader calls
// `fs.readFileSync(__dirname + '/data/<Name>.afm')` from within its own
// source, which after Vite bundling resolves to `<outDir>/data/<Name>.afm`.
// Without these the very first `new PDFDocument({})` call throws ENOENT when
// it auto-initializes Helvetica.
function pdfkitDataCopy(): Plugin {
  const sourceDir = path.resolve(__dirname, 'node_modules/pdfkit/js/data');
  return {
    name: 'copy-pdfkit-data',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, '.vite/build');
      const destDir = path.join(outDir, 'data');
      fs.mkdirSync(destDir, { recursive: true });
      if (!fs.existsSync(sourceDir)) return;
      for (const entry of fs.readdirSync(sourceDir)) {
        const src = path.join(sourceDir, entry);
        const dst = path.join(destDir, entry);
        try {
          fs.copyFileSync(src, dst);
        } catch {
          // continue
        }
      }
    }
  };
}

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  plugins: [pdfkitDataCopy()],
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
      external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'ffmpeg-static', 'sharp']
    }
  }
}));
