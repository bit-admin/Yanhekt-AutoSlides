/**
 * Persistent log file: `<userData>/logs/autoslides.log`, the single writer for
 * both processes (renderer lines arrive over `log:write`).
 *
 * warn/error are always written, so a failure that already happened is on disk
 * when the user goes looking. debug/info are written only while verbose is on
 * (Developer mode). Every line is redacted before it reaches disk.
 *
 * Packaged Windows builds have no console, so without this file every
 * `log.error` from a Start-menu launch was simply lost.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  formatLogArgs,
  redactLogText,
  type LogLevel,
  type LogSource,
} from '@common/logFormat';

export const LOG_FILE_NAME = 'autoslides.log';
export const MAX_LOG_BYTES = 5 * 1024 * 1024;
export const MAX_ROTATED_FILES = 3;
const PRE_INIT_BUFFER_LINES = 200;

let logDir: string | null = null;
let stream: fs.WriteStream | null = null;
let bytesWritten = 0;
let verbose = false;
let broken = false;
// Lines logged by modules that load before `initLogFile` runs.
let preInitBuffer: string[] = [];

/** `autoslides.log` → `autoslides.1.log` … `autoslides.<n>.log`. */
export function rotatedLogName(index: number): string {
  if (index === 0) return LOG_FILE_NAME;
  const ext = path.extname(LOG_FILE_NAME);
  return `${path.basename(LOG_FILE_NAME, ext)}.${index}${ext}`;
}

/** Whether a level reaches the file at the current verbosity. */
export function shouldWriteLevel(level: LogLevel, isVerbose: boolean): boolean {
  return isVerbose || level === 'warn' || level === 'error';
}

export function formatLogLine(
  level: LogLevel,
  source: LogSource,
  namespace: string,
  message: string,
  now: Date = new Date()
): string {
  const text = redactLogText(message).replace(/\r?\n/g, '\n    ');
  return `${now.toISOString()} ${level.toUpperCase().padEnd(5)} [${source}] [${namespace}] ${text}\n`;
}

/** Shift `autoslides.log` down the chain, dropping the oldest. */
export function rotateLogFiles(dir: string): void {
  const oldest = path.join(dir, rotatedLogName(MAX_ROTATED_FILES));
  fs.rmSync(oldest, { force: true });
  for (let i = MAX_ROTATED_FILES - 1; i >= 0; i--) {
    const from = path.join(dir, rotatedLogName(i));
    if (fs.existsSync(from)) {
      fs.renameSync(from, path.join(dir, rotatedLogName(i + 1)));
    }
  }
}

function openStream(): void {
  if (!logDir) return;
  const file = path.join(logDir, LOG_FILE_NAME);
  try {
    bytesWritten = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (bytesWritten >= MAX_LOG_BYTES) {
      rotateLogFiles(logDir);
      bytesWritten = 0;
    }
    stream = fs.createWriteStream(file, { flags: 'a' });
    stream.on('error', () => {
      // A full or read-only disk must never take the app down; stop writing.
      broken = true;
      stream = null;
    });
  } catch {
    broken = true;
    stream = null;
  }
}

function append(line: string): void {
  if (broken) return;
  if (!stream) {
    if (logDir) return;
    if (preInitBuffer.length < PRE_INIT_BUFFER_LINES) preInitBuffer.push(line);
    return;
  }
  const size = Buffer.byteLength(line);
  if (bytesWritten + size > MAX_LOG_BYTES && bytesWritten > 0) {
    stream.end();
    stream = null;
    try {
      rotateLogFiles(logDir as string);
    } catch {
      // Rotation failed (file locked on Windows): keep appending to the same file.
    }
    openStream();
    if (!stream) return;
  }
  stream.write(line);
  bytesWritten += size;
}

/**
 * Open the log file and write the session header. Call once, after the demo
 * userData swap, so demo runs log under `AutoSlides-Demo/logs`.
 */
export function initLogFile(dir: string, header: Record<string, string | boolean>): void {
  if (logDir) return;
  logDir = dir;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    broken = true;
    return;
  }
  openStream();
  const fields = Object.entries(header).map(([k, v]) => `${k}=${v}`).join(' ');
  append(`\n${new Date().toISOString()} ===== session start ${fields} =====\n`);
  for (const line of preInitBuffer) append(line);
  preInitBuffer = [];
}

export function setLogVerbose(enabled: boolean): void {
  verbose = enabled;
}

export function isLogVerbose(): boolean {
  return verbose;
}

export function getLogDir(): string | null {
  return logDir;
}

/** Write a line from main-process arguments. */
export function writeLogArgs(level: LogLevel, source: LogSource, namespace: string, args: readonly unknown[]): void {
  if (!shouldWriteLevel(level, verbose)) return;
  append(formatLogLine(level, source, namespace, formatLogArgs(args)));
}

/** Write a line whose message was already formatted (renderer forwarding). */
export function writeLogMessage(level: LogLevel, source: LogSource, namespace: string, message: string): void {
  if (!shouldWriteLevel(level, verbose)) return;
  append(formatLogLine(level, source, namespace, message));
}

/**
 * Delete every log file (Settings → Clear Cache). The stream is closed first —
 * Windows cannot delete an open file — then reopened fresh, so logging carries
 * on. Lines logged during the few ms the stream is closed are dropped.
 */
export async function clearLogFiles(): Promise<void> {
  if (!logDir) return;
  const open = stream;
  stream = null;
  if (open) {
    await new Promise<void>((resolve) => {
      open.once('close', () => resolve());
      open.end();
    });
  }
  for (let i = 0; i <= MAX_ROTATED_FILES; i++) {
    await fs.promises.rm(path.join(logDir, rotatedLogName(i)), { force: true });
  }
  broken = false;
  openStream();
  append(`${new Date().toISOString()} ===== log cleared =====\n`);
}

export function flushLogFile(): void {
  stream?.end();
  stream = null;
}
