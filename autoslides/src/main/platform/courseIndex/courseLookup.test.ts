import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => '', getPath: () => '', getName: () => 'AutoSlides', getVersion: () => '0.0.0' } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { CLIENT_MANIFEST_ASSET, keyIdOf, makeEnvelope, sha256Hex, termAssetName, type ClientManifest, type SigningKey } from './clientIndex';
import { LocalCourseIndex } from './courseIndex';
import { CourseIndexUpdater, fetchReleaseAsset } from './courseIndexUpdater';
import { CourseLookup } from './courseLookup';
import { searchCourses, type IndexCourse } from './localSearch';
import { passphraseId, seal } from './seal';
import { clearIndexMemo } from '../indexClient';

// Fabricated courses only: real index data never goes into tests.
const PASS = 'test-client-passphrase';
type Row = [number, string, string | null, string[], number[]];

function keyPair(): { privateKey: crypto.KeyObject; entry: SigningKey } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, entry: { id: keyIdOf(publicKey), publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() } };
}

const signer = keyPair();

/** A release's files: the manifest envelope text and each term's sealed bytes, by asset name. */
function release(terms: Record<string, Row[]>, generatedAt: string, reuse?: Map<string, Buffer>): { manifest: ClientManifest; files: Map<string, Buffer> } {
  const pid = passphraseId(PASS);
  const files = new Map<string, Buffer>();
  const entries = Object.entries(terms).map(([term, courses]) => {
    const json = Buffer.from(JSON.stringify({ format: 1, term, fields: ['id', 'name', 'number', 'teachers', 'sessions'], courses }));
    const sha256 = sha256Hex(json);
    const asset = termAssetName(term, sha256, pid);
    // An unchanged term keeps its file, as on the real release (sealing salts afresh).
    const sealed = reuse?.get(asset) ?? seal(json, PASS);
    files.set(asset, sealed);
    return { term, asset, bytes: sealed.length, assetSha256: sha256Hex(sealed), sha256, courses: courses.length, sessions: 0 };
  });
  const manifest: ClientManifest = { format: 1, generatedAt, passphraseId: pid, terms: entries };
  files.set(CLIENT_MANIFEST_ASSET, Buffer.from(makeEnvelope(CLIENT_MANIFEST_ASSET, seal(Buffer.from(JSON.stringify(manifest)), PASS), pid, signer.privateKey)));
  return { manifest, files };
}

function writeRelease(dir: string, files: Map<string, Buffer>, only?: string[]): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of files) {
    if (name !== CLIENT_MANIFEST_ASSET && only && !only.some((term) => name.startsWith(`term-${term}.`))) continue;
    fs.writeFileSync(path.join(dir, name), bytes);
  }
}

const EARLIER: Row[] = [
  [101, '线性代数', 'K-2024-0101', ['张三'], [9001, 9002]],
  [102, '线性代数（双语）', null, ['李四'], [9003]],
  [103, 'Java程序设计', 'K-2024-0103', ['王五'], []],
];
const CURRENT: Row[] = [[201, '高等数学', 'K-2026-0201', ['赵六'], [9101]]];

let root = '';
let downloadedDir = '';
let bundledDir = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'course-lookup-'));
  downloadedDir = path.join(root, 'downloaded');
  bundledDir = path.join(root, 'bundled');
  clearIndexMemo();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

const localIndex = () => new LocalCourseIndex({ downloadedDir, bundledDir, passphrase: PASS, keys: [signer.entry] });

describe('searchCourses (local, ranked like the online Index)', () => {
  const courses: IndexCourse[] = EARLIER.map(([id, name, number, teachers, sessions]) => ({
    id: String(id), name, number, teachers, sessionIds: sessions.map(String), term: '2024-2025-1',
  }));

  it('needs every word, ranks a name start above a contains, and matches teachers', () => {
    expect(searchCourses('线性代数', '2024-2025-1', courses).map((c) => c.id)).toEqual(['101', '102']);
    expect(searchCourses('线性代数 李四', '2024-2025-1', courses).map((c) => c.id)).toEqual(['102']);
    expect(searchCourses('java 程序', '2024-2025-1', courses).map((c) => c.id)).toEqual(['103']);
    expect(searchCourses('jav', '2024-2025-1', courses).map((c) => c.id)).toEqual(['103']);
    expect(searchCourses('ava', '2024-2025-1', courses)).toEqual([]);
  });

  it('finds an id, a course link or a registrar code in any term, and nothing for an empty query', () => {
    expect(searchCourses('103', '2030-2031-1', [], courses).map((c) => c.id)).toEqual(['103']);
    expect(searchCourses('https://www.yanhekt.cn/course/102', '2030-2031-1', [], courses).map((c) => c.id)).toEqual(['102']);
    expect(searchCourses('k-2024-0101', '2030-2031-1', [], courses).map((c) => c.id)).toEqual(['101']);
    expect(searchCourses('  ', '2024-2025-1', courses)).toEqual([]);
  });
});

describe('LocalCourseIndex', () => {
  it('reads each term from the copy that has it, the newer one when both do', async () => {
    const old = release({ '2024-2025-1': EARLIER }, '2026-10-01T00:00:00.000Z');
    writeRelease(bundledDir, old.files);
    const fresh = release({ '2024-2025-1': [...EARLIER, [104, '数值分析', null, [], [9004]]], '2026-2027-1': CURRENT }, '2026-10-25T00:00:00.000Z');
    writeRelease(downloadedDir, fresh.files);
    const index = localIndex();
    expect((await index.terms()).map((t) => [t.term, t.source])).toEqual([['2026-2027-1', 'downloaded'], ['2024-2025-1', 'downloaded']]);
    expect((await index.termCourses('2024-2025-1'))?.length).toBe(4);
    expect((await index.byNumber('K-2026-0201'))?.id).toBe('201');
    expect((await index.byId('104'))?.term).toBe('2024-2025-1');

    // An app update shipped a fresher bundle than the old download.
    writeRelease(bundledDir, release({ '2024-2025-1': [EARLIER[0]] }, '2026-11-01T00:00:00.000Z').files);
    fs.rmSync(path.join(bundledDir, old.manifest.terms[0].asset));
    index.reset();
    const bundledIndex = localIndex();
    expect((await bundledIndex.terms()).find((t) => t.term === '2024-2025-1')?.source).toBe('bundled');
    expect((await bundledIndex.termCourses('2024-2025-1'))?.map((c) => c.id)).toEqual(['101']);
  });

  it('answers null for a term it does not hold', async () => {
    writeRelease(bundledDir, release({ '2024-2025-1': EARLIER }, '2026-10-01T00:00:00.000Z').files);
    expect(await localIndex().search('2023-2024-1', '线性代数')).toBeNull();
  });
});

/** A lookup over the local index, with Yanhekt and the online Index faked. */
function lookup(options: { current?: string; currentSource?: string; earlierSource?: string; online?: unknown[]; onlineSessions?: number[] } = {}) {
  const apiClient = {
    getAvailableSemesters: vi.fn(async () => [{ id: 7, label: '', labelEn: '', schoolYear: 2026, semester: 1 }]),
    getCourseList: vi.fn(async () => ({ data: [{ id: 201, number: 'K-2026-0201', name_zh: '高等数学（Yanhekt）' }] })),
    getCourseDetail: vi.fn(async () => { throw new Error('offline'); }),
  };
  const configService = {
    getCurrentTermSearchSource: () => options.currentSource ?? 'yanhekt',
    getEarlierTermSearchSource: () => options.earlierSource ?? 'local-then-online',
  };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/sessions')) return new Response(JSON.stringify({ sessions: options.onlineSessions ?? [] }));
    return new Response(JSON.stringify({ total: (options.online ?? []).length, results: options.online ?? [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { lookup: new CourseLookup(localIndex(), apiClient as never, configService as never), apiClient, fetchMock };
}

describe('CourseLookup', () => {
  beforeEach(() => {
    writeRelease(bundledDir, release({ '2024-2025-1': EARLIER }, '2026-10-01T00:00:00.000Z').files);
  });

  it('leaves the current term to Yanhekt by default, and searches an earlier term locally', async () => {
    const { lookup: l, fetchMock } = lookup();
    expect(await l.search('2026-2027-1', '高等数学', 1, 16, 'tok')).toEqual({ ok: false, reason: 'yanhekt' });
    const earlier = await l.search('2024-2025-1', '线性代数', 1, 1, 'tok');
    expect(earlier).toMatchObject({ ok: true, source: 'local', total: 2, page: 1, lastPage: 2 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the online Index for a term this computer does not hold, or always when set to', async () => {
    const online = [{ id: 301, name: '复变函数', number: null, term: '2023-2024-2', teachers: ['钱七'] }];
    const { lookup: l, fetchMock } = lookup({ online });
    expect(await l.search('2023-2024-2', '复变', 1, 16, 'tok')).toMatchObject({ ok: true, source: 'online', courses: [{ id: '301' }] });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/search?q=%E5%A4%8D%E5%8F%98&term=2023-2024-2');

    const onlineOnly = lookup({ earlierSource: 'online', online });
    expect(await onlineOnly.lookup.search('2024-2025-1', '线性代数', 1, 16, 'tok')).toMatchObject({ ok: true, source: 'online' });
  });

  it('says so when the chosen local copy lacks the current term', async () => {
    const { lookup: l } = lookup({ currentSource: 'local' });
    expect(await l.search('2026-2027-1', '高等数学', 1, 16, 'tok')).toEqual({ ok: false, reason: 'local-missing' });
  });

  it('takes session ids from this computer, and online when it has none', async () => {
    const { lookup: l, fetchMock } = lookup({ onlineSessions: [9201, 9202] });
    expect(await l.sessionIds('101', 'tok')).toEqual(['9001', '9002']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await l.sessionIds('103', 'tok')).toEqual(['9201', '9202']);
  });

  it('finds a course by code in its term: Yanhekt for the current term, the index for an earlier one', async () => {
    const { lookup: l, apiClient } = lookup();
    expect(await l.locate({ number: 'K-2026-0201' }, '2026-2027-1', 'tok')).toMatchObject({ kind: 'yanhekt', course: { id: 201 } });
    expect(await l.locate({ number: 'K-2024-0101' }, '2024-2025-1', 'tok')).toMatchObject({ kind: 'index', row: { id: '101', term: '2024-2025-1' } });
    expect(apiClient.getCourseList).toHaveBeenCalledTimes(1);
    // The index row stands when Yanhekt's detail does not answer.
    expect(await l.findCourse({ number: 'K-2024-0101' }, '2024-2025-1', 'tok')).toMatchObject({
      id: '101', number: 'K-2024-0101', name_zh: '线性代数', school_year: '2024-2025', semester: '1',
    });
  });

  it('with an unknown term, tries the current-term source and then the index', async () => {
    const { lookup: l, apiClient } = lookup();
    expect(await l.locate({ id: '102' }, null, 'tok')).toMatchObject({ kind: 'index', row: { id: '102' } });
    expect(apiClient.getCourseList).toHaveBeenCalledTimes(1);
  });

  it('reads nothing without a sign-in: no search, no session ids, no lookups', async () => {
    const { lookup: l, apiClient, fetchMock } = lookup({ currentSource: 'online', onlineSessions: [9201] });
    expect(await l.search('2024-2025-1', '线性代数', 1, 16, null)).toEqual({ ok: false, reason: 'sign-in' });
    expect(await l.search('2026-2027-1', '高等数学', 1, 16, null)).toEqual({ ok: false, reason: 'sign-in' });
    expect(await l.sessionIds('101', null)).toEqual([]);
    expect(await l.locate({ id: '101' }, null, null)).toBeNull();
    expect(await l.findCourse({ number: 'K-2024-0101' }, '2024-2025-1', null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiClient.getCourseList).not.toHaveBeenCalled();
  });

  it('sends the token to the online Index as a Bearer', async () => {
    const { lookup: l, fetchMock } = lookup({ earlierSource: 'online', online: [] });
    await l.search('2024-2025-1', '线性代数', 1, 16, 'tok-1');
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('lets the anonymous yhdl search the index without a Bearer', async () => {
    const { lookup: l, fetchMock } = lookup({ earlierSource: 'online', online: [] });
    expect(await l.search('2024-2025-1', '线性代数', 1, 16, 'anonymous')).toMatchObject({ ok: true, source: 'online' });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(await lookup().lookup.search('2024-2025-1', '线性代数', 1, 16, 'anonymous')).toMatchObject({ ok: true, source: 'local' });
  });
});

describe('CourseIndexUpdater', () => {
  it('downloads the terms it does not hold, writes the manifest, and leaves matching terms to the bundle', async () => {
    const bundled = release({ '2024-2025-1': EARLIER }, '2026-10-01T00:00:00.000Z');
    writeRelease(bundledDir, bundled.files);
    const published = release({ '2024-2025-1': EARLIER, '2026-2027-1': CURRENT, '2026-2027-2': [] }, '2026-10-25T00:00:00.000Z', bundled.files);
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url);
      if (!url.includes('gh-proxy.org')) throw new Error('blocked');
      const name = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
      const bytes = published.files.get(name);
      if (!bytes) throw new Error('HTTP 404');
      return bytes;
    });
    const index = localIndex();
    const updater = new CourseIndexUpdater({
      index,
      enabled: () => false,
      currentTerm: async () => '2026-2027-1',
      keys: [signer.entry],
      fetcher,
    });
    expect(await updater.check()).toEqual({ ok: true, downloaded: ['2026-2027-1'] });
    // GitHub first, then the proxy.
    expect(urls[0]).toBe('https://github.com/bit-admin/Yanhekt-AutoSlides/releases/download/index/client-manifest.json');
    expect(urls[1]).toBe('https://gh-proxy.org/https://github.com/bit-admin/Yanhekt-AutoSlides/releases/download/index/client-manifest.json');
    // The unchanged earlier term is not downloaded again: it is read from the bundle.
    expect((await index.terms()).map((t) => [t.term, t.source])).toEqual([['2026-2027-1', 'downloaded'], ['2024-2025-1', 'bundled']]);
    expect((await index.termCourses('2026-2027-1'))?.map((c) => c.id)).toEqual(['201']);
    // A second check downloads nothing new.
    expect(await updater.check()).toEqual({ ok: true, downloaded: [] });
  });

  it('refuses a manifest signed by another key', async () => {
    const forged = release({ '2026-2027-1': CURRENT }, '2026-10-25T00:00:00.000Z');
    const updater = new CourseIndexUpdater({
      index: localIndex(),
      enabled: () => false,
      currentTerm: async () => '2026-2027-1',
      keys: [keyPair().entry],
      fetcher: async (url) => forged.files.get(decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))) ?? Buffer.alloc(0),
    });
    expect(await updater.check()).toEqual({ ok: false, error: 'manifest signature check failed (unknown-key)' });
    expect(fs.existsSync(path.join(downloadedDir, CLIENT_MANIFEST_ASSET))).toBe(false);
  });

  it('fetchReleaseAsset gives up only when both GitHub and the proxy fail', async () => {
    await expect(fetchReleaseAsset('x', async () => { throw new Error('down'); })).rejects.toThrow('down');
  });
});
