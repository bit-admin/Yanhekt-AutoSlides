import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

const DEMO_ENTRY = fileURLToPath(new URL("./frontend/src/demo/main.ts", import.meta.url));

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
  define: { __DEMO__: "true" },
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
  build: {
    outDir: "../dist/demo",
    emptyOutDir: true,
    // Top-level await in the demo entry (installDemo runs before the app is
    // imported) needs a modern target.
    target: "es2022",
  },
});
