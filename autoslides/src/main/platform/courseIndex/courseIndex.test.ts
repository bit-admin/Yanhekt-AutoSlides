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
  recipientsId,
  sha256Hex,
  termAssetName,
  type ClientManifest,
  type SigningKey,
} from './clientIndex';
import { openAgeGz, recipientOf } from './ageOpen';
import { hideKey, indexClientIdentity, revealKey } from './clientKey';
import { CourseIndexBundle } from './courseIndex';
import { newIdentity, sealAgeGz } from './testAge';

// Fabricated courses only: real index data never goes into tests.
let ME: { identity: string; recipient: string };
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
async function writeBundle(options: { recipients?: string[]; key?: crypto.KeyObject; skip?: string[] } = {}): Promise<ClientManifest> {
  const recipients = options.recipients ?? [ME.recipient];
  const rid = recipientsId(recipients);
  const terms = await Promise.all(Object.entries(TERMS).map(async ([term, courses]) => {
    const json = Buffer.from(JSON.stringify({ format: 1, term, fields: ['id', 'name', 'number', 'teachers', 'sessions'], courses }));
    const sealed = await sealAgeGz(json, recipients);
    const sha256 = sha256Hex(json);
    const asset = termAssetName(term, sha256, rid);
    if (!options.skip?.includes(term)) fs.writeFileSync(path.join(dir, asset), sealed);
    return { term, asset, bytes: sealed.length, assetSha256: sha256Hex(sealed), sha256, courses: courses.length, sessions: 0 };
  }));
  const manifest: ClientManifest = { format: 2, generatedAt: '2026-10-25T00:00:00.000Z', recipientsId: rid, terms };
  const sealed = await sealAgeGz(Buffer.from(JSON.stringify(manifest)), recipients);
  fs.writeFileSync(path.join(dir, CLIENT_MANIFEST_ASSET), makeEnvelope(CLIENT_MANIFEST_ASSET, sealed, recipients, options.key ?? signer.privateKey));
  return manifest;
}

const bundle = (identity: string | null = ME.identity) => new CourseIndexBundle({ dir, identity, keys: [signer.entry] });

beforeEach(async () => {
  ME ??= await newIdentity();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-index-'));
  signer = keyPair();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('CourseIndexBundle', () => {
  it('lists the bundled terms newest first and reads a term', async () => {
    await writeBundle({ skip: [] });
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
    await writeBundle({ skip: ['2024-2025-2'] });
    const index = bundle();
    const state = await index.state();
    expect(state.ok && state.terms.map((t) => t.term)).toEqual(['2024-2025-1']);
    expect(await index.term('2024-2025-2')).toBeNull();
    expect(await index.term('2030-2031-1')).toBeNull();
  });

  it('refuses a term file that does not match the manifest', async () => {
    const manifest = await writeBundle();
    const entry = manifest.terms[0];
    fs.writeFileSync(path.join(dir, entry.asset), await sealAgeGz(Buffer.from('{"format":1}'), [ME.recipient]));
    expect(await bundle().term(entry.term)).toBeNull();
  });

  it('reports why there is no index', async () => {
    expect(await bundle().state()).toEqual({ ok: false, problem: 'missing', detail: undefined });
    await writeBundle();
    expect(await bundle(null).state()).toMatchObject({ ok: false, problem: 'no-key' });
    expect(await bundle((await newIdentity()).identity).state()).toMatchObject({ ok: false, problem: 'other-key' });
    await writeBundle({ key: keyPair().privateKey });
    expect(await bundle().state()).toMatchObject({ ok: false, problem: 'bad-signature', detail: 'unknown-key' });
  });

  it('reads files encrypted to several readers', async () => {
    const other = await newIdentity();
    await writeBundle({ recipients: [other.recipient, ME.recipient] });
    expect(await bundle().term('2024-2025-2')).toHaveLength(1);
    expect(await bundle(other.identity).term('2024-2025-2')).toHaveLength(1);
  });

  it('treats a format-1 copy (shared passphrase) as no copy', async () => {
    await writeBundle();
    const e = JSON.parse(fs.readFileSync(path.join(dir, CLIENT_MANIFEST_ASSET), 'utf8'));
    e.format = 'autoslides-index-envelope/v1';
    e.passphraseId = 'abcd1234';
    delete e.recipients;
    fs.writeFileSync(path.join(dir, CLIENT_MANIFEST_ASSET), JSON.stringify(e));
    expect(await bundle().state()).toMatchObject({ ok: false, problem: 'missing', detail: 'malformed' });
  });
});

describe('clientKey', () => {
  it('hides and reveals the identity; the hidden form does not contain it', () => {
    const hidden = hideKey(ME.identity);
    expect(revealKey(hidden)).toBe(ME.identity);
    const raw = Buffer.from(hidden.x, 'base64').toString('latin1') + hidden.x + hidden.s;
    expect(raw.includes(ME.identity)).toBe(false);
    expect(hideKey(ME.identity).x).not.toBe(hidden.x);
  });

  it('is null when the build carries no key', () => {
    expect(indexClientIdentity()).toBeNull();
  });
});

// A file written by indexer/src/age.ts (gzip, then age), which publishes the
// release; the key is a throwaway made for this test.
const INDEXER_FILE = {
  "identity": "AGE-SECRET-KEY-1VZ7QV7XMS3WAXJMJCQXDRHLGSZY0JCXR7UQ9ZKTEDTLH8HNWR3MS0T3U5Q",
  "recipient": "age18j0vtds5wra4erjav0r4aqe2w82nzs62jyc9ldj75w6vjc8f746qjrc3vn",
  "plain": "written by indexer/src/age.ts, test-only key",
  "file": "YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IFgyNTUxOSBscUx2MklrenZacG5LbmtLc3lDNEs2WHVDWk53N3UySEl0WVJNbTJyWERBCmJjUEJYMzRvcHBSb0FtR2d5cVdBN1NrRzIwREhYVnhWdThiNVZ6UWl3cE0KLS0tIEp5T0JzcWNINERUaUxjUzNpYlFBRTdtK2YxMS8xTWF1NWVpR2Z3Z2RXVkEK6XwZvo2+F9QDmmTl6thNBxoW7QHUOQSsiOmcspTBm+SDlgr6DdN1AFr6wvLjJrHmypTqvHPj2WvqZn//8yTmS13kRymgpVU+7VI/Q3ECOghx6r7ToDB8AGPs65GgEvSl"
};

describe('ageOpen', () => {
  it('opens a file the indexer wrote', async () => {
    expect(await recipientOf(INDEXER_FILE.identity)).toBe(INDEXER_FILE.recipient);
    expect((await openAgeGz(Buffer.from(INDEXER_FILE.file, 'base64'), INDEXER_FILE.identity)).toString()).toBe(INDEXER_FILE.plain);
  });

  it('refuses an identity that is not a recipient', async () => {
    await expect(openAgeGz(Buffer.from(INDEXER_FILE.file, 'base64'), ME.identity)).rejects.toThrow();
  });
});
