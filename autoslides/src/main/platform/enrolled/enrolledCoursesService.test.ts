import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import type { EnrolledCourse } from '@common/types';
import type { EnrolledSync } from '../configService';
import { EnrolledCoursesService, orderEnrolled } from './enrolledCoursesService';

// Fabricated ids and names throughout.
const ME = 'S0001';
const DAY = 24 * 60 * 60 * 1000;

interface YanhektCourse { name_zh: string; number?: string; school_year: string; semester: string }
interface AitaCourse { title: string; courseCode: string; schoolYear: string; semester: string; detailCode?: string }

interface World {
  stored: EnrolledCourse[];
  sync: Record<string, EnrolledSync>;
  /** Yanhekt's enrolled list (current term only), ids in order. */
  enrolled: string[];
  enrolledFails: boolean;
  yanhekt: Record<string, YanhektCourse>;
  /** My Courses, in aita's order. */
  aita: Record<string, AitaCourse>;
  yanhe2SignedIn: boolean;
  /** Numbers whose lookup throws (a network failure). */
  failingNumbers: Set<string>;
  calls: string[];
}

function world(partial: Partial<World> = {}): World {
  return {
    stored: [],
    sync: {},
    enrolled: [],
    enrolledFails: false,
    yanhekt: {},
    aita: {},
    yanhe2SignedIn: true,
    failingNumbers: new Set(),
    calls: [],
    ...partial,
  };
}

const rowOf = (w: World, id: string) => ({ id, professors: [], classrooms: [], college_name: '', participant_count: 0, ...w.yanhekt[id] });

function service(w: World) {
  const configService = {
    getAccountToken: () => 'cbiz-token',
    getEnrolledCourses: () => JSON.parse(JSON.stringify(w.stored)),
    setEnrolledCourses: (list: EnrolledCourse[]) => { w.stored = JSON.parse(JSON.stringify(list)); },
    getEnrolledSync: (badge: string) => JSON.parse(JSON.stringify(w.sync[badge] ?? { aitaReadAt: 0, twins: {} })),
    setEnrolledSync: (badge: string, sync: EnrolledSync) => { w.sync[badge] = JSON.parse(JSON.stringify(sync)); },
  };
  const apiClient = {
    getPersonalCourseList: vi.fn(async () => {
      w.calls.push('yanhekt:enrolled');
      if (w.enrolledFails) throw new Error('offline');
      return { data: w.enrolled.map((id) => rowOf(w, id)), last_page: 1, current_page: 1 };
    }),
    getAvailableSemesters: vi.fn(async () => [{ id: 42, label: '', labelEn: '', schoolYear: 2026, semester: 1 }]),
  };
  const yanhe2Service = {
    isSignedIn: () => w.yanhe2SignedIn,
    getMyCourses: vi.fn(async () => {
      w.calls.push('aita:mine');
      return { kind: 'ok', data: Object.entries(w.aita).map(([courseId, c]) => ({ courseId, teacher: '', college: '', term: '', ...c })) };
    }),
    getCourseDetail: vi.fn(async (_a: string, q: { courseId: string }) => {
      w.calls.push(`aita:detail:${q.courseId}`);
      const c = w.aita[q.courseId];
      return { kind: 'ok', data: { courseId: q.courseId, teacher: '', college: '', term: '', sessions: [], ...c, courseCode: c.detailCode ?? c.courseCode } };
    }),
  };
  const courseLookup = {
    findCourse: vi.fn(async (by: { number: string }) => {
      w.calls.push(`lookup:${by.number}`);
      if (w.failingNumbers.has(by.number)) throw new Error('offline');
      const id = Object.keys(w.yanhekt).find((k) => w.yanhekt[k].number === by.number);
      return id ? rowOf(w, id) : null;
    }),
  };
  const onChange = vi.fn();
  const svc = new EnrolledCoursesService(configService as never, apiClient as never, yanhe2Service as never, courseLookup as never, onChange);
  const refresh = async () => {
    const result = await svc.refresh(ME);
    await svc.whenIdle(ME);
    return result;
  };
  return { svc, refresh, onChange };
}

const NOW = { school_year: '2026-2027', semester: '1' };
const SPRING = { school_year: '2025-2026', semester: '2' };
const FALL = { school_year: '2025-2026', semester: '1' };

const ids = (w: World) => w.stored.filter((c) => c.owner === ME).map((c) => c.id);

afterEach(() => vi.useRealTimers());

describe('EnrolledCoursesService', () => {
  it('fills earlier terms from My Courses, newest term first, and drops courses Yanhekt lacks', async () => {
    const w = world({
      enrolled: ['101', '102'],
      yanhekt: {
        '101': { name_zh: '泛函分析', number: 'N-101', ...NOW },
        '102': { name_zh: '数理统计', number: 'N-102', ...NOW },
        '201': { name_zh: '实变函数', number: 'N-201', ...SPRING },
        '301': { name_zh: '常微分方程', number: 'N-301', ...FALL },
      },
      aita: {
        '9101': { title: '泛函分析', courseCode: 'N-101', schoolYear: '2026-2027', semester: '1' },
        '9201': { title: '实变函数', courseCode: 'N-201', schoolYear: '2025-2026', semester: '2' },
        '9202': { title: '物理实验', courseCode: 'N-LAB', schoolYear: '2025-2026', semester: '2' },
        // My Courses leaves the number out; the detail has it.
        '9301': { title: '常微分方程', courseCode: '', detailCode: 'N-301', schoolYear: '2025-2026', semester: '1' },
      },
    });
    const { refresh } = service(w);
    expect(await refresh()).toEqual({ kind: 'ok' });

    expect(ids(w)).toEqual(['101', '102', '201', '301']);
    // The current term is not looked up; its aita course is joined by number.
    expect(w.calls.filter((c) => c.startsWith('lookup:') || c.startsWith('aita:detail'))).toEqual([
      'lookup:N-201', 'lookup:N-LAB', 'aita:detail:9301', 'lookup:N-301',
    ]);
    expect(w.sync[ME].twins).toMatchObject({
      '9101': { yanhektId: '101' },
      '9201': { yanhektId: '201' },
      '9202': { yanhektId: null },
      '9301': { yanhektId: '301' },
    });
    expect(w.sync[ME].aitaReadAt).toBeGreaterThan(0);
    expect(w.stored.find((c) => c.id === '201')?.yanhe2Id).toBe('9201');
  });

  it('within a day only the current term is read; after a day nothing known is looked up again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T08:00:00Z'));
    const w = world({
      enrolled: ['101'],
      yanhekt: {
        '101': { name_zh: '泛函分析', number: 'N-101', ...NOW },
        '201': { name_zh: '实变函数', number: 'N-201', ...SPRING },
      },
      aita: {
        '9201': { title: '实变函数', courseCode: 'N-201', schoolYear: '2025-2026', semester: '2' },
        '9202': { title: '物理实验', courseCode: 'N-LAB', schoolYear: '2025-2026', semester: '2' },
      },
    });
    const { refresh } = service(w);
    await refresh();
    w.calls = [];

    await refresh();
    expect(w.calls).toEqual(['yanhekt:enrolled']);
    expect(ids(w)).toEqual(['101', '201']);

    vi.setSystemTime(Date.now() + DAY + 1);
    w.calls = [];
    await refresh();
    expect(w.calls).toEqual(['yanhekt:enrolled', 'aita:mine']);
    expect(ids(w)).toEqual(['101', '201']);

    // A course found missing is looked for again after a month.
    vi.setSystemTime(Date.now() + 31 * DAY);
    w.calls = [];
    await refresh();
    expect(w.calls).toEqual(['yanhekt:enrolled', 'aita:mine', 'lookup:N-LAB']);
  });

  it('a lookup that fails is not recorded, and My Courses is read again at the next visit', async () => {
    const w = world({
      yanhekt: { '201': { name_zh: '实变函数', number: 'N-201', ...SPRING } },
      aita: { '9201': { title: '实变函数', courseCode: 'N-201', schoolYear: '2025-2026', semester: '2' } },
      failingNumbers: new Set(['N-201']),
    });
    const { refresh } = service(w);
    await refresh();
    expect(ids(w)).toEqual([]);
    expect(w.sync[ME].twins['9201']).toBeUndefined();
    expect(w.sync[ME].aitaReadAt).toBe(0);

    w.failingNumbers.clear();
    await refresh();
    expect(ids(w)).toEqual(['201']);
  });

  it('when the term rolls over, last term\'s courses stay without a lookup', async () => {
    const w = world({
      enrolled: ['101'],
      yanhekt: { '101': { name_zh: '泛函分析', number: 'N-101', ...SPRING } },
      aita: { '9101': { title: '泛函分析', courseCode: 'N-101', schoolYear: '2025-2026', semester: '2' } },
      // Last term was current: its row came from Yanhekt and was joined by number.
      stored: [{ id: '101', yanhe2Id: '9101', title: '泛函分析', number: 'N-101', ...SPRING, owner: ME }],
      sync: { [ME]: { aitaReadAt: 0, twins: { '9101': { yanhektId: '101', checkedAt: 1 } } } },
    });
    w.enrolled = []; // the new term has not started on Yanhekt's list
    const { refresh } = service(w);
    await refresh();
    expect(ids(w)).toEqual(['101']);
    expect(w.calls.some((c) => c.startsWith('lookup:'))).toBe(false);
  });

  it('keeps the stored list when Yanhekt cannot be reached, and other accounts\' rows always', async () => {
    const other: EnrolledCourse = { id: '555', title: '别人的课', ...NOW, owner: 'S0002' };
    const mine: EnrolledCourse = { id: '101', title: '泛函分析', ...NOW, owner: ME };
    const w = world({ stored: [mine, other], enrolledFails: true, yanhe2SignedIn: false });
    const { refresh } = service(w);
    expect(await refresh()).toEqual({ kind: 'ok' });
    expect(w.stored.map((c) => c.id).sort()).toEqual(['101', '555']);

    const empty = world({ enrolledFails: true, yanhe2SignedIn: false });
    expect(await service(empty).refresh()).toEqual({ kind: 'failed', message: 'offline' });
  });

  it('orders newest term first and keeps the order within a term', () => {
    const c = (id: string, t: { school_year: string; semester: string }) => ({ id, title: id, ...t, owner: ME });
    expect(orderEnrolled([c('a', FALL), c('b', NOW), c('c', SPRING), c('d', NOW)]).map((x) => x.id))
      .toEqual(['b', 'd', 'c', 'a']);
  });
});
