import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

// Runtime files the workers load by URL instead of bundling: served by the dev
// server and copied beside assets/ at build time, under the same /<dir>/ path.
interface VendorFiles {
  /** URL path segment and output folder, e.g. `ort-wasm`. */
  dir: string;
  sourceDir: string;
  files: string[];
}

const VENDOR_FILES: VendorFiles[] = [
  // onnxruntime-web's plain CPU build (the workers import `onnxruntime-web/wasm`
  // and set `ort.env.wasm.wasmPaths` here). The .mjs glue must match the .wasm:
  // change both together with the import.
  {
    dir: 'ort-wasm',
    sourceDir: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist'),
    files: ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']
  },
  // OpenCV.js (wasm inlined as base64), one copy shared by the autoCrop and
  // slideClassifier workers through shared/workers/opencvLoader.ts.
  {
    dir: 'opencv',
    sourceDir: path.resolve(__dirname, 'node_modules/@techstark/opencv-js/dist'),
    files: ['opencv.js']
  }
];

function vendorFilesDevServer(): Plugin {
  return {
    name: 'serve-vendor-files-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = req.url.split('?')[0];
        const group = VENDOR_FILES.find((g) => pathname.startsWith(`/${g.dir}/`));
        if (!group) return next();
        const filename = pathname.substring(group.dir.length + 2);
        if (!group.files.includes(filename)) return next();
        const filepath = path.join(group.sourceDir, filename);
        if (!fs.existsSync(filepath)) return next();
        const ext = path.extname(filename);
        const mime =
          ext === '.mjs' || ext === '.js' ? 'application/javascript' :
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

function vendorFilesBuildCopy(): Plugin {
  return {
    name: 'copy-vendor-files-build',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist');
      for (const group of VENDOR_FILES) {
        const destDir = path.join(outDir, group.dir);
        fs.mkdirSync(destDir, { recursive: true });
        for (const f of group.files) {
          const src = path.join(group.sourceDir, f);
          // A missing file would only fail at runtime inside a worker; fail the build.
          if (!fs.existsSync(src)) throw new Error(`vendor file missing: ${src}`);
          fs.copyFileSync(src, path.join(destDir, f));
        }
      }
    }
  };
}

// The slideClassifier/autoCrop workers import onnxruntime-web, whose loader
// references the wasm via `new URL(..., import.meta.url)`, so Rollup emits a
// ~13 MB copy of ort-wasm-simd-threaded.wasm into assets/. That copy is dead
// weight: at runtime the workers set `ort.env.wasm.wasmPaths` to the ort-wasm/
// directory populated by vendorFilesBuildCopy, so the assets/ copy is never fetched.
// Drop it so the blob ships once per renderer instead of twice.
function dropBundledOrtWasm(): Plugin {
  return {
    name: 'drop-bundled-ort-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(fileName)) {
          delete bundle[fileName];
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
    vendorFilesDevServer(),
    vendorFilesBuildCopy(),
    dropBundledOrtWasm()
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
