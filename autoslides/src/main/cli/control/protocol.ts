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

/** A request line longer than this is not one of ours. */
export const MAX_REQUEST_BYTES = 1024 * 1024;

export const encodeLine = (value: unknown): string => `${JSON.stringify(value)}\n`;

/** Feed socket chunks in; get whole lines out. */
export function createLineReader(onLine: (line: string) => void): (chunk: Buffer | string) => number {
  let buffered = '';
  return (chunk) => {
    buffered += chunk.toString();
    let newline = buffered.indexOf('\n');
    while (newline !== -1) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim()) onLine(line);
      newline = buffered.indexOf('\n');
    }
    return buffered.length;
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
