import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

function ortWasmDevServer(): Plugin {
  const sourceDir = path.resolve(
    __dirname,
    'node_modules/onnxruntime-web/dist'
  );
  const whitelist = new Set([
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs'
  ]);
  return {
    name: 'serve-ort-wasm-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = req.url.split('?')[0];
        if (!pathname.startsWith('/ort-wasm/')) return next();
        const filename = pathname.substring('/ort-wasm/'.length);
        if (!whitelist.has(filename)) return next();
        const filepath = path.join(sourceDir, filename);
        if (!fs.existsSync(filepath)) return next();
        const ext = path.extname(filename);
        const mime =
          ext === '.mjs' ? 'application/javascript' :
          ext === '.wasm' ? 'application/wasm' :
          'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-cache');
        const stream = fs.createReadStream(filepath);
        stream.on('error', () => {
          try { res.end(); } catch { /* noop */ }
        });
        res.on('close', () => stream.destroy());
        stream.pipe(res);
      });
    }
  };
}

function ortWasmBuildCopy(): Plugin {
  const sourceDir = path.resolve(
    __dirname,
    'node_modules/onnxruntime-web/dist'
  );
  const files = [
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs'
  ];
  return {
    name: 'copy-ort-wasm-build',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist');
      const destDir = path.join(outDir, 'ort-wasm');
      fs.mkdirSync(destDir, { recursive: true });
      for (const f of files) {
        const src = path.join(sourceDir, f);
        const dst = path.join(destDir, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  };
}

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  // Keep each Electron renderer dev server on its own dependency cache.
  // Sharing node_modules/.vite across concurrently started renderer configs can
  // trigger cold-start re-optimization while the main window is loading.
  cacheDir: 'node_modules/.vite-main',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat webview as a custom element (Electron's webview tag)
          isCustomElement: (tag) => tag === 'webview'
        }
      }
    }),
    ortWasmDevServer(),
    ortWasmBuildCopy()
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web']
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
}));
