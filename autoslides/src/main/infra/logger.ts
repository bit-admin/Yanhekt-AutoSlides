/**
 * Tiny namespaced, leveled logger for the main process.
 *
 * Console: `debug`/`info` are dev-only (gated on `!app.isPackaged`), so a
 * packaged build stays quiet for routine output; `warn`/`error` always emit.
 *
 * Log file (`logFile.ts`): `warn`/`error` are always written; `debug`/`info`
 * only while Developer mode is on — in packaged builds too.
 *
 * Usage:
 *   const log = createLogger('VideoProxy')
 *   log.debug('client registered', id)  // dev only
 *   log.error('request failed', err)    // always
 */

import { app } from 'electron';
import { writeLogArgs } from './logFile';

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
  const debugConsole = DEV ? (...args: unknown[]) => c.debug(tag, ...args) : noop;
  const infoConsole = DEV ? (...args: unknown[]) => c.log(tag, ...args) : noop;
  return {
    debug: (...args) => {
      debugConsole(...args);
      writeLogArgs('debug', 'main', namespace, args);
    },
    info: (...args) => {
      infoConsole(...args);
      writeLogArgs('info', 'main', namespace, args);
    },
    warn: (...args) => {
      c.warn(tag, ...args);
      writeLogArgs('warn', 'main', namespace, args);
    },
    error: (...args) => {
      c.error(tag, ...args);
      writeLogArgs('error', 'main', namespace, args);
    },
  };
}
