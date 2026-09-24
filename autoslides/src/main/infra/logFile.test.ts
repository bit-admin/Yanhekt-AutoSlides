import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_ROTATED_FILES,
  formatLogLine,
  rotateLogFiles,
  rotatedLogName,
  shouldWriteLevel,
} from './logFile';

describe('shouldWriteLevel', () => {
  it('always writes warn/error, debug/info only when verbose', () => {
    expect(shouldWriteLevel('error', false)).toBe(true);
    expect(shouldWriteLevel('warn', false)).toBe(true);
    expect(shouldWriteLevel('info', false)).toBe(false);
    expect(shouldWriteLevel('debug', false)).toBe(false);
    expect(shouldWriteLevel('debug', true)).toBe(true);
  });
});

describe('formatLogLine', () => {
  it('stamps level/source/namespace, redacts and indents continuation lines', () => {
    const line = formatLogLine(
      'error',
      'renderer',
      'TaskQueue',
      'failed t=0123456789abcdef0123456789abcdef\n  at x',
      new Date('2026-09-24T10:00:00.000Z')
    );
    expect(line).toBe('2026-09-24T10:00:00.000Z ERROR [renderer] [TaskQueue] failed t=****cdef\n      at x\n');
  });
});

describe('rotateLogFiles', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('names rotated files', () => {
    expect(rotatedLogName(0)).toBe('autoslides.log');
    expect(rotatedLogName(2)).toBe('autoslides.2.log');
  });

  it('shifts files down and drops the oldest', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-log-'));
    for (let i = 0; i <= MAX_ROTATED_FILES; i++) {
      fs.writeFileSync(path.join(dir, rotatedLogName(i)), `gen${i}`);
    }
    rotateLogFiles(dir);
    expect(fs.existsSync(path.join(dir, rotatedLogName(0)))).toBe(false);
    expect(fs.readFileSync(path.join(dir, rotatedLogName(1)), 'utf8')).toBe('gen0');
    expect(fs.readFileSync(path.join(dir, rotatedLogName(MAX_ROTATED_FILES)), 'utf8')).toBe(`gen${MAX_ROTATED_FILES - 1}`);
  });
});

describe('clearLogFiles', () => {
  it('deletes rotated files and keeps logging to a fresh file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-log-clear-'));
    try {
      const mod = await import('./logFile');
      mod.initLogFile(dir, { version: 'test' });
      fs.writeFileSync(path.join(dir, rotatedLogName(1)), 'old');
      mod.writeLogArgs('error', 'main', 'Test', ['before']);
      await mod.clearLogFiles();
      mod.writeLogArgs('error', 'main', 'Test', ['after']);
      mod.flushLogFile();
      await new Promise((r) => setTimeout(r, 50));
      expect(fs.existsSync(path.join(dir, rotatedLogName(1)))).toBe(false);
      const text = fs.readFileSync(path.join(dir, rotatedLogName(0)), 'utf8');
      expect(text).not.toContain('before');
      expect(text).toContain('log cleared');
      expect(text).toContain('after');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
