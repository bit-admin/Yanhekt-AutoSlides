/**
 * Entry point of the demo build (`vite.demo.config.ts` resolves index.html's
 * "/src/main.ts" to this file instead).
 *
 * It exists so `installDemo()` can finish before the real entry module is even
 * evaluated: `main.ts` statically imports the stores, and ES modules evaluate
 * their imports first, so a guarded `if (__DEMO__)` inside `main.ts` would run
 * after `authStore` had already read the real `localStorage`.
 */

import { installDemo } from "./bootstrap";

await installDemo();
await import("../main");
