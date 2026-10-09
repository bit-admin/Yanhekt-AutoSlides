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

// A command line run owns the terminal: its own progress and messages are the
// output, so service logs stay off the console unless `--verbose` asks for them.
let consoleMode: 'default' | 'silent' | 'all' = 'default';
export function setLoggerConsoleMode(mode: 'default' | 'silent' | 'all'): void {
  consoleMode = mode;
}

export function createLogger(namespace: string): Logger {
  const tag = `[${namespace}]`;
  // Everything goes to stderr in a command line run, so stdout stays parseable.
  const toStderr = (...args: unknown[]) => c.error(tag, ...args);
  const routine = (print: LogFn): LogFn => (...args) => {
    if (consoleMode === 'all') toStderr(...args);
    else if (consoleMode === 'default' && DEV) print(...args);
  };
  const always = (print: LogFn): LogFn => (...args) => {
    if (consoleMode === 'all') toStderr(...args);
    else if (consoleMode === 'default') print(...args);
  };
  const debugConsole = routine((...args) => c.debug(tag, ...args));
  const infoConsole = routine((...args) => c.log(tag, ...args));
  const warnConsole = always((...args) => c.warn(tag, ...args));
  const errorConsole = always((...args) => c.error(tag, ...args));
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
      warnConsole(...args);
      writeLogArgs('warn', 'main', namespace, args);
    },
    error: (...args) => {
      errorConsole(...args);
      writeLogArgs('error', 'main', namespace, args);
    },
  };
}
