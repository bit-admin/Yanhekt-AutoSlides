import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliControlMethods, CliDownloadUpdate, CliYanhe2Queue } from '@common/cliControl';
import type { Yanhe2DownloadPrepared } from '@common/yanhe2Download';
import { CliError } from '../errors';
import type { CommandInput } from '../types';
import { expectMatchesSchema } from '../dataSchemas.testkit';
import type { AppCommandContext } from './types';
import { allCoursesText, appYanhe2Command, calendarHeading, downloadFailure, myCoursesText, pageOfPeriods, yanhe2PlannedFile } from './yanhe2';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
  setLoggerConsoleMode: () => {},
}));

const MEDIA_URL = 'https://media.example.invalid/play/secret.mp4';
const target = { courseId: '70101', courseTitle: '课程', sessionId: '850101', sessionTitle: '第1讲' };
const okPrepared: Yanhe2DownloadPrepared = { kind: 'ok', target, courseNumber: 'N1', streams: ['camera', 'screen', 'audio'] };

let outputDir: string;
beforeEach(() => {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-cli-yanhe2-'));
});
afterEach(() => {
  fs.rmSync(outputDir, { recursive: true, force: true });
});

const row = (subId: string, status: string) => ({
  courseId: '9001', subId, title: '课程', subTitle: '第1-2节', teacher: '老师', room: '教室', college: '', courseCode: '', startAt: 1790000000, endAt: 1790005000, status,
});

function fakeApp(over: { signedIn?: boolean; prepare?: (subId: string) => Yanhe2DownloadPrepared } = {}) {
  const queued: CliYanhe2Queue[] = [];
  const prepared: string[] = [];
  const output = { out: [] as string[], info: [] as string[] };
  const ctx = {
    configService: {
      getConfig: () => ({ outputDirectory: outputDir, accounts: [{ token: 'token', badge: '1120000000', displayName: '学生', nickname: '' }], yanhe2SessionExpiry: { 1120000000: 1790000000000 } }),
      getAuthToken: () => 'token',
    },
    yanhe2Service: {
      isSignedIn: () => over.signedIn ?? true,
      getSubInfo: async () => ({
        kind: 'ok',
        data: { status: 'playable', title: '课程', subTitle: '第1-2节', teacher: '老师', room: '教室', startAt: 1790000000, endAt: 1790005000, duration: 5000, sources: [{ type: 'screen', format: 'mp4', url: MEDIA_URL }], audioUrl: MEDIA_URL },
      }),
      getCourseDetail: async () => ({
        kind: 'ok',
        data: { courseId: '9001', title: '课程', teacher: '老师', college: '学院', term: '2026-2027-1', schoolYear: '2026-2027', semester: '1', courseCode: '', sessions: [row('1', 'playable'), row('2', 'upcoming'), row('3', 'playable')] },
      }),
    },
    yanhe2DownloadService: {
      prepare: async (_account: string, query: { subId: string }) => {
        prepared.push(query.subId);
        return over.prepare ? over.prepare(query.subId) : okPrepared;
      },
    },
    renderer: {
      request: async (method: keyof CliControlMethods, params: unknown) => {
        if (method === 'signInState') return { signedIn: true };
        if (method === 'yanhe2SignInState') return { settled: true };
        if (method === 'queueYanhe2Download') {
          queued.push(params as CliYanhe2Queue);
          return { itemId: `i${queued.length}`, state: 'queued', progress: 0, added: true };
        }
        throw new Error(method);
      },
      seedDownload: () => {},
      watchDownload: (itemId: string, onUpdate: (update: CliDownloadUpdate) => void) => {
        onUpdate({ itemId, state: 'completed', progress: 100 });
        return () => {};
      },
      onReset: () => () => {},
    },
    term: {
      info: (text: string) => output.info.push(text),
      status: () => {},
      endStatusLine: () => {},
      out: (text: string) => output.out.push(text),
    },
    signal: new AbortController().signal,
  } as unknown as AppCommandContext;
  return { ctx, queued, prepared, output };
}

const input = (positionals: string[], options: CommandInput['options'] = {}, json = true): CommandInput => ({ program: 'autoslides', positionals, options, json });

async function usageError(args: string[], options: CommandInput['options'] = {}): Promise<CliError> {
  const app = fakeApp();
  const error = await appYanhe2Command.serve(input(args, options), app.ctx).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(CliError);
  expect((error as CliError).code).toBe('usage');
  return error as CliError;
}

type Items = { items: Array<{ status: string; stream: string | null; path: string | null; error?: { code: string } }> };

describe('autoslides yanhe2 arguments', () => {
  it('refuses an unknown action, a foreign option and a wrong argument count', async () => {
    await usageError(['nope']);
    await usageError(['mine'], { week: true });
    await usageError(['session', '70101']);
    await usageError(['course', 'abc']);
    await usageError(['download', '70101']);
    await usageError(['download', '70101', '1'], { all: true });
  });

  it('answers with its actions when none is given', async () => {
    const result = await appYanhe2Command.serve(input([]), fakeApp().ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect((result.data as { actions: string[] }).actions).toContain('download');
  });
});

describe('autoslides yanhe2 reads', () => {
  it('needs a Yanhe 2.0 session', async () => {
    const app = fakeApp({ signedIn: false });
    await expect(appYanhe2Command.serve(input(['course', '70101']), app.ctx)).rejects.toMatchObject({ code: 'yanhe2_sign_in_required' });
  });

  it('status reports a missing session instead of failing', async () => {
    const result = await appYanhe2Command.serve(input(['status']), fakeApp({ signedIn: false }).ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect(result.data).toMatchObject({ signed_in: false, expires_at: null });
  });

  it('session says which streams exist and never prints their addresses', async () => {
    const result = await appYanhe2Command.serve(input(['session', '70101', '850101']), fakeApp().ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect(result.data).toMatchObject({ session: { streams: { screen: true, camera: false, mic: true } } });
    expect(JSON.stringify(result.data) + result.text).not.toContain('example.invalid');
  });
});

describe('autoslides yanhe2 calendar text', () => {
  const session = {
    id: '850101', course_id: '70101', title: '示例课程', subtitle: '2026-09-21第1-2节', teacher: '老师', room: '教室A',
    started_at: '2026-09-21 08:00:00', ended_at: '2026-09-21 09:35:00', status: 'upcoming' as const,
  };

  it('groups the school day by period and names the course and teacher, without lessons or room', () => {
    const text = allCoursesText('2026-09-21', [
      { name: '第一节', begin: '08:00', end: '09:35', sessions: [session] },
      { name: '第二节', begin: '09:55', end: '12:20', sessions: [] },
    ]);
    expect(text.split('\n')[0]).toBe('Period 1  08:00–09:35');
    for (const part of ['示例课程', '老师']) expect(text).toContain(part);
    for (const part of ['LESSONS', 'ROOM', '教室A', '第1-2节', 'Period 2']) expect(text).not.toContain(part);
  });

  it('heads the calendar with its dates and the current date and time in the given time zone', () => {
    const now = Date.UTC(2026, 10, 22, 19, 12);
    expect(calendarHeading('All Courses', now, '2026-11-23', '2026-11-23', 'Asia/Shanghai')).toBe('All Courses  ·  Monday, 2026-11-23  ·  Now 2026-11-23 03:12 (Asia/Shanghai)');
    expect(calendarHeading('My Courses', now, '2026-11-23', '2026-11-29', 'America/New_York')).toBe('My Courses  ·  2026-11-23 to 2026-11-29  ·  Now 2026-11-22 14:12 (America/New_York)');
    // Midnight reads 00, not 24.
    expect(calendarHeading('All Courses', Date.UTC(2026, 10, 22, 16, 5), '2026-11-23', '2026-11-23', 'Asia/Shanghai')).toContain('Now 2026-11-23 00:05');
  });

  it('uses the system time zone by default', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(calendarHeading('My Courses', Date.UTC(2026, 10, 22, 19, 12), '2026-11-23')).toContain(`(${zone})`);
  });

  it('pages the school day across periods', () => {
    const rows = (n: number, from: number) => Array.from({ length: n }, (_, i) => ({ ...session, id: String(from + i) }));
    const periods = [
      { name: '第一节', begin: '08:00', end: '09:35', sessions: rows(3, 1) },
      { name: '第二节', begin: '09:55', end: '12:20', sessions: rows(3, 4) },
    ];
    const second = pageOfPeriods(periods, 2, 2);
    expect(second).toMatchObject({ page: 2, last_page: 3, total: 6 });
    expect(second.periods.map((p) => p.sessions.map((s) => s.id))).toEqual([['3'], ['4']]);
    expect(pageOfPeriods(periods, 9, 2).periods).toEqual([]);
  });

  it('My Courses is one table of the week, with day, period and time', () => {
    const text = myCoursesText('2026-09-21', '2026-09-27', [
      { date: '2026-09-21', sessions: [{ ...session, subtitle: '' }] },
      { date: '2026-09-22', sessions: [] },
    ]);
    const [header, line] = text.split('\n');
    expect(header).toMatch(/^DAY\s+PERIOD\s+TIME\s+COURSE\s+TEACHER\s+STATUS\s+COURSE ID\s+SESSION ID$/);
    expect(line).toMatch(/^Mon 21\s+Period 1\s+08:00–09:35\s+示例课程/);
    expect(text).not.toContain('教室A');
    expect(myCoursesText('2026-09-21', '2026-09-27', [])).toBe('You have no classes from 2026-09-21 to 2026-09-27.');
  });

  it('calendar is My Courses for the week of the date, without asking for the school day', async () => {
    const app = fakeApp();
    const getCalendarDay = vi.fn();
    const getWeekSchedule = vi.fn(async () => ({ kind: 'ok', data: [{ day: '2026-09-23', sessions: [row('1', 'upcoming')] }] }));
    Object.assign(app.ctx.yanhe2Service, { getCalendarDay, getWeekSchedule });
    const result = await appYanhe2Command.serve(input(['calendar', '2026-09-23']), app.ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect(result.data).toMatchObject({ view: 'my_courses', start: '2026-09-21', end: '2026-09-27' });
    expect(getWeekSchedule).toHaveBeenCalledWith('1120000000', { startDate: '2026-09-21', endDate: '2026-09-27' });
    expect(getCalendarDay).not.toHaveBeenCalled();
  });

  it('calendar --all is All Courses for that day', async () => {
    const app = fakeApp();
    const getCalendarDay = vi.fn(async () => ({
      kind: 'ok',
      data: { periods: [{ id: 1, name: '第一节', beginTime: '08:00', endTime: '09:35', sessions: [row('1', 'upcoming')], loaded: true }] },
    }));
    Object.assign(app.ctx.yanhe2Service, { getCalendarDay, getWeekSchedule: vi.fn() });
    const result = await appYanhe2Command.serve(input(['calendar', '2026-09-23'], { all: true }), app.ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect(result.data).toMatchObject({ view: 'all_courses', date: '2026-09-23', total: 1 });
    expect(result.text).toContain('All Courses');
  });

  it('refuses paging without --all, and the removed --week', async () => {
    await usageError(['calendar'], { page: '2' });
    await usageError(['calendar'], { week: true });
  });

  it('says when there are no classes', () => {
    expect(allCoursesText('2026-09-21', [])).toBe('No classes on 2026-09-21.');
  });
});

describe('a queued Yanhe 2.0 download that fails', () => {
  it('explains a stream the server lists but does not have', () => {
    const error = downloadFailure('screen', 'Yanhe 2.0 download failed (HTTP 404).');
    expect(error.code).toBe('no_recording');
    expect(error.message).toContain('does not have the file');
  });

  it('keeps any other failure as it was', () => {
    expect(downloadFailure('screen', 'Yanhe 2.0 download failed (HTTP 500).')).toEqual({ code: 'failed', message: 'Yanhe 2.0 download failed (HTTP 500).' });
  });
});

describe('autoslides yanhe2 download', () => {
  it('queues the stream and reports the file', async () => {
    const app = fakeApp();
    const result = await appYanhe2Command.serve(input(['download', '9001', '1']), app.ctx);
    expectMatchesSchema(appYanhe2Command.dataSchema, result.data);
    expect(app.queued).toMatchObject([{ courseId: '9001', subId: '1', kind: 'screen' }]);
    expect((result.data as Items).items).toMatchObject([{ status: 'downloaded', path: path.join(outputDir, 'screen_课程_第1讲__c70101s850101.mp4') }]);
  });

  it('--all takes the recorded sessions only', async () => {
    const app = fakeApp();
    await appYanhe2Command.serve(input(['download', '9001'], { all: true, 'dry-run': true }), app.ctx);
    expect(app.prepared).toEqual(['1', '3']);
    expect(app.queued).toEqual([]);
  });

  it('stops at a network failure, since every later lecture would fail too', async () => {
    const app = fakeApp({ prepare: () => ({ kind: 'network' }) });
    const result = await appYanhe2Command.serve(input(['download', '9001'], { all: true }), app.ctx);
    expect(app.prepared).toEqual(['1']);
    expect(result.error?.code).toBe('network');
  });

  it('skips a file already there, unless forced', async () => {
    const file = yanhe2PlannedFile(outputDir, target, 'screen');
    fs.writeFileSync(file, 'x');
    const skipped = fakeApp();
    const first = await appYanhe2Command.serve(input(['download', '9001', '1']), skipped.ctx);
    expect((first.data as Items).items[0].status).toBe('skipped');
    expect(skipped.queued).toEqual([]);
    const forced = fakeApp();
    await appYanhe2Command.serve(input(['download', '9001', '1'], { force: true }), forced.ctx);
    expect(forced.queued).toHaveLength(1);
  });

  it('names audio .aac, and a lecture Yanhekt lacks without ids', () => {
    expect(yanhe2PlannedFile('/o', target, 'audio').endsWith('audio_课程_第1讲__c70101s850101.aac')).toBe(true);
    const noTwin = { courseId: '', courseTitle: '课程', sessionId: '', sessionTitle: '2026-09-21 第8-10节' };
    expect(path.basename(yanhe2PlannedFile('/o', noTwin, 'screen'))).toBe('screen_课程_2026-09-21_第8-10节.mp4');
  });

  it('reports a stream the recording lacks', async () => {
    const app = fakeApp({ prepare: () => ({ ...okPrepared, streams: ['camera'] } as Yanhe2DownloadPrepared) });
    const result = await appYanhe2Command.serve(input(['download', '9001', '1']), app.ctx);
    expect((result.data as Items).items[0]).toMatchObject({ status: 'failed', error: { code: 'no_recording' } });
    expect(result.error?.code).toBe('no_recording');
  });
});
