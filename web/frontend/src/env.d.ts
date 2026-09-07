/// <reference types="vite/client" />

/**
 * True only in the demo build (`vite.demo.config.ts` defines it; the normal
 * build defines it as `false`). Because it is a compile-time constant, every
 * `if (__DEMO__)` branch and the modules it reaches are dropped from the
 * production bundle entirely.
 */
declare const __DEMO__: boolean;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
