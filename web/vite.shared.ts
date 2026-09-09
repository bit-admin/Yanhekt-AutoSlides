/**
 * Build settings shared by the production and demo configs, so the two builds
 * can never disagree about what is compiled in or how it is chunked.
 */

/**
 * Build-time feature flags.
 *
 * These are constants at build time, so Rollup drops the guarded branches
 * outright. This is the only kind of "tree shaking" that reaches inside Vue
 * and vue-i18n: their runtimes ship every feature and gate it on these
 * globals, so an unset flag means the dead code stays in the bundle.
 *
 * Each one below is a claim about this app. Re-check the claim before
 * flipping a flag, and leave a flag alone rather than guess.
 */
export const featureFlags = {
  /**
   * Options API. Vite defaults this to TRUE, which keeps the whole Options
   * API resolution path in @vue/runtime-core. Every component here is
   * `<script setup>` except NoCoursesEmpty.vue, which is template-only — so
   * nothing needs it. Flip back to true the moment a component uses
   * `data()` / `methods:` / `mixins:`, or it will fail at runtime.
   */
  __VUE_OPTIONS_API__: false,

  /** Vue devtools plumbing in production. Already Vue's default; explicit
   *  so the intent survives a Vite upgrade that changes the default. */
  __VUE_PROD_DEVTOOLS__: false,

  /** SSR hydration mismatch diagnostics. This is a pure SPA — no hydration. */
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,

  /**
   * vue-i18n's legacy (Options API) mode — the `$t`-on-`this` Composer
   * wrapper. i18n/index.ts creates the instance with `legacy: false`, so the
   * whole legacy surface is unreachable.
   */
  __VUE_I18N_LEGACY_API__: false,

  /** intlify devtools hooks in production. */
  __INTLIFY_PROD_DEVTOOLS__: false,

  // Deliberately NOT set:
  //
  //   __VUE_I18N_FULL_INSTALL__ — must stay on. It registers the <i18n-t>
  //     component, which SettingsPage.vue and FirstRunNotice.vue both use for
  //     interpolated translations.
  //
  //   __INTLIFY_DROP_MESSAGE_COMPILER__ — would drop ~16 kB, but only works
  //     with messages precompiled to functions at build time. Ours are plain
  //     JSON compiled on first use, so dropping the compiler breaks every
  //     string. It needs @intlify/unplugin-vue-i18n first.
} as const;

/**
 * Split the framework out of the entry chunk.
 *
 * Vue + vue-router + vue-i18n are ~178 kB raw and change only when a
 * dependency is upgraded, while the app code around them changes every
 * deploy. Sharing one chunk means a one-line app fix invalidates all of it
 * for every returning visitor. Splitting costs one extra request on a cold
 * load (same origin, already-open connection) and saves the framework
 * re-download on every warm one.
 *
 * Route chunks are left alone — Rollup's own splitting already handles those,
 * and hand-assigning them would defeat the shared-chunk hoisting that puts
 * Editor.js in one place for both NotesPage and the player's notes panel.
 */
export function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  return /[\\/]node_modules[\\/](vue|vue-router|vue-i18n|@vue[\\/]|@intlify[\\/])/.test(id)
    ? "framework"
    : undefined;
}
