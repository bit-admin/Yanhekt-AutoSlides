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

export function installLogCapture(
  app: App,
  source: LogSource,
  developerMode: () => boolean | undefined
): void {
  setLogSource(source);
  watch(developerMode, (enabled) => setLogVerbose(enabled === true), { immediate: true });

  const log = createLogger('Uncaught');

  window.addEventListener('error', (event) => {
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
