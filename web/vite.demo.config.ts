import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { featureFlags, manualChunks } from "./vite.shared";

const DEMO_ENTRY = fileURLToPath(new URL("./frontend/src/demo/main.ts", import.meta.url));
const OPENCV_STUB = fileURLToPath(
  new URL("./frontend/src/demo/opencvStub.ts", import.meta.url),
);
const HLS_STUB = fileURLToPath(new URL("./frontend/src/demo/hlsStub.ts", import.meta.url));

// The demo build: the same Vue app, wired to fabricated data, published as a
// plain static bundle under /demo/ so anyone can click through the interface
// with no account, no campus network, and no Yanhekt traffic. It is also what
// scripts/screenshots.mjs drives to produce the README images.
//
// Two differences from the production build, and only two:
//
//  * `__DEMO__` is true, which switches the router to hash routes and lets the
//    player fall back to a poster (see frontend/src/lib/demoRegistry.ts).
//  * index.html's entry resolves to frontend/src/demo/main.ts instead of
//    main.ts, so the demo can isolate storage and install its fetch stub
//    BEFORE the app's stores are evaluated — they read localStorage at import
//    time, so a guarded branch inside main.ts would already be too late.
//
// Output goes to dist/demo, so `npm run build` must run this AFTER the main
// build, which empties dist/.
export default defineConfig({
  root: "frontend",
  base: "/demo/",
  define: { __DEMO__: "true", ...featureFlags },
  plugins: [
    vue(),
    {
      // Dev: rewrite the entry in the HTML itself, so the browser asks for
      // /src/demo/main.ts. It has to be the HTML here rather than a resolver —
      // dev module ids are URLs, so redirecting /src/main.ts would also
      // redirect the demo entry's own import of the real app, and the two
      // would be the same module (the app would never boot).
      name: "autoslides-demo-entry:serve",
      apply: "serve",
      transformIndexHtml(html: string) {
        return html.replace("/src/main.ts", "/src/demo/main.ts");
      },
    },
    {
      // Drop the copy of public/fonts/ that Vite mirrors into dist/demo.
      //
      // These are the self-hosted faces for the notes editor and PDF export —
      // 32 MB, most of it SimSun and SimHei, and more than everything else in
      // the build combined. The demo cannot use its own copy anyway:
      // notesFontSets.ts names them by root-absolute URL ("/fonts/SimHei.ttf"),
      // which are runtime strings Vite does not rewrite for `base`, so a demo
      // page fetches them from the root deploy regardless. Keeping them here
      // would duplicate 32 MB into every deploy for files nothing requests.
      //
      // The rest of public/ stays: index.html's icon links DO get rewritten to
      // /demo/*, so those copies are the ones actually served.
      name: "autoslides-demo-drop-fonts",
      apply: "build",
      closeBundle() {
        rmSync(fileURLToPath(new URL("./dist/demo/fonts", import.meta.url)), {
          recursive: true,
          force: true,
        });
      },
    },
    {
      // Build: transformIndexHtml runs after bundling, too late to change what
      // is bundled — so swap the entry as it resolves. Only the HTML entry
      // matches: index.html asks for the root-absolute "/src/main.ts" while
      // the demo entry asks for the relative "../main", and build module ids
      // are file paths, so the two stay distinct.
      name: "autoslides-demo-entry:build",
      apply: "build",
      enforce: "pre",
      resolveId(source: string) {
        return source === "/src/main.ts" ? DEMO_ENTRY : null;
      },
    },
  ],
  // Swap the two engines the demo cannot use for stubs. Both are dead code
  // here — the demo seeds ready-made slides instead of running the extractor,
  // and routes playback through demoHooks.playback instead of hls.js — but
  // Rollup cannot prove it, so together they would be 11.5 MB of the build.
  // Aliasing keeps this a demo-build concern: no branch in the worker, no
  // extra seam in production. See frontend/src/demo/{opencvStub,hlsStub}.ts.
  resolve: {
    alias: {
      "@techstark/opencv-js": OPENCV_STUB,
      "hls.js": HLS_STUB,
    },
  },
  build: {
    outDir: "../dist/demo",
    emptyOutDir: true,
    // Top-level await in the demo entry (installDemo runs before the app is
    // imported) needs a modern target.
    target: "es2022",
    rollupOptions: { output: { manualChunks } },
  },
});
