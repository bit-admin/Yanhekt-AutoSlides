/**
 * Route a window's otherwise-invisible failures into the log file: uncaught
 * errors, unhandled rejections and Vue render/lifecycle errors never went
 * through `createLogger`, so a packaged build lost them entirely.
 *
 * Called once per entry point (main window, Tools window).
 */

import { watch, type App } from 'vue';
import type { LogSource } from '@common/logFormat';
import { createLogger, setLogSource, setLogVerbose } from './logger';

/**
 * Chromium raises this as a window `error` (no `error` object, no location)
 * when a ResizeObserver callback changes layout and the follow-up
 * notifications slip to the next frame. It is a spec-mandated warning, not a
 * failure — the observers still fire — so logging it only adds noise.
 */
function isBenignResizeObserverError(event: ErrorEvent): boolean {
  return !event.error && /^ResizeObserver loop/.test(event.message);
}

export function installLogCapture(
  app: App,
  source: LogSource,
  developerMode: () => boolean | undefined
): void {
  setLogSource(source);
  watch(developerMode, (enabled) => setLogVerbose(enabled === true), { immediate: true });

  const log = createLogger('Uncaught');

  window.addEventListener('error', (event) => {
    if (isBenignResizeObserverError(event)) return;
    log.error(event.error ?? event.message, `at ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection:', event.reason);
  });

  // Setting errorHandler stops Vue's default console output, so keep it.
  app.config.errorHandler = (err, _instance, info) => {
    log.error(`Vue error (${info}):`, err);
  };
}
