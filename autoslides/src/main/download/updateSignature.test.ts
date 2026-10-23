import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { verifyUpdateFile, type SigningKey } from './updateSignature';
import { compareVersions } from './updateVersion';
import signingKeys from './updateSigningKeys.json';

interface SigningScript {
  signFile: (filePath: string, privateKey: crypto.KeyObject) => Promise<string>;
  keyIdOf: (publicKey: crypto.KeyObject) => string;
}

// The release script is plain .mjs (it runs in CI with no build step); load it
// by URL so tsc does not try to type it.
const scriptUrl = pathToFileURL(path.resolve(__dirname, '../../../scripts/update-signing.mjs')).href;

let script: SigningScript;
let dir: string;
let privateKey: crypto.KeyObject;
let keys: SigningKey[];

const NAME = 'AutoSlides-Setup-9.0.0-Windows-x64.exe';

beforeAll(async () => {
  script = (await import(scriptUrl)) as SigningScript;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-sig-'));
  const pair = crypto.generateKeyPairSync('ed25519');
  privateKey = pair.privateKey;
  keys = [{
    id: script.keyIdOf(pair.publicKey),
    publicKey: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }];
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeAsset(name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('verifyUpdateFile', () => {
  it('accepts a file signed by the release script', async () => {
    const file = writeAsset(NAME, 'installer bytes');
    const sig = await script.signFile(file, privateKey);
    expect(await verifyUpdateFile(file, NAME, sig, keys)).toEqual({ ok: true, keyId: keys[0].id });
  });

  it('rejects a changed file', async () => {
    const file = writeAsset(NAME, 'installer bytes');
    const sig = await script.signFile(file, privateKey);
    fs.writeFileSync(file, 'installer bytes, modified');
    expect(await verifyUpdateFile(file, NAME, sig, keys)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects a signed older release served under a newer name', async () => {
    const oldName = 'AutoSlides-Setup-8.0.0-Windows-x64.exe';
    const file = writeAsset(oldName, 'old installer');
    const sig = await script.signFile(file, privateKey);
    expect(await verifyUpdateFile(file, NAME, sig, keys)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects a key the app does not ship', async () => {
    const file = writeAsset(NAME, 'installer bytes');
    const other = crypto.generateKeyPairSync('ed25519').privateKey;
    const sig = await script.signFile(file, other);
    expect(await verifyUpdateFile(file, NAME, sig, keys)).toEqual({ ok: false, reason: 'unknown-key' });
  });

  it('rejects a forged signature under a known key id', async () => {
    const file = writeAsset(NAME, 'installer bytes');
    const other = crypto.generateKeyPairSync('ed25519').privateKey;
    const forged = JSON.parse(await script.signFile(file, other));
    forged.key = keys[0].id;
    expect(await verifyUpdateFile(file, NAME, JSON.stringify(forged), keys))
      .toEqual({ ok: false, reason: 'mismatch' });
  });

  it('reports a missing or malformed .sig', async () => {
    const file = writeAsset(NAME, 'installer bytes');
    expect(await verifyUpdateFile(file, NAME, null, keys)).toEqual({ ok: false, reason: 'missing' });
    expect(await verifyUpdateFile(file, NAME, 'not json', keys)).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifyUpdateFile(file, NAME, '{"format":"other"}', keys)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('updateSigningKeys.json', () => {
  it('lists valid ed25519 keys whose ids match the key bytes', () => {
    expect(signingKeys.keys.length).toBeGreaterThan(0);
    for (const entry of signingKeys.keys) {
      const key = crypto.createPublicKey(entry.publicKey);
      expect(key.asymmetricKeyType).toBe('ed25519');
      expect(script.keyIdOf(key)).toBe(entry.id);
    }
  });
});

describe('compareVersions', () => {
  it('orders dotted versions numerically', () => {
    expect(compareVersions('5.10.0', '5.9.9')).toBe(1);
    expect(compareVersions('v5.2.0', '5.2.0')).toBe(0);
    expect(compareVersions('5.2', '5.2.1')).toBe(-1);
  });

  it('does not treat a suffix as NaN', () => {
    expect(compareVersions('5.3.0-beta', '5.2.0')).toBe(1);
    expect(compareVersions('5.3.0-beta', '5.3.0')).toBe(0);
  });
});
