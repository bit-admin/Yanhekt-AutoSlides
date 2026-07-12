/**
 * Tiny namespaced, leveled logger for the frontend (and worker bundles).
 * Ported from autoslides/src/renderer/shared/utils/logger.ts (unchanged).
 *
 * `debug`/`info` are dev-only: they compile to no-ops outside the Vite dev
 * server, so a production build stays quiet for routine output. `warn`/`error`
 * always emit, so real failures still surface in the browser console.
 *
 * Usage:
 *   const log = createLogger('SlideExtraction')
 *   log.debug('frame', i)       // dev only
 *   log.error('failed', err)    // always
 */

const c = console;

type LogFn = (...args: unknown[]) => void;

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const DEV = import.meta.env.DEV;
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
