import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import type { PinnedCourse } from '@common/types';
import type { PinSyncBase } from '../configService';
import { PinSyncService } from './pinSyncService';

// Fabricated ids and names throughout.
const ME = 'S0001';
const CURRENT = { schoolYear: 2026, semester: 1 };

interface World {
  pins: PinnedCourse[];
  base: Record<string, PinSyncBase>;
  subscriptions: Set<string>;
  bookmarks: Set<string>;
  yanhe2SignedIn: boolean;
  token: string | null;
  /** Yanhekt rows by id, as the subscription list returns them. */
  yanhektRows: Record<string, { name_zh: string; number?: string; school_year: string; semester: string }>;
  /** aita courses by id. */
  aitaCourses: Record<string, { title: string; courseCode: string; schoolYear: string; semester: string }>;
  /** Registrar number → aita id. */
  aitaByNumber: Record<string, string>;
  calls: string[];
}

function world(partial: Partial<World> = {}): World {
  return {
    pins: [],
    base: {},
    subscriptions: new Set(),
    bookmarks: new Set(),
    yanhe2SignedIn: true,
    token: 'cbiz-token',
    yanhektRows: {},
    aitaCourses: {},
    aitaByNumber: {},
    calls: [],
    ...partial,
  };
}

function service(w: World) {
  const configService = {
    getPinnedRecordedCourses: () => JSON.parse(JSON.stringify(w.pins)),
    setPinnedRecordedCourses: (pins: PinnedCourse[]) => { w.pins = JSON.parse(JSON.stringify(pins)); },
    getPinSyncBase: (badge: string) => w.base[badge] ?? null,
    setPinSyncBase: (badge: string, base: PinSyncBase) => { w.base[badge] = base; },
    getAccountToken: () => w.token,
  };
  const apiClient = {
    getSubscriptionList: vi.fn(async () => ({
      data: [...w.subscriptions].map((id) => ({ id: Number(id), professors: [], ...w.yanhektRows[id] })),
      last_page: 1,
    })),
    subscribeCourse: vi.fn(async (_t: string, id: string) => { w.calls.push(`yanhekt+${id}`); w.subscriptions.add(id); }),
    unsubscribeCourse: vi.fn(async (_t: string, id: string) => { w.calls.push(`yanhekt-${id}`); w.subscriptions.delete(id); }),
    getAvailableSemesters: vi.fn(async () => [{ id: 42, label: '', labelEn: '', ...CURRENT }]),
  };
  const yanhe2Service = {
    isSignedIn: () => w.yanhe2SignedIn,
    getBookmarks: vi.fn(async () => ({
      kind: 'ok',
      data: [...w.bookmarks].map((id) => ({ courseId: id, title: w.aitaCourses[id]?.title ?? '', teachers: [], collectedAt: 0, available: true })),
    })),
    setBookmark: vi.fn(async (_a: string, id: string, on: boolean) => {
      w.calls.push(`yanhe2${on ? '+' : '-'}${id}`);
      if (on) w.bookmarks.add(id);
      else w.bookmarks.delete(id);
      return { kind: 'ok', data: true };
    }),
    getCourseDetail: vi.fn(async (_a: string, q: { courseId: string }) => {
      const c = w.aitaCourses[q.courseId];
      return c ? { kind: 'ok', data: { courseId: q.courseId, teacher: '', college: '', term: '', sessions: [], ...c } } : { kind: 'failed' };
    }),
    findCourseByCode: vi.fn(async (_a: string, key: { courseCode: string }) => {
      const id = w.aitaByNumber[key.courseCode];
      return { kind: 'ok', data: id ? { courseId: id } : null };
    }),
  };
  const twinResolver = { findYanhe2Course: vi.fn(async () => ({ kind: 'no_match' })) };
  const courseLookup = {
    findCourse: vi.fn(async (by: { number: string }) => {
      const id = Object.keys(w.yanhektRows).find((k) => w.yanhektRows[k].number === by.number);
      return id ? { id, professors: [], classrooms: [], college_name: '', participant_count: 0, ...w.yanhektRows[id] } : null;
    }),
  };
  const onChange = vi.fn();
  const svc = new PinSyncService(
    configService as never, apiClient as never, yanhe2Service as never,
    twinResolver as never, courseLookup as never, onChange,
  );
  return { svc, onChange };
}

const NOW_TERM = { school_year: '2026-2027', semester: '1' };
const PAST_TERM = { school_year: '2024-2025', semester: '1' };

describe('PinSyncService', () => {
  it('first sync: pins from both sites join by registrar number and fill the other site in', async () => {
    const w = world({
      subscriptions: new Set(['101']),
      bookmarks: new Set(['9001']),
      yanhektRows: {
        '101': { name_zh: '泛函分析', number: 'N-101', ...NOW_TERM },
        '102': { name_zh: '实变函数', number: 'N-102', ...PAST_TERM },
      },
      aitaCourses: {
        '9001': { title: '实变函数', courseCode: 'N-102', schoolYear: '2024-2025', semester: '1' },
        '9002': { title: '物理实验', courseCode: '', schoolYear: '2026-2027', semester: '1' },
      },
      aitaByNumber: { 'N-101': '9101' },
      pins: [{ id: 'yanhe2:9002', yanhe2Id: '9002', title: '物理实验', owner: ME }],
    });
    const { svc } = service(w);
    await svc.sync(ME);

    const byKey = Object.fromEntries(w.pins.map((p) => [p.id, p]));
    expect(Object.keys(byKey).sort()).toEqual(['101', '102', 'yanhe2:9002']);
    expect(byKey['101'].yanhe2Id).toBe('9101');
    expect(byKey['102'].yanhe2Id).toBe('9001'); // the bookmark, joined to its Yanhekt twin
    expect(byKey['yanhe2:9002'].yanhektMissingAt).toBeGreaterThan(0); // a lab course: no number, no Yanhekt
    // Earlier-term 102 is not subscribed on Yanhekt; everything is bookmarked on aita.
    expect(w.calls.sort()).toEqual(['yanhe2+9002', 'yanhe2+9101']);
    expect(w.base[ME].yanhe2!.sort()).toEqual(['9001', '9002', '9101']);
    expect(w.base[ME].yanhekt).toEqual(['101']);
  });

  it('an unpin made while signed out of Yanhe 2.0 reaches it at the next sync', async () => {
    const w = world({
      pins: [{ id: '101', yanhe2Id: '9101', title: '泛函分析', ...NOW_TERM, owner: ME }],
      subscriptions: new Set(['101']),
      bookmarks: new Set(['9101']),
      base: { [ME]: { yanhekt: ['101'], yanhe2: ['9101'] } },
      yanhektRows: { '101': { name_zh: '泛函分析', number: 'N-101', ...NOW_TERM } },
      yanhe2SignedIn: false,
    });
    const { svc } = service(w);
    svc.remove(ME, '101');
    await svc.sync(ME);
    expect(w.calls).toEqual(['yanhekt-101']);
    expect(w.pins).toEqual([]);

    w.yanhe2SignedIn = true;
    w.calls = [];
    await svc.sync(ME);
    expect(w.calls).toEqual(['yanhe2-9101']);
    expect(w.pins).toEqual([]);
  });

  it('a bookmark removed on the aita website unpins the course and unsubscribes it on Yanhekt', async () => {
    const w = world({
      pins: [{ id: '101', yanhe2Id: '9101', title: '泛函分析', ...NOW_TERM, owner: ME }],
      subscriptions: new Set(['101']),
      bookmarks: new Set(),
      base: { [ME]: { yanhekt: ['101'], yanhe2: ['9101'] } },
      yanhektRows: { '101': { name_zh: '泛函分析', number: 'N-101', ...NOW_TERM } },
    });
    const { svc } = service(w);
    await svc.sync(ME);
    expect(w.pins).toEqual([]);
    expect(w.calls).toEqual(['yanhekt-101']);
  });

  it('pinning from Curriculum keeps the pin aita-only until its Yanhekt twin is found, then rekeys it', async () => {
    const w = world({
      aitaCourses: { '9101': { title: '泛函分析', courseCode: 'N-101', schoolYear: '2026-2027', semester: '1' } },
      yanhektRows: { '101': { name_zh: '泛函分析', number: 'N-101', ...NOW_TERM } },
    });
    const { svc } = service(w);
    svc.toggle(ME, { id: '', yanhe2Id: '9101', title: '泛函分析' });
    expect(w.pins.map((p) => p.id)).toEqual(['yanhe2:9101']);
    await svc.sync(ME);
    expect(w.pins.map((p) => p.id)).toEqual(['101']);
    expect(w.pins[0].yanhe2Id).toBe('9101');
    expect(w.calls.sort()).toEqual(['yanhe2+9101', 'yanhekt+101']);
  });

  it('leaves other accounts\' pins alone', async () => {
    const other: PinnedCourse = { id: '555', title: '别人的课', ...PAST_TERM, owner: 'S0002' };
    const w = world({ pins: [other], yanhe2SignedIn: false });
    const { svc } = service(w);
    await svc.sync(ME);
    expect(w.pins).toEqual([expect.objectContaining({ id: '555', owner: 'S0002' })]);
    expect(w.calls).toEqual([]);
  });

  it('upgrade fills a pin without sending anything', () => {
    const w = world({ pins: [{ id: '101', title: '泛函分析', owner: ME }] });
    const { svc, onChange } = service(w);
    svc.upgrade(ME, { id: '101', title: '泛函分析', number: 'N-101', ...NOW_TERM });
    expect(w.pins[0]).toMatchObject({ id: '101', number: 'N-101', school_year: '2026-2027' });
    expect(onChange).toHaveBeenCalledTimes(1);
    svc.upgrade(ME, { id: '101', title: '泛函分析', number: 'N-101' });
    expect(onChange).toHaveBeenCalledTimes(1); // nothing changed, nothing written
  });
});
