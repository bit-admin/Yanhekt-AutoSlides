import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { hideKey } from './src/main/platform/courseIndex/clientKey';

// The course index age identity (src/main/platform/courseIndex/clientKey.ts):
// $INDEX_CLIENT_IDENTITY in CI, else the local Mac file (as age-keygen
// writes it: comment lines, then the key). Hidden under a fresh seed every
// build; null when neither is there (the index is then off).
function indexClientKey(): string {
  let text = process.env.INDEX_CLIENT_IDENTITY ?? '';
  const file = path.join(os.homedir(), '.config', 'autoslides', 'index-client-identity.txt');
  if (!text.trim() && fs.existsSync(file)) text = fs.readFileSync(file, 'utf8');
  const key = /^AGE-SECRET-KEY-1[0-9A-Z]+$/m.exec(text)?.[0] ?? '';
  return JSON.stringify(key ? hideKey(key) : null);
}

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
  define: {
    __AUTOSLIDES_IK__: indexClientKey(),
  },
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
      external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'sharp']
    }
  }
}));
