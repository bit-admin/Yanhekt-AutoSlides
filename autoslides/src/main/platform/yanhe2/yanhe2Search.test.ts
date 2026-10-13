import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { routeYanhe2Through, type Yanhe2Send } from './yanhe2Http';
import {
  fetchYanhe2CourseByCode,
  fetchYanhe2CourseSearch,
  fetchYanhe2Terms,
  parseCourseSearch,
  parseTerms,
  pickCourseByCode,
} from './yanhe2Search';

const term = (id: unknown, extra: Record<string, unknown> = {}) => ({
  id,
  term_name: '2026-2027-1',
  year: '2026-2027',
  season: '1',
  begin_date: '2026-08-31',
  end_date: '2027-01-24',
  current: false,
  ...extra,
});

const row = (id: unknown, extra: Record<string, unknown> = {}) => ({
  id,
  title: '泛函分析',
  realname: 'teacher',
  username: '6120100001',
  kcwybm: '20262027110017113901',
  course_code: '20262027110017113901',
  information: '{"kcdm":"100171139","kkxn":"2026-2027","kkxq":"1","kcwybm":"20262027110017113901"}',
  term: '_42_',
  term_name: '2026-2027-1',
  kkxy_name: '数学与统计学院',
  ...extra,
});

const searchBody = (list: unknown, total: unknown = '1') => ({ code: 0, msg: 'success', data: { total, list } });

describe('parseTerms', () => {
  it('reads fall and spring terms, and the running one', () => {
    const parsed = parseTerms({
      code: 0,
      msg: '获取学期列表成功',
      total: '2',
      list: [
        term(42, { current: true }),
        term(38, { term_name: '2025-2026-2', year: '2025-2026', season: '2' }),
      ],
    });
    expect(parsed).toEqual([
      { id: 42, name: '2026-2027-1', schoolYear: 2026, semester: 1, current: true },
      { id: 38, name: '2025-2026-2', schoolYear: 2025, semester: 2, current: false },
    ]);
  });

  it('leaves out a term that is neither fall nor spring', () => {
    const parsed = parseTerms({ code: 0, list: [term(14, { term_name: '2021-2022试用', year: '2021-2022', season: '试用' })] });
    expect(parsed).toEqual([]);
  });

  it('drops rows without a usable id or name, and refuses another envelope', () => {
    expect(parseTerms({ code: 0, list: [term('x'), term(0), term(7, { term_name: '' }), null] })).toEqual([]);
    expect(parseTerms({ success: true, result: { code: 200, list: [term(42)] } })).toBeNull();
    expect(parseTerms({ code: -1, msg: 'no' })).toBeNull();
  });
});

describe('parseCourseSearch', () => {
  it('reads a row into the Curriculum course shape, with the string total', () => {
    expect(parseCourseSearch(searchBody([row('103690')], '8'))).toEqual({
      total: 8,
      courses: [{
        courseId: '103690',
        title: '泛函分析',
        teacher: 'teacher',
        college: '数学与统计学院',
        term: '2026-2027-1',
        schoolYear: '2026-2027',
        semester: '1',
        courseCode: '20262027110017113901',
      }],
    });
  });

  it('takes course_code when a hand-made row has no kcwybm, and a null college as none', () => {
    const parsed = parseCourseSearch(searchBody([
      row('63030', { kcwybm: '', course_code: 'hand_1769071367_598', information: '', kkxy_name: null, term_name: '2021-2022试用' }),
    ]));
    expect(parsed?.courses[0]).toMatchObject({
      courseCode: 'hand_1769071367_598',
      college: '',
      schoolYear: '',
      semester: '',
    });
  });

  it('reads the term off its name when information does not carry it', () => {
    const parsed = parseCourseSearch(searchBody([
      row('50426', { information: '{"zhiyuan_id":788}', term_name: '2025-2026-1' }),
    ]));
    expect(parsed?.courses[0]).toMatchObject({ term: '2025-2026-1', schoolYear: '2025-2026', semester: '1' });
  });

  it('answers no match with an empty page, and refuses another shape', () => {
    expect(parseCourseSearch(searchBody([], '0'))).toEqual({ courses: [], total: 0 });
    expect(parseCourseSearch(searchBody([row('abc'), row('')], '2'))).toEqual({ courses: [], total: 2 });
    expect(parseCourseSearch({ code: 0, data: [] })).toBeNull();
    expect(parseCourseSearch({ code: -1, msg: '没有数据' })).toBeNull();
  });
});

describe('search requests', () => {
  afterEach(() => routeYanhe2Through((config) => axios.request(config)));

  const capture = (data: unknown) => {
    const send = vi.fn<Yanhe2Send>(async () => ({ status: 200, data }) as never);
    routeYanhe2Through(send);
    return () => new URL(send.mock.calls[0][0].url);
  };

  it('sends the bare term id, and no term at all for every term', async () => {
    let url = capture(searchBody([row('103690')]));
    const result = await fetchYanhe2CourseSearch('jwt', { keyword: '泛函', termId: 42, page: 2 });
    expect(result.kind).toBe('ok');
    expect(url().pathname).toBe('/courseapi/v3/multi-search/get-course-list');
    expect(Object.fromEntries(url().searchParams)).toEqual({
      tenant: '21',
      title: '泛函',
      page: '2',
      per_page: '16',
      term: '42',
    });

    url = capture(searchBody([]));
    await fetchYanhe2CourseSearch('jwt', { keyword: '', termId: null, page: 1 });
    expect(url().searchParams.has('term')).toBe(false);
    expect(url().searchParams.get('title')).toBe('');
  });

  it('reads the terms from the path without index.php', async () => {
    const url = capture({ code: 0, total: '1', list: [term(42, { current: true })] });
    const result = await fetchYanhe2Terms('jwt');
    expect(result).toEqual({
      kind: 'ok',
      data: [{ id: 42, name: '2026-2027-1', schoolYear: 2026, semester: 1, current: true }],
    });
    expect(url().pathname).toBe('/courseapi/v2/schedule/search-term');
  });
});

describe('finding a course by its number', () => {
  afterEach(() => routeYanhe2Through((config) => axios.request(config)));

  const KEY = { courseCode: 'K-1', title: '大学物理实验', teachers: ['teacher-a', 'teacher-b'], termName: '2026-2027-1' };
  const termsBody = { code: 0, total: '1', list: [term(42, { current: true })] };

  /** Answers each request from its query; records the searches made. */
  const serve = (answer: (params: URLSearchParams) => unknown) => {
    const searches: string[] = [];
    routeYanhe2Through(vi.fn<Yanhe2Send>(async (config) => {
      const url = new URL(config.url);
      if (url.pathname.endsWith('/search-term')) return { status: 200, data: termsBody } as never;
      searches.push(`${url.searchParams.get('title')}#${url.searchParams.get('page')}@${url.searchParams.get('term')}/${url.searchParams.get('per_page')}`);
      return { status: 200, data: answer(url.searchParams) } as never;
    }));
    return searches;
  };

  it('takes the one row with that number, never two', () => {
    const a = { courseId: '1', courseCode: 'K-1' } as never;
    const b = { courseId: '2', courseCode: 'K-2' } as never;
    expect(pickCourseByCode([a, b], 'K-1')).toBe(a);
    expect(pickCourseByCode([a, a], 'K-1')).toBeNull();
    expect(pickCourseByCode([a, b], '')).toBeNull();
  });

  it('finds it by name in the course term with one search', async () => {
    const searches = serve(() => searchBody([row('7', { kcwybm: 'K-0' }), row('8', { kcwybm: 'K-1' })], '2'));
    const found = await fetchYanhe2CourseByCode('jwt', KEY);
    expect(found).toMatchObject({ kind: 'ok', data: { courseId: '8', courseCode: 'K-1' } });
    expect(searches).toEqual(['大学物理实验#1@42/200']);
  });

  it('says none when the name is not there, without reading further', async () => {
    const searches = serve(() => searchBody([row('7', { kcwybm: 'K-0' })], '1'));
    expect(await fetchYanhe2CourseByCode('jwt', KEY)).toEqual({ kind: 'ok', data: null });
    expect(searches).toHaveLength(1);
  });

  it('tries the teachers before paging through a name with many sections', async () => {
    const searches = serve((params) =>
      params.get('title') === 'teacher-b'
        ? searchBody([row('9', { kcwybm: 'K-1' })], '1')
        : searchBody([row('7', { kcwybm: 'K-0' })], params.get('title') === KEY.title ? '2024' : '1'));
    const found = await fetchYanhe2CourseByCode('jwt', KEY);
    expect(found).toMatchObject({ kind: 'ok', data: { courseId: '9' } });
    expect(searches).toEqual(['大学物理实验#1@42/200', 'teacher-a#1@42/200', 'teacher-b#1@42/200']);
  });

  it('reads on through the name when the teachers do not have it, up to the cap', async () => {
    let searches = serve((params) =>
      params.get('title') === KEY.title && params.get('page') === '3'
        ? searchBody([row('9', { kcwybm: 'K-1' })], '2024')
        : searchBody([row('7', { kcwybm: 'K-0' })], '2024'));
    expect(await fetchYanhe2CourseByCode('jwt', KEY)).toMatchObject({ kind: 'ok', data: { courseId: '9' } });
    expect(searches.slice(3)).toEqual(['大学物理实验#2@42/200', '大学物理实验#3@42/200']);

    searches = serve(() => searchBody([row('7', { kcwybm: 'K-0' })], '99999'));
    expect(await fetchYanhe2CourseByCode('jwt', KEY)).toEqual({ kind: 'ok', data: null });
    // The first page, two teachers, then pages 2–10.
    expect(searches).toHaveLength(12);
  });

  it('searches every term when aita does not list the course term', async () => {
    const searches = serve(() => searchBody([row('8', { kcwybm: 'K-1' })], '1'));
    await fetchYanhe2CourseByCode('jwt', { ...KEY, termName: '2019-2020-1' });
    expect(searches).toEqual(['大学物理实验#1@null/200']);
  });
});
