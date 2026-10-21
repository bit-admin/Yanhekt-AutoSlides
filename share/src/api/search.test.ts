import { beforeEach, describe, expect, it } from 'vitest';
import { CAP, courseSessions, search } from './search';
import { isParamError, parseSearchParams, type SearchParams } from './searchParams';
import { addCourse, testDb, type TestDb } from './testDb';

const params = (qs: string): SearchParams => {
  const r = parseSearchParams(new URLSearchParams(qs));
  if (isParamError(r)) throw new Error(r.message);
  return r;
};
const T = 'term=2026-2027-1';
const ids = async (qs: string) => (await search(db, params(qs))).results.map((c) => c.id);

let db: TestDb;

beforeEach(() => {
  db = testDb();
  addCourse(db, {
    id: 101,
    name: '电路分析基础',
    nameEn: 'Fundamentals of Circuits Analysis',
    teachers: [['王一', '实验师'], ['李二', '教授']],
    sessions: [100001, 100002, 100003],
  });
  addCourse(db, { id: 102, name: '电路分析基础', teachers: [['赵三', '讲师']], sessions: [100004] });
  addCourse(db, { id: 90, name: '电路分析基础', year: '2025-2026', semester: 1, teachers: [['王一', '实验师']] });
  addCourse(db, { id: 103, name: '模拟电路', teachers: [['李二', '教授']] });
  addCourse(db, { id: 104, name: 'Java程序设计', nameEn: 'Java Programming', teachers: [['Alex Morgan', '讲师']] });
  addCourse(db, { id: 105, name: '100%_通过', teachers: [] });
});

describe('search', () => {
  it('finds courses by name within the one term searched', async () => {
    const r = await search(db, params(`q=电路分析&${T}`));
    expect(r.total).toBe(2);
    expect(r.results.map((c) => c.id)).toEqual([102, 101]);
    expect(r.truncated).toBe(false);
    expect(await ids('q=电路分析&term=2025-2026-1')).toEqual([90]);
    expect(await ids('q=电路分析&term=2024-2025-2')).toEqual([]);
  });

  it('narrows with more words: every word must match the name or a teacher', async () => {
    const r = await search(db, params(`q=电路 王一&${T}`));
    expect(r.results.map((c) => c.id)).toEqual([101]);
    expect(r.results[0].match.fields.sort()).toEqual(['name', 'teacher']);
  });

  it('matches teachers and Latin words of the name; not English names', async () => {
    expect(await ids(`q=李二&${T}`)).toEqual([101, 103]);
    expect(await ids(`q=java&${T}`)).toEqual([104]);
    expect(await ids(`q=morgan&${T}`)).toEqual([104]);
    expect(await ids(`q=programming&${T}`)).toEqual([]);
    expect(await ids(`q=circuits&${T}`)).toEqual([]);
  });

  it('checks the whole word, not just the looked-up pieces', async () => {
    addCourse(db, { id: 106, name: '大学物理', sessions: [] });
    addCourse(db, { id: 107, name: '物理大学', sessions: [] }); // has 大学 and 物理, not 大学物理
    expect(await ids(`q=大学物理&${T}`)).toEqual([106]);
  });

  it('finds a course by its id or a pasted course link, in any term', async () => {
    expect((await search(db, params(`q=90&${T}`))).results[0]).toMatchObject({ id: 90, term: '2025-2026-1', match: { fields: ['id'] } });
    expect(await ids(`q=${encodeURIComponent('https://www.yanhekt.cn/course/104')}&${T}`)).toEqual([104]);
  });

  it('without a term, looks up only the identifier', async () => {
    db.log.length = 0;
    const r = await search(db, params('q=90'));
    expect(r).toMatchObject({ query: { q: '90', term: null }, total: 1, results: [{ id: 90, term: '2025-2026-1' }] });
    expect(db.log.some((sql) => sql.includes('course_grams WHERE term = ? AND'))).toBe(false);
    addCourse(db, { id: 203, name: '概率论与数理统计B', number: '202620271MTH1000112', year: '2025-2026' });
    expect(await ids('q=202620271mth1000112')).toEqual([203]);
    expect(await ids('q=99999')).toEqual([]);
  });

  it('finds a course by its whole registrar code (Yanhe 2.0 kcwybm), in any term and format', async () => {
    addCourse(db, { id: 201, name: '泛函分析', number: '20262027110099010101' });
    addCourse(db, { id: 202, name: '偏微分方程', number: '20261-03-0309902-1782345678901', year: '2025-2026' });
    addCourse(db, { id: 203, name: '概率论与数理统计B', number: '202620271MTH1000112' });
    for (const [q, id] of [
      ['20262027110099010101', 201],
      ['20261-03-0309902-1782345678901', 202],
      ['202620271mth1000112', 203],
      [' 202620271MTH1000112 ', 203],
    ] as const) {
      const r = await search(db, params(`q=${encodeURIComponent(q)}&${T}`));
      expect(r.results.map((c) => c.id)).toEqual([id]);
      expect(r.results[0].match.fields).toEqual(['number']);
    }
    // Whole strings only, like cbiz's keyword: a prefix of a registrar code is not a match.
    expect(await ids(`q=2026202711009901&${T}`)).not.toContain(201);
  });

  it('treats % and _ in the query literally', async () => {
    expect(await ids(`q=100%25_通过&${T}`)).toEqual([105]);
  });

  it('shapes a result: number, term key, teacher names only, session count', async () => {
    const [c] = (await search(db, params(`q=电路分析&${T}`))).results.filter((x) => x.id === 101);
    expect(c).toEqual({
      id: 101,
      name: '电路分析基础',
      number: '01S01101',
      term: '2026-2027-1',
      teachers: ['王一', '李二'],
      sessionCount: 3,
      match: { fields: ['name'] },
    });
  });

  it('a rare key is read alone; only common keys are intersected', async () => {
    for (let i = 0; i < CAP + 10; i += 1) addCourse(db, { id: 1000 + i, name: `大学英语${i}`, teachers: [['某老师', '讲师']] });
    addCourse(db, { id: 2000, name: '大学英语', teachers: [['孙四美', '讲师']] });

    db.log.length = 0;
    expect(await ids(`q=大学英语 孙四美&${T}`)).toEqual([2000]);
    expect(db.log.some((sql) => sql.includes('INTERSECT'))).toBe(false);

    db.log.length = 0;
    const r = await search(db, params(`q=大学英语&${T}`));
    expect(r.total).toBe(CAP + 11);
    expect(db.log.some((sql) => sql.includes('INTERSECT'))).toBe(true);
  });

  it('never reads the whole courses table', async () => {
    for (let i = 0; i < 200; i += 1) addCourse(db, { id: 3000 + i, name: `其他课程${i}`, teachers: [['某老师', '讲师']] });
    db.rowsReturned = 0;
    expect((await search(db, params(`q=电路分析&${T}`))).total).toBe(2);
    expect(db.rowsReturned).toBeLessThan(10);
  });

  it('returns an empty list, not an error, when nothing matches', async () => {
    expect(await search(db, params(`q=量子场论&${T}`))).toMatchObject({ total: 0, results: [] });
  });
});

describe('courseSessions', () => {
  it('lists a course’s session ids, or null for an unknown course', async () => {
    expect(await courseSessions(db, 101)).toEqual({ course: 101, sessions: [100001, 100002, 100003] });
    expect(await courseSessions(db, 103)).toEqual({ course: 103, sessions: [] });
    expect(await courseSessions(db, 999)).toBeNull();
  });
});
