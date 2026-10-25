import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => '', getPath: () => '' } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import {
  CLIENT_MANIFEST_ASSET,
  keyIdOf,
  makeEnvelope,
  sha256Hex,
  termAssetName,
  type ClientManifest,
  type SigningKey,
} from './clientIndex';
import { hideKey, indexClientPassphrase, revealKey } from './clientKey';
import { CourseIndexBundle } from './courseIndex';
import { decrypt, encrypt, passphraseId, seal } from './seal';

// Fabricated courses only: real index data never goes into tests.
const PASS = 'test-client-passphrase';
const TERMS: Record<string, unknown[][]> = {
  '2024-2025-1': [[101, '线性代数', 'K0101', ['张三'], [9001, 9002]], [102, '数据结构', null, [], []]],
  '2024-2025-2': [[201, '高等数学', 'K0201', ['李四', '王五'], [9101]]],
};

function keyPair(): { privateKey: crypto.KeyObject; entry: SigningKey } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, entry: { id: keyIdOf(publicKey), publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() } };
}

let dir = '';
let signer: ReturnType<typeof keyPair>;

/** Writes a bundle like `indexer release bundle` does; `skip` leaves a term's file out. */
function writeBundle(options: { pass?: string; key?: crypto.KeyObject; skip?: string[] } = {}): ClientManifest {
  const pass = options.pass ?? PASS;
  const pid = passphraseId(pass);
  const terms = Object.entries(TERMS).map(([term, courses]) => {
    const json = Buffer.from(JSON.stringify({ format: 1, term, fields: ['id', 'name', 'number', 'teachers', 'sessions'], courses }));
    const sealed = seal(json, pass);
    const sha256 = sha256Hex(json);
    const asset = termAssetName(term, sha256, pid);
    if (!options.skip?.includes(term)) fs.writeFileSync(path.join(dir, asset), sealed);
    return { term, asset, bytes: sealed.length, assetSha256: sha256Hex(sealed), sha256, courses: courses.length, sessions: 0 };
  });
  const manifest: ClientManifest = { format: 1, generatedAt: '2026-10-25T00:00:00.000Z', passphraseId: pid, terms };
  const envelope = makeEnvelope(CLIENT_MANIFEST_ASSET, seal(Buffer.from(JSON.stringify(manifest)), pass), pid, options.key ?? signer.privateKey);
  fs.writeFileSync(path.join(dir, CLIENT_MANIFEST_ASSET), envelope);
  return manifest;
}

const bundle = (passphrase: string | null = PASS) => new CourseIndexBundle({ dir, passphrase, keys: [signer.entry] });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-index-'));
  signer = keyPair();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('CourseIndexBundle', () => {
  it('lists the bundled terms newest first and reads a term', async () => {
    writeBundle({ skip: [] });
    const index = bundle();
    expect(await index.state()).toEqual({
      ok: true,
      generatedAt: '2026-10-25T00:00:00.000Z',
      terms: [
        { term: '2024-2025-2', courses: 1, sessions: 0 },
        { term: '2024-2025-1', courses: 2, sessions: 0 },
      ],
    });
    expect(await index.term('2024-2025-1')).toEqual([
      { id: '101', name: '线性代数', number: 'K0101', teachers: ['张三'], sessionIds: ['9001', '9002'] },
      { id: '102', name: '数据结构', number: null, teachers: [], sessionIds: [] },
    ]);
  });

  it('leaves out terms whose file is not bundled', async () => {
    writeBundle({ skip: ['2024-2025-2'] });
    const index = bundle();
    const state = await index.state();
    expect(state.ok && state.terms.map((t) => t.term)).toEqual(['2024-2025-1']);
    expect(await index.term('2024-2025-2')).toBeNull();
    expect(await index.term('2030-2031-1')).toBeNull();
  });

  it('refuses a term file that does not match the manifest', async () => {
    const manifest = writeBundle();
    const entry = manifest.terms[0];
    fs.writeFileSync(path.join(dir, entry.asset), seal(Buffer.from('{"format":1}'), PASS));
    expect(await bundle().term(entry.term)).toBeNull();
  });

  it('reports why there is no index', async () => {
    expect(await bundle().state()).toEqual({ ok: false, problem: 'missing', detail: undefined });
    writeBundle();
    expect(await bundle(null).state()).toMatchObject({ ok: false, problem: 'no-key' });
    expect(await bundle('another-passphrase').state()).toMatchObject({ ok: false, problem: 'other-passphrase' });
    writeBundle({ key: keyPair().privateKey });
    expect(await bundle().state()).toMatchObject({ ok: false, problem: 'bad-signature', detail: 'unknown-key' });
  });
});

describe('clientKey', () => {
  it('hides and reveals the passphrase; the hidden form does not contain it', () => {
    const hidden = hideKey(PASS);
    expect(revealKey(hidden)).toBe(PASS);
    const raw = Buffer.from(hidden.x, 'base64').toString('latin1') + hidden.x + hidden.s;
    expect(raw.includes(PASS)).toBe(false);
    expect(hideKey(PASS).x).not.toBe(hidden.x);
  });

  it('is null when the build carries no key', () => {
    expect(indexClientPassphrase()).toBeNull();
  });
});

describe('seal (copy of indexer/src/seal.ts)', () => {
  it('matches openssl enc -aes-256-cbc -pbkdf2 -iter 200000', () => {
    const salt = Buffer.from('0102030405060708', 'hex');
    const out = encrypt(Buffer.from('hello index'), 'test-pass', salt);
    expect(out.subarray(16).toString('base64')).toBe('30yCx3vaTDVf33C+G3mKSQ==');
    expect(decrypt(out, 'test-pass').toString()).toBe('hello index');
  });
});
