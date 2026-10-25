import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeLane } from './crawler.ts';
import { exportTerms, termAtLeast } from './export.ts';
import { dbAssetName, termAssetName } from './release.ts';
import { decrypt, encrypt, seal, unseal } from './seal.ts';
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
  assert.equal(termAssetName('2025-2026-1', 'abcdef0123456789'), 'term-2025-2026-1.abcdef012345.json.gz.enc');
  assert.equal(dbAssetName(Date.UTC(2026, 9, 25, 19, 3, 4, 567)), 'yanhekt-index.20261025T190304Z.db.gz.enc');
});
