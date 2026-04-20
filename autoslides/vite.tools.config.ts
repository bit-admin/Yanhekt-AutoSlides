import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

// Serve onnxruntime-web WASM/MJS files at /ort-wasm/* in dev, bypassing Vite's
// module-transform pipeline (which otherwise intercepts .mjs requests with
// ?import and fails to resolve them as modules).
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

// Copy onnxruntime-web WASM/MJS files flat into <outDir>/ort-wasm/<filename>.
// viteStaticCopy's `rename` didn't strip the source directory structure in
// practice (files ended up nested under ort-wasm/node_modules/...), so we
// copy them manually in writeBundle.
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

// Vite config for unified Tools window
export default defineConfig(({ mode }) => ({
  // Give this window its own deps cache so it doesn't collide with the main
  // renderer's cache (they share node_modules/.vite/deps/ by default, and
  // differing optimizeDeps config causes re-optimize loops).
  cacheDir: 'node_modules/.vite-tools',
  plugins: [
    vue(),
    ortWasmDevServer(),
    ortWasmBuildCopy()
  ],
  optimizeDeps: {
    // Exclude onnxruntime-web so Vite doesn't try to pre-bundle it (its WASM
    // loader uses dynamic imports with runtime paths that esbuild can't
    // resolve). Served as-is from node_modules via the custom middleware
    // above for the WASM/MJS backend files.
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
      input: path.resolve(__dirname, 'tools.html'),
      external: ['electron'],
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/onnxruntime-web')) {
            return 'onnxruntime-web';
          }
          if (id.includes('node_modules/@techstark/opencv-js')) {
            return 'opencv-js';
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: 5174 // Port for tools window dev server
  }
}));
