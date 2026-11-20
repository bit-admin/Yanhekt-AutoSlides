// scripts/media-tools/zipMember.mjs on zips built byte by byte, so each case
// controls exactly what the central directory claims.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs build script, no type declarations
import { listZipEntries, readZipMember } from './zipMember.mjs';
// @ts-expect-error -- plain .mjs build script, no type declarations
import { extractFiles } from '../media-tools.mjs';

interface Entry {
  name: string;
  data: Buffer;
  deflate?: boolean;
  /** Unix file type and permission bits for the external attributes. */
  mode?: number;
  /** Overrides of what the headers claim, for broken or hostile archives. */
  size?: number;
  crc?: number;
  flags?: number;
  method?: number;
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const stored = entry.deflate ? deflateRawSync(entry.data) : entry.data;
    const method = entry.method ?? (entry.deflate ? 8 : 0);
    const crc = entry.crc ?? crc32(entry.data);
    const size = entry.size ?? entry.data.length;
    const flags = entry.flags ?? 0;
    const header = [u16(20), u16(flags), u16(method), u16(0), u16(0), u32(crc), u32(stored.length), u32(size), u16(name.length), u16(0)];
    const local = Buffer.concat([Buffer.from('PK\x03\x04'), ...header, name, stored]);
    const unix = entry.mode !== undefined;
    const central = Buffer.concat([
      Buffer.from('PK\x01\x02'), u16(unix ? (3 << 8) | 20 : 20), ...header,
      u16(0), u16(0), u16(0), u32(unix ? entry.mode! * 65536 : 0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    Buffer.from('PK\x05\x06'), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(directory.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, directory, eocd]);
}

function read(entries: Entry[], name: string): Buffer {
  const zip = buildZip(entries);
  return readZipMember(zip, listZipEntries(zip), name);
}

describe('readZipMember', () => {
  const payload = Buffer.from('ffmpeg '.repeat(500));

  it('reads stored and deflated members', () => {
    const entries = [
      { name: 'licenses/COPYING', data: Buffer.from('GPL') },
      { name: 'ffmpeg', data: payload, deflate: true, mode: 0o100755 },
    ];
    expect(read(entries, 'licenses/COPYING').toString()).toBe('GPL');
    expect(read(entries, 'ffmpeg').equals(payload)).toBe(true);
  });

  it('refuses a missing member', () => {
    expect(() => read([{ name: 'ffmpeg', data: payload }], 'ffmpeg.exe')).toThrow(/missing member ffmpeg\.exe/);
  });

  it('refuses symlinks and folders', () => {
    expect(() => read([{ name: 'ffmpeg', data: Buffer.from('/etc/passwd'), mode: 0o120777 }], 'ffmpeg')).toThrow(/not a regular file/);
    expect(() => read([{ name: 'bin/', data: Buffer.alloc(0), mode: 0o040755 }], 'bin/')).toThrow(/folder/);
  });

  it('refuses a CRC mismatch', () => {
    expect(() => read([{ name: 'ffmpeg', data: payload, deflate: true, crc: 1 }], 'ffmpeg')).toThrow(/CRC-32/);
  });

  it('stops a member that inflates past its declared size', () => {
    const bomb = Buffer.alloc(1024 * 1024);
    expect(() => read([{ name: 'ffmpeg', data: bomb, deflate: true, size: 1024 }], 'ffmpeg')).toThrow(/declared size/);
  });

  it('refuses a member shorter than declared', () => {
    expect(() => read([{ name: 'ffmpeg', data: payload, size: payload.length + 1 }], 'ffmpeg')).toThrow(/runs past|expected/);
  });

  it('refuses encryption and unknown methods', () => {
    expect(() => read([{ name: 'ffmpeg', data: payload, flags: 1 }], 'ffmpeg')).toThrow(/encrypted/);
    expect(() => read([{ name: 'ffmpeg', data: payload, method: 12 }], 'ffmpeg')).toThrow(/method 12/);
  });

  it('refuses duplicate names and a file that is not a zip', () => {
    const twice = [{ name: 'ffmpeg', data: payload }, { name: 'ffmpeg', data: Buffer.from('evil') }];
    expect(() => listZipEntries(buildZip(twice))).toThrow(/duplicate member/);
    expect(() => listZipEntries(Buffer.from('not a zip at all, just some bytes'))).toThrow(/end of central directory/);
  });
});

describe('extractFiles', () => {
  let root: string;
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('writes only the named members, to the names the manifest gives', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-member-'));
    const archive = path.join(root, 'tools.zip');
    fs.writeFileSync(archive, buildZip([
      { name: 'build/ffmpeg', data: Buffer.from('binary'), deflate: true },
      { name: 'build/COPYING', data: Buffer.from('GPL') },
      { name: '../outside', data: Buffer.from('ignored') },
    ]));
    const out = path.join(root, 'out');
    await extractFiles(archive, {
      url: 'https://example.invalid/tools.zip',
      files: { 'build/ffmpeg': 'ffmpeg', 'build/COPYING': 'licenses/COPYING' },
    }, out);
    expect(fs.readFileSync(path.join(out, 'ffmpeg'), 'utf8')).toBe('binary');
    expect(fs.readFileSync(path.join(out, 'licenses/COPYING'), 'utf8')).toBe('GPL');
    expect(fs.readdirSync(out).sort()).toEqual(['ffmpeg', 'licenses']);
    expect(fs.existsSync(path.join(root, 'outside'))).toBe(false);
  });

  it('refuses an artifact that is not a zip', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-member-'));
    await expect(extractFiles(path.join(root, 'x.tar.xz'), { url: 'https://example.invalid/x.tar.xz', files: {} }, root))
      .rejects.toThrow(/must be zip archives/);
  });
});
