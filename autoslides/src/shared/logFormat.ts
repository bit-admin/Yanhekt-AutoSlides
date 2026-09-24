/**
 * Serialization + redaction for the persistent log file.
 *
 * Shared by the main-process file writer and the renderer logger so both sides
 * turn arguments into text the same way. The renderer formats BEFORE crossing
 * IPC: only strings are sent, so a Vue Proxy in a log argument can never throw
 * a DataCloneError (Recurring #1).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** Where a line came from. The renderer entry points pick theirs. */
export type LogSource = 'main' | 'renderer' | 'tools';

export const LOG_SOURCES: readonly LogSource[] = ['main', 'renderer', 'tools'];

/** Per-argument cap, so one huge payload cannot flood the file. */
export const MAX_ARG_CHARS = 4096;

/** Cap on a whole forwarded renderer message (checked again in main). */
export const MAX_MESSAGE_CHARS = 16384;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…[+${text.length - max} chars]` : text;
}

function formatError(err: Error): string {
  const stack = err.stack && err.stack.includes(err.message) ? err.stack : `${err.name}: ${err.message}\n${err.stack ?? ''}`;
  const cause = (err as { cause?: unknown }).cause;
  return cause !== undefined ? `${stack}\nCaused by: ${formatLogArg(cause)}` : stack;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'bigint') return `${v}n`;
    if (v instanceof Error) return formatError(v);
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    return v;
  }) ?? String(value);
}

export function formatLogArg(arg: unknown): string {
  if (typeof arg === 'string') return truncate(arg, MAX_ARG_CHARS);
  if (arg instanceof Error) return truncate(formatError(arg), MAX_ARG_CHARS);
  if (arg === undefined || arg === null || typeof arg !== 'object') {
    return String(arg);
  }
  try {
    return truncate(safeStringify(arg), MAX_ARG_CHARS);
  } catch {
    return Object.prototype.toString.call(arg);
  }
}

export function formatLogArgs(args: readonly unknown[]): string {
  return args.map(formatLogArg).join(' ');
}

// Login tokens, `t=` params, Bearer values and path hashes are all 32 hex.
// Keep the last four so two tokens in one log can still be told apart.
const HEX32 = /\b[0-9a-f]{32}\b/gi;
const HEADER_SECRET = /\b(authorization|xvideo[_-]token|cookie|set-cookie)(["']?\s*[:=]\s*["']?)(?!Bearer\s)([^"',;\s}]+)/gi;
const BEARER = /\b(Bearer\s+)([^\s"',;}]+)/gi;
const PASSWORD = /\b(password|passwd|pwd)(["']?\s*[:=]\s*["']?)([^"'&,;\s}]+)/gi;

function mask(secret: string): string {
  return secret.length > 4 ? `****${secret.slice(-4)}` : '****';
}

/** Mask credentials before a line reaches disk (logs get pasted into issues). */
export function redactLogText(text: string): string {
  return text
    .replace(BEARER, (_m, pre: string, secret: string) => `${pre}${mask(secret)}`)
    .replace(HEADER_SECRET, (_m, name: string, sep: string, secret: string) => `${name}${sep}${mask(secret)}`)
    .replace(PASSWORD, (_m, name: string, sep: string) => `${name}${sep}****`)
    .replace(HEX32, (m) => mask(m));
}
