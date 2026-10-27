import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseData } from '@common/apiTypes';
import type { EnrolledCourse, EnrolledRefreshResult } from '@common/types';
import { appMineCommand } from '../app/lookups';
import type { AppCommandContext } from '../app/types';
import type { CliContext, CommandInput } from '../types';
import { mineCommand } from './mine';

vi.mock('../terminal', () => ({ info: vi.fn() }));

const TOKEN = 'a'.repeat(32);
const OTHER_TOKEN = 'b'.repeat(32);
const OWNER = '0000000000';
const OTHER = '0000000001';
const accounts = [
  { badge: OWNER, displayName: 'Alice', nickname: '', token: TOKEN },
  { badge: OTHER, displayName: 'Bob', nickname: '', token: OTHER_TOKEN },
];
const current: EnrolledCourse = {
  id: '70101', title: '示例课程', titleEn: 'Example Course', owner: OWNER,
  school_year: '2026-2027', semester: '1', professors: ['示例教师'],
  college_name: '示例学院', classrooms: [{ name: '示例教室' }], participant_count: 12,
};
const earlier: EnrolledCourse = {
  id: '70102', title: '往期示例课程', owner: OWNER, school_year: '2025-2026', semester: '2',
};
const other: EnrolledCourse = { ...current, id: '70103', owner: OTHER };
const live: CourseData = {
  id: '70104', name_zh: '服务器示例课程', professors: [], classrooms: [],
  school_year: '2026-2027', semester: '1', college_name: '', participant_count: 0,
};

function world(stored: EnrolledCourse[] = []) {
  let courses = stored;
  const configService = {
    getConfig: () => ({ accounts }),
    getAuthToken: () => TOKEN,
    getEnrolledCourses: vi.fn(() => courses),
  };
  const getPersonalCourseList = vi.fn(async () => ({
    data: [live], current_page: 1, last_page: 1, total: 1,
  }));
  const refresh = vi.fn((_owner: string): Promise<EnrolledRefreshResult> => Promise.resolve({ kind: 'ok' }));
  const deps = {
    configService,
    apiClient: { getPersonalCourseList },
    enrolledCoursesService: { refresh },
    renderer: { request: vi.fn(async () => ({ signedIn: true })) },
    term: { info: vi.fn() },
  };
  return {
    deps, getPersonalCourseList, refresh,
    terminal: deps as unknown as CliContext,
    app: deps as unknown as AppCommandContext,
    setStored: (next: EnrolledCourse[]) => { courses = next; },
  };
}

const input = (program: string, options: CommandInput['options'] = {}): CommandInput => ({
  program, options, positionals: [], json: true,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllEnvs());

describe('yhdl mine', () => {
  it('reads only the selected account cache, without requests or writes', async () => {
    const w = world([current, earlier, other]);
    const result = await mineCommand.run(input('yhdl', { account: 'Alice' }), w.terminal);
    expect(result.data).toEqual({
      page: 1, last_page: 1, total: 2,
      courses: [
        {
          id: '70101', title: current.title, title_en: 'Example Course', professors: ['示例教师'],
          college: '示例学院', term: '2026-2027-1', classrooms: ['示例教室'], participants: 12,
        },
        {
          id: '70102', title: earlier.title, title_en: null, professors: [],
          college: null, term: '2025-2026-2', classrooms: [], participants: null,
        },
      ],
      auth: { source: 'account', account: 'Alice' },
    });
    expect(result.text).toContain(earlier.title);
    expect(JSON.stringify(result.data)).not.toContain('owner');
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
    expect(w.refresh).not.toHaveBeenCalled();
  });

  it('paginates the whole cached list locally, including an out-of-range page', async () => {
    const w = world([current, earlier, other]);
    const result = await mineCommand.run(input('yhdl', { account: 'Alice', limit: '1', page: '2' }), w.terminal);
    expect(result.data).toMatchObject({ page: 2, last_page: 2, total: 2, courses: [{ id: earlier.id }] });
    const empty = await mineCommand.run(input('yhdl', { account: 'Alice', limit: '1', page: '3' }), w.terminal);
    expect(empty.data).toMatchObject({ page: 3, last_page: 2, total: 2, courses: [] });
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
  });

  it('uses a different saved account rather than the active account cache', async () => {
    const w = world([current, earlier, other]);
    const result = await mineCommand.run(input('yhdl', { account: 'Bob' }), w.terminal);
    expect(result.data).toMatchObject({ total: 1, courses: [{ id: other.id }], auth: { account: 'Bob' } });
  });

  it.each(['flag', 'env', 'app'])('uses the cache when the %s token matches a saved account', async (source) => {
    vi.stubEnv('YANHEKT_TOKEN', source === 'env' ? TOKEN : '');
    const w = world([current, earlier]);
    const result = await mineCommand.run(input('yhdl', source === 'flag' ? { token: TOKEN } : {}), w.terminal);
    expect(result.data).toMatchObject({ total: 2, auth: { source, account: 'Alice' } });
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
  });

  it('falls back to Yanhekt when that account has no cached courses, without building', async () => {
    const w = world([other]);
    const result = await mineCommand.run(input('yhdl', { account: 'Alice', page: '2', limit: '5' }), w.terminal);
    expect(result.data).toMatchObject({ courses: [{ id: live.id }] });
    expect(w.getPersonalCourseList).toHaveBeenCalledWith(TOKEN, { page: 2, pageSize: 5 });
    expect(w.refresh).not.toHaveBeenCalled();
  });

  it('never borrows the active account cache for an unknown token', async () => {
    const w = world([current, earlier]);
    const token = 'c'.repeat(32);
    const result = await mineCommand.run(input('yhdl', { token }), w.terminal);
    expect(result.data).toMatchObject({ courses: [{ id: live.id }], auth: { source: 'flag', account: null } });
    expect(w.getPersonalCourseList).toHaveBeenCalledWith(token, { page: 1, pageSize: 20 });
    expect(w.deps.configService.getEnrolledCourses).not.toHaveBeenCalled();
  });

  it('keeps the unauthenticated bare-array response and empty note', async () => {
    const w = world();
    w.getPersonalCourseList.mockResolvedValue([] as never);
    const result = await mineCommand.run(input('yhdl', { account: 'Alice' }), w.terminal);
    expect(result.data).toMatchObject({ courses: [], total: 0, note: expect.stringContaining('token is no longer valid') });
    expect(w.refresh).not.toHaveBeenCalled();
  });
});

describe('autoslides mine', () => {
  it('returns cached courses while the app refresh is still pending', async () => {
    const w = world([current, earlier, other]);
    const pending = deferred<EnrolledRefreshResult>();
    w.refresh.mockReturnValue(pending.promise);
    const result = await appMineCommand.serve(input('autoslides'), w.app);
    expect(result.data).toMatchObject({
      total: 2, courses: [{ id: current.id }, { id: earlier.id }], account: { name: 'Alice', badge: OWNER },
    });
    expect(w.refresh).toHaveBeenCalledWith(OWNER);
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
    pending.resolve({ kind: 'ok' });
  });

  it('on a cold cache waits only for the refresh first phase and does not refetch', async () => {
    const w = world([other]);
    const first = deferred<EnrolledRefreshResult>();
    w.refresh.mockReturnValue(first.promise);
    const result = appMineCommand.serve(input('autoslides'), w.app);
    await vi.waitFor(() => expect(w.refresh).toHaveBeenCalledWith(OWNER));
    w.setStored([current, other]);
    first.resolve({ kind: 'ok' });
    expect((await result).data).toMatchObject({ total: 1, courses: [{ id: current.id }] });
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
    // Later background writes are visible on the next invocation.
    w.setStored([current, earlier, other]);
    expect((await appMineCommand.serve(input('autoslides'), w.app)).data).toMatchObject({ total: 2 });
  });

  it('returns an empty first phase without waiting for earlier terms', async () => {
    const w = world();
    const result = await appMineCommand.serve(input('autoslides'), w.app);
    expect(result.data).toMatchObject({ courses: [], total: 0, note: expect.stringContaining('may still be filling in') });
    expect(w.getPersonalCourseList).not.toHaveBeenCalled();
  });

  it('reports a cold-cache refresh failure but keeps a warm cache usable', async () => {
    const w = world();
    w.refresh.mockResolvedValue({ kind: 'failed', message: 'Example network failure' });
    await expect(appMineCommand.serve(input('autoslides'), w.app)).rejects.toMatchObject({
      code: 'failed', message: 'Example network failure',
    });
    w.setStored([current]);
    expect((await appMineCommand.serve(input('autoslides'), w.app)).data).toMatchObject({ total: 1 });
  });

  it('uses Yanhekt directly for a sign-in not matched to a saved account', async () => {
    const w = world([current, earlier]);
    w.deps.configService.getAuthToken = () => 'c'.repeat(32);
    const result = await appMineCommand.serve(input('autoslides'), w.app);
    expect(result.data).toMatchObject({ account: null, courses: [{ id: live.id }] });
    expect(w.refresh).not.toHaveBeenCalled();
  });

  it('does not read or refresh a cache while signed out', async () => {
    const w = world([current]);
    w.deps.renderer.request.mockResolvedValue({ signedIn: false });
    await expect(appMineCommand.serve(input('autoslides'), w.app)).rejects.toMatchObject({ code: 'sign_in_required' });
    expect(w.refresh).not.toHaveBeenCalled();
    expect(w.deps.configService.getEnrolledCourses).not.toHaveBeenCalled();
  });

  it('validates paging before starting a refresh', async () => {
    const w = world([current]);
    await expect(appMineCommand.serve(input('autoslides', { limit: '0' }), w.app)).rejects.toMatchObject({ code: 'usage' });
    expect(w.refresh).not.toHaveBeenCalled();
  });
});
