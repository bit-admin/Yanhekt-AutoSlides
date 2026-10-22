import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { COPYRIGHT_FILE_NAME, ensureCopyrightNotice, ensureCopyrightNoticeSync } from './copyrightNoticeFile';
import { OUTPUT_DIR_COPYRIGHT_TXT, OUTPUT_DIR_NOTICE_MARKER } from '@common/copyrightNotice';

let dir: string;
const file = () => path.join(dir, COPYRIGHT_FILE_NAME);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notice-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe.each([
  ['async', ensureCopyrightNotice],
  ['sync', (d: string) => Promise.resolve(ensureCopyrightNoticeSync(d))],
] as const)('ensureCopyrightNotice (%s)', (_name, ensure) => {
  it('creates the notice in an empty folder', async () => {
    expect(await ensure(dir)).toBe('created');
    expect(fs.readFileSync(file(), 'utf8')).toBe(OUTPUT_DIR_COPYRIGHT_TXT);
  });

  it('keeps an up-to-date notice', async () => {
    await ensure(dir);
    expect(await ensure(dir)).toBe('kept');
  });

  it('recreates a deleted notice', async () => {
    await ensure(dir);
    fs.rmSync(file());
    expect(await ensure(dir)).toBe('created');
  });

  it('refreshes an outdated notice of its own', async () => {
    fs.writeFileSync(file(), `${OUTPUT_DIR_NOTICE_MARKER}\n\nold wording\n`);
    expect(await ensure(dir)).toBe('updated');
    expect(fs.readFileSync(file(), 'utf8')).toBe(OUTPUT_DIR_COPYRIGHT_TXT);
  });

  it("never touches the user's own COPYRIGHT.txt", async () => {
    const mine = 'Copyright (c) 2026 Me. My own notes.\n';
    fs.writeFileSync(file(), mine);
    expect(await ensure(dir)).toBe('user-file');
    expect(fs.readFileSync(file(), 'utf8')).toBe(mine);
  });

  it('does not create a missing folder', async () => {
    const missing = path.join(dir, 'gone');
    expect(await ensure(missing)).toBe('skipped');
    expect(fs.existsSync(missing)).toBe(false);
  });

  it('skips a directory named COPYRIGHT.txt', async () => {
    fs.mkdirSync(file());
    expect(await ensure(dir)).toBe('skipped');
    expect(fs.statSync(file()).isDirectory()).toBe(true);
  });
});
