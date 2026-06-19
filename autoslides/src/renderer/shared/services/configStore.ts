// Reactive mirror of the main-process AppConfig. Loaded once at startup via
// `loadConfig()` (await before app.mount) and kept in sync with main via the
// `config:onUpdate` broadcast that fires after every setter handler.
//
// Read access is synchronous: `configStore.slideExtraction?.pHashThreshold`
// instead of `await window.electronAPI.config.get()`. Writes still go through
// the typed setters in `window.electronAPI.config.*` — the broadcast keeps
// the store fresh.
//
// Race-window caveat: a consumer that reads the store immediately after
// calling a setter may see the pre-write value until the broadcast lands
// (next event-loop tick). For tight read-after-write inside settings
// composables, prefer the setter's awaited return value.

import { reactive } from 'vue';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ConfigStore');

// AppConfig is declared in src/vite-env.d.ts as a module-local interface, so
// we extract its shape from the IPC return type. The reactive store mirrors
// AppConfig one-to-one. We cast through `unknown` because the initial render
// sees an empty object before `loadConfig()` resolves — by the time any
// composable runs (after `app.mount`) the store is populated, so consumers
// can treat it as a full AppConfig.
type AppConfigShape = Awaited<ReturnType<Window['electronAPI']['config']['get']>>;
export const configStore = reactive({} as unknown as AppConfigShape);

let loadPromise: Promise<void> | null = null;

export function loadConfig(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const full = await window.electronAPI.config.get();
      Object.assign(configStore, full);
    } catch (err) {
      log.error('[configStore] initial load failed', err);
    }
    try {
      window.electronAPI.config.onUpdate((cfg) => {
        Object.assign(configStore, cfg);
      });
    } catch (err) {
      log.warn('[configStore] onUpdate subscription failed', err);
    }
  })();
  return loadPromise;
}

// Force a fresh read from main. Use sparingly — the broadcast keeps the
// store current under normal operation.
export async function refreshConfig(): Promise<void> {
  try {
    const full = await window.electronAPI.config.get();
    Object.assign(configStore, full);
  } catch (err) {
    log.error('[configStore] refresh failed', err);
  }
}
