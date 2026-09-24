/**
 * Tiny namespaced, leveled logger for the renderer (and worker bundles).
 *
 * Console: `debug`/`info` are dev-only (no-ops outside the Vite dev server), so
 * a packaged build stays quiet for routine output; `warn`/`error` always emit.
 *
 * Log file: every line is also forwarded to the main process's log file —
 * `warn`/`error` always, `debug`/`info` only while Developer mode is on
 * (`setLogVerbose`, driven from the entry points). Arguments are formatted to a
 * string HERE, so nothing structured-clones across IPC (Recurring #1). Worker
 * bundles have no `window.electronAPI` and stay console-only.
 *
 * Usage:
 *   const log = createLogger('TaskQueue')
 *   log.debug('frame', i)       // dev only
 *   log.error('failed', err)    // always
 */

import { formatLogArgs, type LogLevel, type LogSource } from '@common/logFormat';

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

let verbose = false;
let source: LogSource = 'renderer';

/** Forward debug/info to the log file too (Developer mode). */
export function setLogVerbose(enabled: boolean): void {
  verbose = enabled;
}

/** Which window's lines these are (`tools` for the Tools window). */
export function setLogSource(next: LogSource): void {
  source = next;
}

type LogWriter = (level: LogLevel, source: LogSource, namespace: string, message: string) => void;

function fileWriter(): LogWriter | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as { electronAPI?: { log?: { write?: LogWriter } } }).electronAPI?.log?.write;
}

/** Send one line to the log file. Never throws — logging must not break callers. */
export function forwardToLogFile(level: LogLevel, namespace: string, args: readonly unknown[]): void {
  if (!verbose && (level === 'debug' || level === 'info')) return;
  const write = fileWriter();
  if (!write) return;
  try {
    write(level, source, namespace, formatLogArgs(args));
  } catch {
    // IPC unavailable (window tearing down) — console already has the line.
  }
}

export function createLogger(namespace: string): Logger {
  const tag = `[${namespace}]`;
  const debugConsole = DEV ? (...args: unknown[]) => c.debug(tag, ...args) : noop;
  const infoConsole = DEV ? (...args: unknown[]) => c.log(tag, ...args) : noop;
  return {
    debug: (...args) => {
      debugConsole(...args);
      forwardToLogFile('debug', namespace, args);
    },
    info: (...args) => {
      infoConsole(...args);
      forwardToLogFile('info', namespace, args);
    },
    warn: (...args) => {
      c.warn(tag, ...args);
      forwardToLogFile('warn', namespace, args);
    },
    error: (...args) => {
      c.error(tag, ...args);
      forwardToLogFile('error', namespace, args);
    },
  };
}
