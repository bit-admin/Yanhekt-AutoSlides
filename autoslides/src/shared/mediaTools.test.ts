import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import manifest from '../../scripts/media-tools/manifest.json';

interface MediaScript {
  requirements: Record<string, string[]>;
  hashFile: (file: string) => Promise<string>;
  getTarget: (manifest: unknown, platform: string, arch: string) => { key: string; version: string };
  assertArchitecture: (header: Buffer, platform: string, arch: string) => void;
  assertVersion: (output: string, tool: string, target: { version: string; revision?: string }) => void;
  assertCapabilities: (outputs: Record<string, string>) => void;
  verifyBundle: (directory: string, platform: string, arch: string, target: unknown) => { native: boolean };
  download: (artifact: { url: string; sha256: string }, cache: string) => Promise<string>;
  extractFiles: (archive: string, artifact: { url: string; files: Record<string, string> }, destination: string) => Promise<void>;
}

// The build-time script runs directly in Node, outside the TypeScript bundle.
const scriptUrl = pathToFileURL(path.resolve(__dirname, '../../scripts/media-tools.mjs')).href;
let script: MediaScript;
let directory: string;
beforeAll(async () => {
  script = await import(scriptUrl) as MediaScript;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'media-tools-test-'));
});
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
afterEach(() => vi.unstubAllGlobals());

function header(platform: string): Buffer {
  const result = Buffer.alloc(256);
  if (platform === 'darwin') {
    result.writeUInt32LE(0xfeedfacf, 0);
    result.writeUInt32LE(0x0100000c, 4);
  } else if (platform === 'linux') {
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]).copy(result);
    result.writeUInt16LE(62, 18);
  } else {
    result.write('MZ');
    result.writeUInt32LE(128, 60);
    result.writeUInt32LE(0x00004550, 128);
    result.writeUInt16LE(0x8664, 132);
  }
  return result;
}

function capabilities(): Record<string, string> {
  return Object.fromEntries(Object.entries(script.requirements).map(([kind, names]) => [kind,
    names.map(name => kind === 'bsfs' || kind === 'protocols' ? `  ${name}` : ` V..... ${name} description`).join('\n'),
  ]));
}

describe('media artifact pins', () => {
  it('supports only the three release targets and rejects implicit host substitutions', () => {
    expect(Object.keys(manifest.targets).sort()).toEqual(['darwin-arm64', 'linux-x64', 'win32-x64']);
    expect(script.getTarget(manifest, 'win32', 'x64').key).toBe('win32-x64');
    expect(() => script.getTarget(manifest, 'darwin', 'x64')).toThrow('Unsupported media-tools target');
    expect(() => script.getTarget(manifest, 'linux', 'arm64')).toThrow('Unsupported media-tools target');
  });

  it('pins HTTPS artifacts by SHA-256 without floating latest/master URLs', () => {
    for (const target of Object.values(manifest.targets)) {
      expect(target.version).toBe(manifest.version);
      for (const artifact of target.artifacts) {
        expect(new URL(artifact.url).protocol).toBe('https:');
        expect(artifact.url).not.toMatch(/latest|master|nonfree|shared/);
        expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
        for (const [member, output] of Object.entries(artifact.files)) {
          for (const file of [member, output]) {
            expect(file).not.toMatch(/(^\/|\\|:|(^|\/)\.\.(\/|$))/);
          }
        }
      }
    }
  });

  it('hashes file bytes rather than trusting the npm lock or a filename', async () => {
    const file = path.join(directory, 'artifact.zip');
    fs.writeFileSync(file, 'first artifact');
    const expected = crypto.createHash('sha256').update('first artifact').digest('hex');
    expect(await script.hashFile(file)).toBe(expected);
    fs.writeFileSync(file, 'changed artifact');
    expect(await script.hashFile(file)).not.toBe(expected);
  });
});

describe('download integrity and staging', () => {
  it('verifies downloads and re-hashes cached bytes before reuse', async () => {
    const body = 'test archive bytes, not an executable';
    const artifact = { url: 'https://media.invalid/test.zip', sha256: crypto.createHash('sha256').update(body).digest('hex') };
    const cache = path.join(directory, 'valid-cache');
    const fetch = vi.fn(async () => new Response(body));
    vi.stubGlobal('fetch', fetch);
    const downloaded = await script.download(artifact, cache);
    expect(fs.readFileSync(downloaded, 'utf8')).toBe(body);
    expect(await script.download(artifact, cache)).toBe(downloaded);
    expect(fetch).toHaveBeenCalledTimes(1);
    fs.writeFileSync(downloaded, 'modified cache');
    await expect(script.download(artifact, cache)).rejects.toThrow('Corrupt cached media artifact');
  });

  it('rejects hash mismatches before extraction and cleans partial downloads', async () => {
    const cache = path.join(directory, 'bad-cache');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('wrong bytes')));
    await expect(script.download({ url: 'https://media.invalid/wrong.zip', sha256: '0'.repeat(64) }, cache)).rejects.toThrow('SHA-256 mismatch');
    expect(fs.readdirSync(cache)).toEqual([]);
  });

  it('retries HTTP errors without keeping their response as an artifact', async () => {
    const cache = path.join(directory, 'http-cache');
    const fetch = vi.fn(async () => new Response('error page', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    await expect(script.download({ url: 'https://media.invalid/unavailable.zip', sha256: '0'.repeat(64) }, cache)).rejects.toThrow('Download failed (503)');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fs.readdirSync(cache)).toEqual([]);
  });

  it('copies only declared ZIP members, preserving the provider license', async () => {
    const zip = new JSZip();
    zip.file('build/bin/ffmpeg.exe', 'test fixture, not executable');
    zip.file('build/LICENSE.txt', 'provider license');
    zip.file('build/bin/ffplay.exe', 'unused tool');
    const archive = path.join(directory, 'fixture.zip');
    fs.writeFileSync(archive, await zip.generateAsync({ type: 'nodebuffer' }));
    const staged = path.join(directory, 'staged');
    fs.mkdirSync(staged);
    await script.extractFiles(archive, { url: 'https://media.invalid/fixture.zip', files: {
      'build/bin/ffmpeg.exe': 'ffmpeg.exe', 'build/LICENSE.txt': 'licenses/provider.txt',
    } }, staged);
    expect(fs.readFileSync(path.join(staged, 'licenses/provider.txt'), 'utf8')).toBe('provider license');
    expect(fs.readdirSync(staged).sort()).toEqual(['ffmpeg.exe', 'licenses']);
    await expect(script.extractFiles(archive, { url: 'https://media.invalid/fixture.zip', files: {
      'build/LICENSE.txt': '../outside.txt',
    } }, staged)).rejects.toThrow('Unsafe archive member');
  });
});

describe('executable architecture', () => {
  it.each([['darwin', 'arm64'], ['linux', 'x64'], ['win32', 'x64']])('accepts the real %s-%s header', (platform, arch) => {
    expect(() => script.assertArchitecture(header(platform), platform, arch)).not.toThrow();
  });

  it('rejects an Intel Mach-O in an ARM64 folder', () => {
    const intel = header('darwin');
    intel.writeUInt32LE(0x01000007, 4);
    expect(() => script.assertArchitecture(intel, 'darwin', 'arm64')).toThrow('architecture');
  });

  it('rejects PE ARM64 and malformed PE offsets', () => {
    const arm = header('win32');
    arm.writeUInt16LE(0xaa64, 132);
    expect(() => script.assertArchitecture(arm, 'win32', 'x64')).toThrow('architecture');
    const invalid = header('win32');
    invalid.writeUInt32LE(0xffffffff, 60);
    expect(() => script.assertArchitecture(invalid, 'win32', 'x64')).toThrow('architecture');
  });

  it('rejects a different OS, big-endian ELF, and truncated files', () => {
    expect(() => script.assertArchitecture(header('linux'), 'darwin', 'arm64')).toThrow('architecture');
    const bigEndian = header('linux');
    bigEndian[5] = 2;
    expect(() => script.assertArchitecture(bigEndian, 'linux', 'x64')).toThrow('architecture');
    expect(() => script.assertArchitecture(Buffer.alloc(0), 'win32', 'x64')).toThrow('architecture');
  });

  it('checks foreign bundles without attempting to execute them', () => {
    const platform = process.platform === 'win32' ? 'linux' : 'win32';
    const suffix = platform === 'win32' ? '.exe' : '';
    const foreign = path.join(directory, 'foreign');
    fs.mkdirSync(foreign);
    for (const tool of ['ffmpeg', 'ffprobe']) fs.writeFileSync(path.join(foreign, tool + suffix), header(platform), { mode: 0o755 });
    expect(script.verifyBundle(foreign, platform, 'x64', { version: '9.0.2' })).toEqual({ native: false, versions: {} });
  });
});

describe('version and capabilities', () => {
  it('accepts release and pinned release-branch version banners', () => {
    expect(() => script.assertVersion('ffmpeg version 9.0.2-https://www.martin-riedl.de Copyright\nconfiguration: --enable-gpl', 'ffmpeg', { version: '9.0.2' })).not.toThrow();
    expect(() => script.assertVersion('ffprobe version n9.0.2-17-g2a571b6068 Copyright\nconfiguration: --enable-gpl', 'ffprobe', { version: '9.0.2', revision: '2a571b6068' })).not.toThrow();
  });

  it.each(['6.1.1', '9.0.20', '9.0.1', '10.0'])('rejects a mismatched version %s', version => {
    expect(() => script.assertVersion(`ffmpeg version ${version} Copyright\n--enable-gpl`, 'ffmpeg', { version: '9.0.2' })).toThrow('Expected ffmpeg');
  });

  it('rejects the wrong tool, revision, and nonfree/LGPL-only builds', () => {
    expect(() => script.assertVersion('ffprobe version 9.0.2\n--enable-gpl', 'ffmpeg', { version: '9.0.2' })).toThrow('Expected ffmpeg');
    expect(() => script.assertVersion('ffmpeg version n9.0.2-17-gother\n--enable-gpl', 'ffmpeg', { version: '9.0.2', revision: '2a571b6068' })).toThrow('revision');
    expect(() => script.assertVersion('ffmpeg version 9.0.2\n--enable-gpl --enable-nonfree', 'ffmpeg', { version: '9.0.2' })).toThrow('Non-redistributable');
    expect(() => script.assertVersion('ffmpeg version 9.0.2\n--enable-libsvtav1', 'ffmpeg', { version: '9.0.2' })).toThrow('GPL build');
  });

  it('requires current HEVC/audio features as well as SVT-AV1', () => {
    expect(() => script.assertCapabilities(capabilities())).not.toThrow();
    for (const [kind, names] of Object.entries(script.requirements)) {
      for (const name of names) {
        const outputs = capabilities();
        outputs[kind] = outputs[kind].split('\n').filter(line => !line.trim().split(/\s+/).includes(name)).join('\n');
        expect(() => script.assertCapabilities(outputs)).toThrow(`missing required ${kind}: ${name}`);
      }
    }
  });

  it('recognizes comma-separated demuxer aliases but not names only in descriptions', () => {
    const outputs = capabilities();
    outputs.demuxers = outputs.demuxers.replace('V..... mov description', 'D  mov,mp4,m4a,3gp,3g2,mj2 QuickTime / MOV');
    expect(() => script.assertCapabilities(outputs)).not.toThrow();
    outputs.encoders = outputs.encoders.replace('V..... libsvtav1 description', 'V..... other description mentions libsvtav1');
    expect(() => script.assertCapabilities(outputs)).toThrow('libsvtav1');
  });
});
