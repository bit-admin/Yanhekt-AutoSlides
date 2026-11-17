// The wire format between an `autoslides` process and the running app.
//
// One connection carries one command. The client writes a single request line;
// the app answers with any number of message lines and ends with exactly one
// `result`, then closes. Lines are JSON, newline-terminated. Pure.
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { CliErrorCode } from '../errors';

export const PROTOCOL_VERSION = 1;

export interface ControlRequest {
  v: typeof PROTOCOL_VERSION;
  command: string;
  program: string;
  positionals: string[];
  options: Record<string, string | true>;
  json: boolean;
  /** Whether the client's stderr is a terminal, so progress lines are worth sending. */
  tty: boolean;
}

export interface SerializedCliError {
  code: CliErrorCode;
  message: string;
  hint?: string;
}

/** What the app sends back: what the terminal shows while it runs, then the answer. */
export type ControlMessage =
  | { type: 'info'; text: string }
  | { type: 'status'; text: string }
  | { type: 'end-status' }
  | { type: 'out'; text: string }
  | {
      type: 'result';
      data?: unknown;
      text?: string;
      hints?: string[];
      error?: SerializedCliError;
    };

/** A request line longer than this (in bytes, without its newline) is not one of ours. */
export const MAX_REQUEST_BYTES = 1024 * 1024;

export const encodeLine = (value: unknown): string => `${JSON.stringify(value)}\n`;

export interface LineReaderOptions {
  /** The longest line taken, in bytes without its newline. No limit when absent. */
  maxLineBytes?: number;
  /** A line passed the limit. It was not handed over, and nothing after it is read. */
  onOverflow?: () => void;
}

const NEWLINE = 0x0a;

/**
 * Feed socket chunks in; get whole lines out. Returns the bytes held for an
 * unfinished line.
 *
 * Lines are cut on the raw bytes and decoded whole: a socket splits chunks
 * anywhere, including inside a character, and a newline byte never occurs
 * inside a UTF-8 sequence. An unfinished line is never handed over, so half a
 * character left when the connection ends goes nowhere.
 */
export function createLineReader(
  onLine: (line: string) => void,
  options: LineReaderOptions = {},
): (chunk: Buffer | string) => number {
  const max = options.maxLineBytes ?? Infinity;
  let held: Buffer[] = [];
  let heldBytes = 0;
  let overflowed = false;

  const overflow = (): number => {
    overflowed = true;
    held = [];
    heldBytes = 0;
    options.onOverflow?.();
    return 0;
  };

  return (chunk) => {
    if (overflowed) return 0;
    let rest = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    for (let newline = rest.indexOf(NEWLINE); newline !== -1; newline = rest.indexOf(NEWLINE)) {
      // Checked before the line is handed over: the caller must never run an oversized one.
      if (heldBytes + newline > max) return overflow();
      const line = Buffer.concat([...held, rest.subarray(0, newline)]).toString('utf8');
      held = [];
      heldBytes = 0;
      rest = rest.subarray(newline + 1);
      if (line.trim()) onLine(line);
    }
    if (rest.length > 0) {
      held.push(rest);
      heldBytes += rest.length;
    }
    if (heldBytes > max) return overflow();
    return heldBytes;
  };
}

export function parseRequest(line: string): ControlRequest | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<ControlRequest>;
  if (r.v !== PROTOCOL_VERSION || typeof r.command !== 'string' || typeof r.program !== 'string') return null;
  if (!Array.isArray(r.positionals) || !r.positionals.every((p) => typeof p === 'string')) return null;
  if (!r.options || typeof r.options !== 'object') return null;
  const options: Record<string, string | true> = {};
  for (const [key, v] of Object.entries(r.options)) {
    if (typeof v !== 'string' && v !== true) return null;
    options[key] = v;
  }
  return {
    v: PROTOCOL_VERSION,
    command: r.command,
    program: r.program,
    positionals: r.positionals,
    options,
    json: r.json === true,
    tty: r.tty === true,
  };
}

// macOS caps a Unix socket path at 104 bytes (sun_path), Linux at 108.
const MAX_SOCKET_PATH = 100;

export interface SocketPathOptions {
  /**
   * A dev build: it shares the installed app's user data folder, so it gets a
   * socket of its own instead of taking over the installed app's.
   */
  dev?: boolean;
  platform?: NodeJS.Platform;
  tmpdir?: string;
}

/**
 * Where the app listens: a Unix socket in its user data folder (only this user
 * can reach it), or a named pipe on Windows. Keyed by the user data folder, so
 * demo mode gets its own.
 */
export function controlSocketPath(userData: string, options: SocketPathOptions = {}): string {
  const { dev = false, platform = process.platform, tmpdir = os.tmpdir() } = options;
  const name = dev ? 'cli-dev' : 'cli';
  const key = crypto.createHash('sha256').update(userData).digest('hex').slice(0, 16);
  if (platform === 'win32') return `\\\\.\\pipe\\autoslides-${name}-${key}`;
  const inUserData = path.join(userData, `${name}.sock`);
  return inUserData.length <= MAX_SOCKET_PATH ? inUserData : path.join(tmpdir, `autoslides-${name}-${key}.sock`);
}
