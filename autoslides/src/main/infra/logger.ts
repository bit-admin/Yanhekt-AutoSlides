/**
 * Tiny namespaced, leveled logger for the main process.
 *
 * `debug`/`info` are dev-only (gated on `!app.isPackaged`), so a packaged build
 * stays quiet for routine output. `warn`/`error` always emit, so real failures
 * still surface when a packaged build is launched from a terminal.
 *
 * Usage:
 *   const log = createLogger('VideoProxy')
 *   log.debug('client registered', id)  // dev only
 *   log.error('request failed', err)    // always
 */

import { app } from 'electron';

const c = console;

type LogFn = (...args: unknown[]) => void;

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const DEV = !app.isPackaged;
const noop: LogFn = () => {};

export function createLogger(namespace: string): Logger {
  const tag = `[${namespace}]`;
  return {
    debug: DEV ? (...args) => c.debug(tag, ...args) : noop,
    info: DEV ? (...args) => c.log(tag, ...args) : noop,
    warn: (...args) => c.warn(tag, ...args),
    error: (...args) => c.error(tag, ...args),
  };
}
