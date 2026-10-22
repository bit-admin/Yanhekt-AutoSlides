import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => '', getPath: () => '' } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { CourseSnapshotService, normalizeForMatch, parseRow } from './courseSnapshot';

// Fabricated courses only: the real snapshot never goes into tests.
const COURSES = [
  [101, '线性代数', ['张三']],
  [102, '线性代数（双语）', ['李四', '王五']],
  [103, '高等数学 Ⅱ', ['张三']],
  [104, '数据结构', []],
  [105, 'Linear Algebra Lab', ['Ada']],
  ['bad', '没有数字编号', []],
];

let root = '';
let builtin = '';
let imported = '';
let inbox = '';
let service: CourseSnapshotService;

const write = (dir: string, name: string, data: unknown, gz = true) => {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const file = path.join(dir, name);
  fs.writeFileSync(file, gz ? gzipSync(text) : text);
  return file;
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'course-snapshot-'));
  builtin = path.join(root, 'builtin');
  imported = path.join(root, 'imported');
  inbox = path.join(root, 'inbox');
  fs.mkdirSync(builtin);
  fs.mkdirSync(inbox);
  write(builtin, '2023-2024-1.json.gz', COURSES);
  write(builtin, '2023-2024-2.json.gz', 'not gzip', false);
  service = new CourseSnapshotService({ builtin: () => builtin, imported: () => imported });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('CourseSnapshotService search', () => {
  it('lists the whole term newest first for an empty keyword, skipping malformed rows', async () => {
    const page = await service.search('2023-2024-1', '');
    expect(page?.total).toBe(5);
    expect(page?.data.map((r) => r.id)).toEqual(['105', '104', '103', '102', '101']);
  });

  it('ranks an exact name first, then name matches, then teacher-only matches', async () => {
    expect((await service.search('2023-2024-1', '线性代数'))?.data.map((r) => r.id)).toEqual(['101', '102']);
    expect((await service.search('2023-2024-1', '张三'))?.data.map((r) => r.id)).toEqual(['103', '101']);
  });

  it('needs every word in the name or a teacher, ignoring case, width and spaces', async () => {
    expect((await service.search('2023-2024-1', '线性 王五'))?.data.map((r) => r.id)).toEqual(['102']);
    expect((await service.search('2023-2024-1', '高等数学II'))?.data.map((r) => r.id)).toEqual(['103']);
    expect((await service.search('2023-2024-1', 'linear algebra'))?.data.map((r) => r.id)).toEqual(['105']);
  });

  it('pages and clamps the page number', async () => {
    const page = await service.search('2023-2024-1', '', 9, 2);
    expect(page).toMatchObject({ total: 5, current_page: 3, last_page: 3 });
    expect(page?.data.map((r) => r.id)).toEqual(['101']);
  });

  it('answers null for a term it does not have, an unreadable file, or a bad key', async () => {
    expect(await service.search('2019-2020-1', '')).toBeNull();
    expect(await service.search('2023-2024-2', '')).toBeNull();
    expect(await service.search('../2023-2024-1', '')).toBeNull();
    expect(await service.search('2023-2025-1', '')).toBeNull();
  });
});

describe('CourseSnapshotService import', () => {
  it('imports .json.gz and .json files, and an imported term replaces the built-in one', async () => {
    const result = await service.importFiles([
      write(inbox, '2023-2024-1.json', [[201, '复变函数', ['赵六']]], false),
      write(inbox, '2019-2020-2.json.gz', [[9, '旧课程', []], ['7', ' 两个  空格 ', ['甲']]]),
    ]);
    expect(result).toEqual({
      imported: [{ term: '2023-2024-1', courses: 1 }, { term: '2019-2020-2', courses: 2 }],
      rejected: [],
    });
    expect((await service.search('2023-2024-1', ''))?.data.map((r) => r.id)).toEqual(['201']);
    // Rewritten canonical: gzip, ids ascending, whitespace folded.
    const stored = JSON.parse(gunzipSync(fs.readFileSync(path.join(imported, '2019-2020-2.json.gz'))).toString());
    expect(stored).toEqual([[7, '两个 空格', ['甲']], [9, '旧课程', []]]);
    expect(await service.list()).toEqual([
      { term: '2023-2024-1', courses: 1, source: 'imported', replacesBuiltin: true },
      { term: '2019-2020-2', courses: 2, source: 'imported', replacesBuiltin: false },
    ]);
  });

  it('rejects a wrong name, a wrong shape or an empty list, and still imports the rest', async () => {
    const result = await service.importFiles([
      write(inbox, 'courses.json.gz', COURSES),
      write(inbox, '2020-2021-1.json.gz', { courses: [] }),
      write(inbox, '2020-2021-2.json.gz', [[1, '课程', '不是数组']]),
      write(inbox, '2021-2022-1.json.gz', []),
      write(inbox, '2021-2022-2.json.gz', [[3, '课程', ['甲']]]),
    ]);
    expect(result.imported).toEqual([{ term: '2021-2022-2', courses: 1 }]);
    expect(result.rejected).toEqual([
      { file: 'courses.json.gz', reason: 'name' },
      { file: '2020-2021-1.json.gz', reason: 'format' },
      { file: '2020-2021-2.json.gz', reason: 'format' },
      { file: '2021-2022-1.json.gz', reason: 'empty' },
    ]);
  });

  it('falls back to the built-in term once the imported folder is gone and reset() runs', async () => {
    await service.importFiles([write(inbox, '2023-2024-1.json.gz', [[201, '复变函数', []]])]);
    expect((await service.search('2023-2024-1', ''))?.total).toBe(1);
    fs.rmSync(imported, { recursive: true, force: true });
    service.reset();
    expect((await service.search('2023-2024-1', ''))?.total).toBe(5);
    expect(await service.list()).toEqual([{ term: '2023-2024-1', courses: 5, source: 'builtin', replacesBuiltin: false }]);
  });
});

describe('parseRow', () => {
  it('accepts numeric or digit-string ids and a missing teacher list', () => {
    expect(parseRow([12, '课程'])).toEqual({ id: '12', name: '课程', teachers: [] });
    expect(parseRow(['0012', '课程', ['甲', '']])).toEqual({ id: '12', name: '课程', teachers: ['甲'] });
    expect(parseRow({ id: 1 })).toBeNull();
    expect(parseRow([1, ''])).toBeNull();
  });
});

describe('normalizeForMatch', () => {
  it('folds width, case and whitespace', () => {
    expect(normalizeForMatch(' Ｃ语言 Ⅱ ')).toBe('c语言ii');
  });
});
