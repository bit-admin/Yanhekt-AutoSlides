import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeLane } from './crawler.ts';
import { exportTerms, termAtLeast } from './export.ts';
import { generateKeyPairSync } from 'node:crypto';
import {
  CLIENT_MANIFEST_ASSET, keyIdOf, makeEnvelope, openEnvelope, parseClientManifest, parseTermDoc, termAssetName,
  type SigningKey,
} from './clientIndex.ts';
import { currentTerm, dbAssetName } from './release.ts';
import { decrypt, encrypt, passphraseId, seal, unseal, unsealAsync } from './seal.ts';
import { drain, FakeApi, make } from './testkit.ts';

test('seal: same bytes as openssl enc -aes-256-cbc -pbkdf2 -iter 200000', () => {
  // printf 'hello index' | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -S 0102030405060708 -pass pass:test-pass | base64
  // (OpenSSL 3 omits the "Salted__" header when -S is given; it writes it otherwise.)
  const salt = Buffer.from('0102030405060708', 'hex');
  const out = encrypt(Buffer.from('hello index'), 'test-pass', salt);
  assert.equal(out.subarray(0, 8).toString(), 'Salted__');
  assert.deepEqual(out.subarray(8, 16), salt);
  assert.equal(out.subarray(16).toString('base64'), '30yCx3vaTDVf33C+G3mKSQ==');
  assert.equal(decrypt(out, 'test-pass').toString(), 'hello index');
});

test('seal: round trip, wrong passphrase refused', () => {
  const plain = Buffer.from(JSON.stringify({ a: 1, b: 'x'.repeat(1000) }));
  const sealed = seal(plain, 'p');
  assert.deepEqual(unseal(sealed, 'p'), plain);
  assert.throws(() => unseal(sealed, 'q'));
  assert.throws(() => unseal(Buffer.from('not sealed at all'), 'p'), /not an encrypted/);
});

test('seal: async unseal matches, passphrase ids differ per passphrase', async () => {
  const plain = Buffer.from('term json');
  const sealed = seal(plain, 'client');
  assert.deepEqual(await unsealAsync(sealed, 'client'), plain);
  await assert.rejects(unsealAsync(sealed, 'other'));
  assert.match(passphraseId('client'), /^[0-9a-f]{8}$/);
  assert.notEqual(passphraseId('client'), passphraseId('other'));
});

function keyPair(): { privateKey: import('node:crypto').KeyObject; entry: SigningKey } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return { privateKey, entry: { id: keyIdOf(publicKey), publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() } };
}

test('envelope: opens with the right key, refuses tampering, other keys and other names', () => {
  const { privateKey, entry } = keyPair();
  const data = seal(Buffer.from('{"x":1}'), 'client');
  const text = makeEnvelope(CLIENT_MANIFEST_ASSET, data, passphraseId('client'), privateKey);
  const ok = openEnvelope(text, CLIENT_MANIFEST_ASSET, [entry]);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.data, data);
    assert.equal(ok.passphraseId, passphraseId('client'));
    assert.equal(ok.keyId, entry.id);
  }
  assert.deepEqual(openEnvelope(text, 'other.json', [entry]), { ok: false, reason: 'wrong-file' });
  assert.deepEqual(openEnvelope(text, CLIENT_MANIFEST_ASSET, [keyPair().entry]), { ok: false, reason: 'unknown-key' });
  assert.deepEqual(openEnvelope('nope', CLIENT_MANIFEST_ASSET, [entry]), { ok: false, reason: 'malformed' });
  const e = JSON.parse(text);
  const flipped = Buffer.from(e.data, 'base64');
  flipped[20] ^= 1;
  e.data = flipped.toString('base64');
  assert.deepEqual(openEnvelope(JSON.stringify(e), CLIENT_MANIFEST_ASSET, [entry]), { ok: false, reason: 'mismatch' });
  // A forged key id pointing at a real key still fails the signature.
  const other = keyPair();
  const forged = JSON.parse(makeEnvelope(CLIENT_MANIFEST_ASSET, data, 'x', other.privateKey));
  forged.key = entry.id;
  assert.deepEqual(openEnvelope(JSON.stringify(forged), CLIENT_MANIFEST_ASSET, [entry]), { ok: false, reason: 'mismatch' });
});

test('client manifest and term file parsing', () => {
  assert.throws(() => parseClientManifest('{"format":2,"terms":[],"passphraseId":"x"}'), /unsupported/);
  assert.throws(() => parseClientManifest(JSON.stringify({
    format: 1, generatedAt: '', passphraseId: 'x',
    terms: [{ term: 't', asset: '../evil', assetSha256: 'a', sha256: 'b', bytes: 1, courses: 0, sessions: 0 }],
  })), /bad asset name/);
  const doc = JSON.stringify({ format: 1, term: '2024-2025-1', fields: ['id', 'name', 'number', 'teachers', 'sessions'], courses: [[5, 'A', null, ['T'], [7, 8]]] });
  assert.deepEqual(parseTermDoc(doc, '2024-2025-1'), [{ id: '5', name: 'A', number: null, teachers: ['T'], sessionIds: ['7', '8'] }]);
  assert.throws(() => parseTermDoc(doc, '2024-2025-2'), /expected 2024-2025-2/);
});

test('current term, Beijing time', () => {
  assert.equal(currentTerm(Date.UTC(2026, 9, 25)), '2026-2027-1');
  assert.equal(currentTerm(Date.UTC(2027, 0, 20)), '2026-2027-1');
  assert.equal(currentTerm(Date.UTC(2027, 1, 1)), '2026-2027-2');
  assert.equal(currentTerm(Date.UTC(2027, 6, 31, 15)), '2026-2027-2');
  assert.equal(currentTerm(Date.UTC(2027, 6, 31, 16)), '2027-2028-1', '00:00 on 1 August in Beijing');
});

test('export: one file per term from the minimum term, stable bytes, gone sessions left out', async () => {
  const api = new FakeApi([...Array(30).keys()].map((i) => 1000 + i));
  const { crawler, store } = make(api, [rangeLane(1000, 1029)]);
  await drain(crawler);
  // FakeApi courses are 2025-2026-1; move one to an older term.
  const firstCourse = Number((store.db.prepare('SELECT MIN(id) AS id FROM courses').get() as { id: number }).id);
  store.db.prepare("UPDATE courses SET school_year = '2022-2023', semester = 2 WHERE id = ?").run(firstCourse);
  store.db.prepare('UPDATE sessions SET gone_at = 1 WHERE id = 1029').run();

  const files = exportTerms(store.db, '2023-2024-1');
  assert.deepEqual(files.map((f) => f.term), ['2025-2026-1']);
  const doc = JSON.parse(files[0].json.toString());
  assert.deepEqual(doc.fields, ['id', 'name', 'number', 'teachers', 'sessions']);
  assert.ok(doc.courses.every((c: unknown[]) => c[0] !== firstCourse));
  const all = doc.courses.flatMap((c: unknown[]) => c[4] as number[]);
  assert.ok(!all.includes(1029), 'gone session left out');
  assert.equal(files[0].sessions, all.length);
  assert.deepEqual(doc.courses[0][3], ['裴老师', '王老师']);

  assert.equal(exportTerms(store.db, '2023-2024-1')[0].sha256, files[0].sha256, 'same data, same hash');
  assert.deepEqual(exportTerms(store.db, '2022-2023-1').map((f) => f.term), ['2025-2026-1', '2022-2023-2']);
  store.close();
});

test('release names', () => {
  assert.ok(termAtLeast('2023-2024-2', '2023-2024-1'));
  assert.ok(!termAtLeast('2022-2023-2', '2023-2024-1'));
  assert.equal(termAssetName('2025-2026-1', 'abcdef0123456789', '0badcafe'), 'term-2025-2026-1.abcdef012345.0badcafe.json.gz.enc');
  assert.equal(dbAssetName(Date.UTC(2026, 9, 25, 19, 3, 4, 567)), 'yanhekt-index.20261025T190304Z.db.gz.enc');
});
