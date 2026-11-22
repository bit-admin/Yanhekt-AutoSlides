// `autoslides yanhe2`: Yanhe 2.0 (aita.yanhekt.cn) from the terminal, as the
// account signed in to the app. Its own command because aita's course and
// session ids are a separate number space from Yanhekt's.
//
// Every read goes through `Yanhe2Service` and every download through the
// Download panel, so the intranet route, session handling, file names, dedupe
// and auto-extraction are the app's. Rows are built field by field here: the
// service's results carry upstream media URLs, which never leave main, and
// neither does the JWT or the play-signing phone.
import fs from 'node:fs';
import path from 'node:path';
import { buildDownloadFileName } from '@common/downloadNaming';
import { lectureLabel } from '@common/lectureNaming';
import {
  beijingDate,
  isCalendarDate,
  periodNumber,
  shiftDate,
  timetablePeriodOf,
  weekStartOf,
  type Yanhe2CalendarSession,
  type Yanhe2ReadResult,
} from '@common/yanhe2Calendar';
import type { Yanhe2Course } from '@common/yanhe2Curriculum';
import type { Yanhe2DownloadKind, Yanhe2DownloadTarget } from '@common/yanhe2Download';
import { YANHE2_SEARCH_PAGE_SIZE } from '@common/yanhe2Search';
import { intOption, type OptionSpec } from '../args';
import { YANHE2_SCHEMA } from '../dataSchemas';
import { failureOf } from '../downloadPlan';
import { CliError, type CliErrorCode } from '../errors';
import { formatDuration, table } from '../format';
import { commandHelp } from '../help';
import type { CommandInput, CommandResult } from '../types';
import { outputDirOf } from './download';
import { followDownloads, type Followed } from './followDownloads';
import { requireSignIn } from './signIn';
import type { AppCommand, AppCommandContext } from './types';

const OPTIONS = {
  term: { long: 'term', value: 'id', description: 'search: one term, by the id from \'yanhe2 terms\' (default: every term)' },
  page: { long: 'page', value: 'n', description: 'search, mine, calendar --all: page number (default 1)' },
  limit: { long: 'limit', value: 'n', description: 'mine, calendar --all: rows per page, 1-100 (default 20)' },
  stream: {
    long: 'stream',
    short: 's',
    value: 'which',
    choices: ['screen', 'camera', 'audio', 'both'],
    description: 'download: screen (default), camera, audio (classroom mic), or both (screen + camera)',
  },
  all: { long: 'all', description: 'download: every recorded session of the course; calendar: All Courses, every class that day' },
  dryRun: { long: 'dry-run', description: 'download: resolve everything and print the files it would write; queue nothing' },
  force: { long: 'force', short: 'f', description: 'download: queue it even if the file is already in the output folder' },
  noWait: { long: 'no-wait', description: 'download: return once queued instead of waiting for the downloads' },
} satisfies Record<string, OptionSpec>;

interface ActionSpec {
  args: string;
  min: number;
  max: number;
  options: readonly OptionSpec[];
}

const ACTIONS = {
  status: { args: '', min: 0, max: 0, options: [] },
  terms: { args: '', min: 0, max: 0, options: [] },
  search: { args: '<keyword…>', min: 1, max: Infinity, options: [OPTIONS.term, OPTIONS.page] },
  mine: { args: '', min: 0, max: 0, options: [OPTIONS.limit, OPTIONS.page] },
  course: { args: '<course id>', min: 1, max: 1, options: [] },
  session: { args: '<course id> <session id>', min: 2, max: 2, options: [] },
  calendar: { args: '[YYYY-MM-DD]', min: 0, max: 1, options: [OPTIONS.all, OPTIONS.limit, OPTIONS.page] },
  download: {
    args: '<course id> <session id…> | <course id> --all',
    min: 1,
    max: Infinity,
    options: [OPTIONS.stream, OPTIONS.all, OPTIONS.dryRun, OPTIONS.force, OPTIONS.noWait],
  },
} satisfies Record<string, ActionSpec>;

type Action = keyof typeof ACTIONS;
const ACTION_NAMES = Object.keys(ACTIONS) as Action[];
const isAction = (word: string): word is Action => Object.prototype.hasOwnProperty.call(ACTIONS, word);

/** The action's own arguments and options; anything else is a usage error, before any request. */
function checkAction(action: Action, args: readonly string[], input: CommandInput): void {
  const spec: ActionSpec = ACTIONS[action];
  if (args.length > spec.max) throw new CliError('usage', `too many arguments for yanhe2 ${action}`);
  if (args.length < spec.min) throw new CliError('usage', `yanhe2 ${action} needs ${spec.args}`);
  for (const long of Object.keys(input.options)) {
    if (!spec.options.some((option) => option.long === long)) {
      throw new CliError('usage', `--${long} does not apply to yanhe2 ${action}`);
    }
  }
}

function idOf(raw: string, kind: 'course' | 'session'): string {
  if (!/^\d{1,12}$/.test(raw)) throw new CliError('usage', `not a Yanhe 2.0 ${kind} id: ${raw}`);
  return raw;
}

function unwrap<T>(result: Yanhe2ReadResult<T>): T {
  if (result.kind === 'ok') return result.data;
  if (result.kind === 'signed_out') throw signedOut();
  if (result.kind === 'network') throw new CliError('network', 'could not reach Yanhe 2.0');
  throw new CliError('failed', 'Yanhe 2.0 did not return that');
}

const signedOut = (): CliError =>
  new CliError(
    'yanhe2_sign_in_required',
    'AutoSlides has no live Yanhe 2.0 session for this account',
    'Sign in to Yanhe 2.0 in the AutoSlides window, then run the command again.',
  );

/** The active account's badge, once the app has finished checking or renewing its session. */
async function settledAccount(ctx: AppCommandContext): Promise<{ badge: string | null; name: string | null }> {
  const { account } = await requireSignIn(ctx);
  await ctx.renderer.request('yanhe2SignInState', {});
  return { badge: account?.badge ?? null, name: account?.name ?? null };
}

async function requireYanhe2(ctx: AppCommandContext): Promise<{ badge: string; name: string | null }> {
  const { badge, name } = await settledAccount(ctx);
  if (!badge || !ctx.yanhe2Service.isSignedIn(badge)) throw signedOut();
  return { badge, name };
}

/** `2026-09-21 08:00:00` in Beijing time, as Yanhekt's own times read; null when unknown. */
function beijingTime(epochSeconds: number): string | null {
  if (!epochSeconds) return null;
  return new Date((epochSeconds + 8 * 3600) * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

const courseRow = (course: Yanhe2Course) => ({
  id: course.courseId,
  title: course.title,
  teacher: course.teacher,
  college: course.college,
  term: course.term,
});

const sessionRow = (session: Yanhe2CalendarSession) => ({
  id: session.subId,
  course_id: session.courseId,
  title: session.title,
  subtitle: session.subTitle,
  teacher: session.teacher,
  room: session.room,
  started_at: beijingTime(session.startAt),
  ended_at: beijingTime(session.endAt),
  status: session.status,
});

type CourseRow = ReturnType<typeof courseRow>;
type SessionRow = ReturnType<typeof sessionRow>;

const coursesText = (rows: readonly CourseRow[]): string =>
  rows.length === 0
    ? 'No courses found.'
    : table(['ID', 'COURSE', 'TEACHER', 'TERM'], rows.map((r) => [r.id, r.title, r.teacher, r.term]));

const sessionsText = (rows: readonly SessionRow[]): string =>
  table(
    ['ID', 'COURSE', 'WHEN', 'STATUS', 'TITLE'],
    rows.map((r) => [r.id, r.course_id, r.started_at?.slice(0, 16) ?? '', r.status, r.subtitle || r.title]),
  );

const clockOf = (row: SessionRow): string => {
  const begin = row.started_at?.slice(11, 16) ?? '';
  const end = row.ended_at?.slice(11, 16) ?? '';
  return begin && end ? `${begin}–${end}` : begin;
};

/** The Calendar page's period for a row; its "Other Times" column when none fits. */
function periodOf(row: SessionRow): string {
  if (!row.started_at || !row.ended_at) return 'Other';
  const epoch = (text: string): number => Date.parse(`${text.replace(' ', 'T')}+08:00`) / 1000;
  const period = timetablePeriodOf(epoch(row.started_at), epoch(row.ended_at));
  return period === null ? 'Other' : `Period ${period}`;
}

interface PeriodRows {
  name: string;
  begin: string;
  end: string;
  sessions: SessionRow[];
}

/** One page of a school day's classes, counted across periods; periods with no row on it drop out. */
export function pageOfPeriods(periods: readonly PeriodRows[], page: number, limit: number) {
  const total = periods.reduce((sum, period) => sum + period.sessions.length, 0);
  const from = (page - 1) * limit;
  let seen = 0;
  const shown: PeriodRows[] = [];
  for (const period of periods) {
    const sessions = period.sessions.slice(Math.max(0, from - seen), Math.max(0, from + limit - seen));
    seen += period.sessions.length;
    if (sessions.length > 0) shown.push({ ...period, sessions });
  }
  return { page, last_page: Math.max(1, Math.ceil(total / limit)), total, periods: shown };
}

/** All Courses: one block per period on this page, as the Calendar page groups them. */
export function allCoursesText(date: string, periods: readonly PeriodRows[]): string {
  const blocks = periods
    .filter((period) => period.sessions.length > 0)
    .map((period) => {
      const number = periodNumber(period.name);
      const rows = table(
        ['COURSE', 'TEACHER', 'STATUS', 'COURSE ID', 'SESSION ID'],
        period.sessions.map((r) => [r.title, r.teacher, r.status, r.course_id, r.id]),
      );
      return `${number === null ? period.name : `Period ${number}`}  ${period.begin}–${period.end}\n${rows}`;
    });
  return blocks.length > 0 ? blocks.join('\n\n') : `No classes on ${date}.`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (date: string): string => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/**
 * The line above a calendar: the Calendar page's view, the school dates it
 * covers, then the current date and time in this computer's time zone.
 */
export function calendarHeading(
  view: 'My Courses' | 'All Courses',
  nowMs: number,
  start: string,
  end: string = start,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  const now = `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
  const covers = start === end ? `${weekdayOf(start)}, ${start}` : `${start} to ${end}`;
  return `${view}  ·  ${covers}  ·  Now ${now} (${timeZone})`;
}

/** My Courses: the week's classes in one table, a row per class, in day and period order. */
export function myCoursesText(
  start: string,
  end: string,
  days: readonly { date: string; sessions: readonly SessionRow[] }[],
): string {
  const rows = days.flatMap((day) =>
    [...day.sessions]
      .sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''))
      .map((r) => [`${weekdayOf(day.date).slice(0, 3)} ${day.date.slice(8)}`, periodOf(r), clockOf(r), r.title, r.teacher, r.status, r.course_id, r.id]),
  );
  if (rows.length === 0) return `You have no classes from ${start} to ${end}.`;
  return table(['DAY', 'PERIOD', 'TIME', 'COURSE', 'TEACHER', 'STATUS', 'COURSE ID', 'SESSION ID'], rows);
}

async function status(ctx: AppCommandContext): Promise<CommandResult> {
  const { badge, name } = await settledAccount(ctx);
  const signedIn = badge !== null && ctx.yanhe2Service.isSignedIn(badge);
  const expiry = badge ? ctx.configService.getConfig().yanhe2SessionExpiry?.[badge] : undefined;
  const expiresAt = signedIn && expiry ? new Date(expiry).toISOString() : null;
  return {
    data: { signed_in: signedIn, account: name, badge, expires_at: expiresAt },
    text: signedIn ? `Signed in to Yanhe 2.0 as ${name ?? badge} until ${expiresAt}.` : 'Not signed in to Yanhe 2.0.',
    hints: signedIn ? undefined : ['Sign in to Yanhe 2.0 in the AutoSlides window.'],
  };
}

async function terms(ctx: AppCommandContext): Promise<CommandResult> {
  const { badge } = await requireYanhe2(ctx);
  const rows = unwrap(await ctx.yanhe2Service.getTerms(badge)).map((term) => ({
    id: String(term.id),
    name: term.name,
    current: term.current,
  }));
  return {
    data: { terms: rows },
    text: table(['ID', 'TERM', 'CURRENT'], rows.map((r) => [r.id, r.name, r.current ? 'yes' : ''])),
  };
}

async function search(args: readonly string[], input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const keyword = args.join(' ').trim();
  if (!keyword) throw new CliError('usage', 'yanhe2 search needs a keyword');
  const page = intOption(input.options.page, 'page', 1, 10_000);
  const termId = input.options.term === undefined ? null : intOption(input.options.term, 'term', 1);
  const { badge } = await requireYanhe2(ctx);
  const found = unwrap(await ctx.yanhe2Service.searchCourses(badge, { keyword, termId, page }));
  const courses = found.courses.map(courseRow);
  const lastPage = Math.max(1, Math.ceil(found.total / YANHE2_SEARCH_PAGE_SIZE));
  return {
    data: { keyword, term_id: termId === null ? null : String(termId), page, last_page: lastPage, total: found.total, courses },
    text: coursesText(courses),
    hints: page < lastPage ? [`Page ${page} of ${lastPage}. Use --page for more.`] : undefined,
  };
}

async function mine(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const limit = intOption(input.options.limit, 'limit', 20, 100);
  const page = intOption(input.options.page, 'page', 1);
  const { badge, name } = await requireYanhe2(ctx);
  const all = unwrap(await ctx.yanhe2Service.getMyCourses(badge));
  const courses = all.slice((page - 1) * limit, page * limit).map(courseRow);
  const lastPage = Math.max(1, Math.ceil(all.length / limit));
  return {
    data: { account: name, page, last_page: lastPage, total: all.length, courses },
    text: coursesText(courses),
    hints: page < lastPage ? [`Page ${page} of ${lastPage}. Use --page for more.`] : undefined,
  };
}

async function course(args: readonly string[], ctx: AppCommandContext): Promise<CommandResult> {
  const courseId = idOf(args[0], 'course');
  const { badge } = await requireYanhe2(ctx);
  const detail = unwrap(await ctx.yanhe2Service.getCourseDetail(badge, { courseId }));
  const sessions = detail.sessions.map(sessionRow);
  const note = sessions.length === 0 ? 'Yanhe 2.0 has no sessions attached to this course.' : undefined;
  const heading = `${detail.title}  ${detail.teacher}  ${detail.term}`.trim();
  return {
    data: { course: courseRow(detail), sessions, ...(note ? { note } : {}) },
    text: note ? `${heading}\n${note}` : `${heading}\n\n${sessionsText(sessions)}`,
  };
}

async function session(args: readonly string[], ctx: AppCommandContext): Promise<CommandResult> {
  const courseId = idOf(args[0], 'course');
  const subId = idOf(args[1], 'session');
  const { badge } = await requireYanhe2(ctx);
  const info = unwrap(await ctx.yanhe2Service.getSubInfo(badge, { courseId, subId }));
  // Which streams exist, never their addresses.
  const streams = {
    screen: info.sources.some((source) => source.type === 'screen'),
    camera: info.sources.some((source) => source.type === 'camera'),
    mic: info.audioUrl !== '',
  };
  const row = {
    id: subId,
    course_id: courseId,
    title: info.title,
    subtitle: info.subTitle,
    teacher: info.teacher,
    room: info.room,
    started_at: beijingTime(info.startAt),
    ended_at: beijingTime(info.endAt),
    duration: info.duration,
    status: info.status,
    streams,
  };
  const available = Object.entries(streams).filter(([, has]) => has).map(([name]) => name).join(', ') || 'none';
  return {
    data: { session: row },
    text: [
      `${row.title}  ${row.subtitle}`.trim(),
      `Status:  ${row.status}`,
      `Time:    ${row.started_at ?? 'unknown'}${row.duration ? `  (${formatDuration(row.duration)})` : ''}`,
      `Teacher: ${row.teacher}`,
      `Room:    ${row.room}`,
      `Streams: ${available}`,
    ].join('\n'),
  };
}

async function calendar(args: readonly string[], input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const now = Date.now();
  const date = args[0] ?? beijingDate(now);
  if (!isCalendarDate(date)) throw new CliError('usage', `not a date (YYYY-MM-DD): ${date}`);
  const everyone = input.options.all === true;
  if (!everyone && (input.options.limit !== undefined || input.options.page !== undefined)) {
    throw new CliError('usage', '--limit and --page only apply to calendar --all');
  }
  const limit = intOption(input.options.limit, 'limit', 20, 100);
  const page = intOption(input.options.page, 'page', 1);
  const { badge } = await requireYanhe2(ctx);

  if (!everyone) {
    const start = weekStartOf(date);
    const end = shiftDate(start, 6);
    const week = unwrap(await ctx.yanhe2Service.getWeekSchedule(badge, { startDate: start, endDate: end }));
    const days = week.map((day) => ({ date: day.day, sessions: day.sessions.map(sessionRow) }));
    return {
      data: { view: 'my_courses', start, end, days },
      text: `${calendarHeading('My Courses', now, start, end)}\n\n${myCoursesText(start, end, days)}`,
    };
  }

  const day = unwrap(await ctx.yanhe2Service.getCalendarDay(badge, { date }));
  const periods = [];
  for (const period of day.periods) {
    if (ctx.signal.aborted) throw new CliError('interrupted', 'stopped');
    // A busy day's answer leaves some periods out; each is asked for on its own, as the page does.
    let sessions = period.sessions;
    if (!period.loaded) {
      const full = unwrap(await ctx.yanhe2Service.getCalendarDay(badge, { date, periodId: period.id }));
      sessions = full.periods.find((candidate) => candidate.id === period.id)?.sessions ?? [];
    }
    periods.push({ name: period.name, begin: period.beginTime, end: period.endTime, sessions: sessions.map(sessionRow) });
  }
  const shown = pageOfPeriods(periods, page, limit);
  return {
    data: { view: 'all_courses', date, ...shown },
    text: `${calendarHeading('All Courses', now, date)}\n\n${allCoursesText(date, shown.periods)}`,
    hints: shown.total > 0 ? [`Page ${page} of ${shown.last_page}, ${shown.total} classes.${page < shown.last_page ? ' Use --page for more.' : ''}`] : undefined,
  };
}

// ── Download ────────────────────────────────────────────────────────────────

interface DownloadRow {
  item_id: string | null;
  course_id: string;
  session_id: string;
  course_title: string | null;
  session_title: string | null;
  stream: Yanhe2DownloadKind | null;
  status: 'downloaded' | 'skipped' | 'planned' | 'queued' | 'failed';
  path: string | null;
  error?: { code: CliErrorCode; message: string };
}

interface Following extends Followed {
  index: number;
  filePath: string;
}

const KINDS_OF: Record<string, Yanhe2DownloadKind[]> = {
  screen: ['screen'],
  camera: ['camera'],
  audio: ['audio'],
  both: ['screen', 'camera'],
};

/** The file the app will write for this stream: the Download panel's own name. */
export function yanhe2PlannedFile(outputDir: string, target: Yanhe2DownloadTarget, kind: Yanhe2DownloadKind): string {
  const stem = buildDownloadFileName({
    name: `${kind}_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
    courseId: target.courseId,
    sessionId: target.sessionId,
  });
  return path.join(outputDir, `${stem}${kind === 'audio' ? '.aac' : '.mp4'}`);
}

const REFUSALS: Record<'signed_out' | 'no_recording' | 'network' | 'failed', { code: CliErrorCode; message: string }> = {
  signed_out: { code: 'yanhe2_sign_in_required', message: 'AutoSlides has no live Yanhe 2.0 session for this account' },
  no_recording: { code: 'no_recording', message: 'this session has no recording (yet)' },
  network: { code: 'network', message: 'could not reach Yanhe 2.0' },
  failed: { code: 'failed', message: 'Yanhe 2.0 did not return this recording' },
};

/**
 * How a queued row's failure reads. aita can list a stream it does not have,
 * which only shows when the file answers 404, so that case says so.
 */
export function downloadFailure(kind: string, message: string): { code: CliErrorCode; message: string } {
  if (!/\bHTTP 404\b/.test(message)) return { code: 'failed', message };
  return {
    code: 'no_recording',
    message: `Yanhe 2.0 lists a ${kind} stream for this session, but the server does not have the file (HTTP 404). Another --stream may work.`,
  };
}

async function download(args: readonly string[], input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const courseId = idOf(args[0], 'course');
  const named = args.slice(1).map((id) => idOf(id, 'session'));
  const all = input.options.all === true;
  if (all && named.length > 0) throw new CliError('usage', '--all takes no session ids');
  if (!all && named.length === 0) throw new CliError('usage', 'say which sessions to download, or use --all');
  const kinds = KINDS_OF[(input.options.stream as string | undefined) ?? 'screen'];
  const force = input.options.force === true;
  const dryRun = input.options['dry-run'] === true;
  const wait = input.options['no-wait'] !== true;

  const { badge } = await requireYanhe2(ctx);
  const outputDir = outputDirOf(ctx);
  const subIds = all
    ? unwrap(await ctx.yanhe2Service.getCourseDetail(badge, { courseId })).sessions
        .filter((row) => row.status === 'playable')
        .map((row) => row.subId)
    : [...new Set(named)];

  const items: DownloadRow[] = [];
  const following: Following[] = [];

  lectures: for (const [index, subId] of subIds.entries()) {
    if (ctx.signal.aborted) break;
    const prepared = await ctx.yanhe2DownloadService.prepare(badge, { courseId, subId });
    if (ctx.signal.aborted) break;
    if (prepared.kind !== 'ok') {
      const error = REFUSALS[prepared.kind];
      ctx.term.info(`${subId}: ${error.message}`);
      items.push({ item_id: null, course_id: courseId, session_id: subId, course_title: null, session_title: null, stream: null, status: 'failed', path: null, error });
      // Not about this lecture: every later one would be turned down the same way.
      if (prepared.kind === 'signed_out' || prepared.kind === 'network') break lectures;
      continue;
    }

    const { target, courseNumber, streams } = prepared;
    ctx.term.info(`${subIds.length > 1 ? `[${index + 1}/${subIds.length}] ` : ''}${target.courseTitle} · ${target.sessionTitle}`);
    const base = { course_id: courseId, session_id: subId, course_title: target.courseTitle, session_title: target.sessionTitle };

    for (const kind of kinds) {
      if (ctx.signal.aborted) break lectures;
      if (!streams.includes(kind)) {
        const message = `this session has no ${kind} recording`;
        ctx.term.info(message);
        items.push({ ...base, item_id: null, stream: kind, status: 'failed', path: null, error: { code: 'no_recording', message } });
        continue;
      }
      const filePath = yanhe2PlannedFile(outputDir, target, kind);
      if (!force && fs.existsSync(filePath)) {
        ctx.term.info('Already downloaded. Use --force to queue it again.');
        items.push({ ...base, item_id: null, stream: kind, status: 'skipped', path: filePath });
        if (!input.json) ctx.term.out(filePath);
        continue;
      }
      if (dryRun) {
        items.push({ ...base, item_id: null, stream: kind, status: 'planned', path: filePath });
        if (!input.json) ctx.term.out(filePath);
        continue;
      }

      const queued = await ctx.renderer.request('queueYanhe2Download', { account: badge, courseId, subId, kind, target, courseNumber });
      if ('blocked' in queued) {
        const message = 'AutoSlides already has this recording in a download row the command line cannot follow';
        ctx.term.info(message);
        items.push({ ...base, item_id: null, stream: kind, status: 'failed', path: null, error: { code: 'failed', message } });
        continue;
      }
      if (!queued.added) ctx.term.info('Already in the download list in AutoSlides; following that one.');
      if (queued.state === 'completed') {
        const finished = queued.filePath ?? filePath;
        items.push({ ...base, item_id: queued.itemId, stream: kind, status: 'downloaded', path: finished });
        if (!input.json) ctx.term.out(finished);
        continue;
      }
      ctx.renderer.seedDownload(queued);
      following.push({ index: items.length, itemId: queued.itemId, label: kind, filePath });
      items.push({ ...base, item_id: queued.itemId, stream: kind, status: 'queued', path: filePath });
    }
  }

  const data = { output_dir: outputDir, dry_run: dryRun, waited: wait, items };
  if (!wait) {
    const hints = following.length > 0 ? ['Queued in AutoSlides; the Download panel shows its progress.'] : undefined;
    return { data, hints, error: failureOf(items) };
  }

  await followDownloads(following, ctx, {
    onEnd: (f, update) => {
      const item = items[f.index];
      if (update.state === 'completed') {
        const finished = update.filePath ?? f.filePath;
        items[f.index] = { ...item, status: 'downloaded', path: finished };
        if (!input.json) ctx.term.out(finished);
        return;
      }
      const reason = update.state === 'removed' ? 'removed from the download list in AutoSlides' : update.error || 'download failed';
      const error = downloadFailure(f.label, reason);
      items[f.index] = { ...item, status: 'failed', path: null, error };
      ctx.term.info(`${item.session_title ?? item.session_id} (${f.label}): ${error.message}`);
    },
    onReset: (reason) => {
      for (const f of following) {
        if (items[f.index].status === 'queued') {
          items[f.index] = { ...items[f.index], status: 'failed', path: null, error: { code: 'failed', message: reason } };
        }
      }
    },
  });
  return { data, error: failureOf(items) };
}

async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const [word, ...args] = input.positionals;
  if (word === undefined) {
    if (Object.keys(input.options).length > 0) throw new CliError('usage', 'say which yanhe2 action', `Actions: ${ACTION_NAMES.join(', ')}.`);
    return {
      data: { actions: ACTION_NAMES },
      text: commandHelp('yanhe2', { ...appYanhe2Command, network: false, runsInApp: true }, input.program),
    };
  }
  if (!isAction(word)) throw new CliError('usage', `unknown yanhe2 action: ${word}`, `Actions: ${ACTION_NAMES.join(', ')}.`);
  checkAction(word, args, input);

  switch (word) {
    case 'status':
      return status(ctx);
    case 'terms':
      return terms(ctx);
    case 'search':
      return search(args, input, ctx);
    case 'mine':
      return mine(input, ctx);
    case 'course':
      return course(args, ctx);
    case 'session':
      return session(args, ctx);
    case 'calendar':
      return calendar(args, input, ctx);
    case 'download':
      return download(args, input, ctx);
  }
}

export const appYanhe2Command: AppCommand = {
  summary: 'Browse Yanhe 2.0 and download its recordings',
  args: '<action> [arguments]',
  description: [
    'Yanhe 2.0 (aita.yanhekt.cn), as the account signed in to AutoSlides. That',
    'account needs a Yanhe 2.0 session; sign in to it in the window. Yanhe 2.0',
    'ids are not Yanhekt ids, so a session is always named with its course.',
    '',
    '  status                          Whether this account has a Yanhe 2.0 session',
    '  terms                           The terms, with the ids --term takes',
    '  search <keyword…>               Courses by name or teacher',
    '  mine                            Your Yanhe 2.0 courses, every term',
    '  course <course>                 One course and its sessions',
    '  session <course> <session>      One session and the streams it has',
    '  calendar [YYYY-MM-DD]           My Courses: your classes in that date\'s week',
    '  calendar [YYYY-MM-DD] --all     All Courses: every class that day, 20 per page',
    '  download <course> <session…>    Queue recordings in the Download panel and wait',
    '  download <course> --all         The same for every recorded session',
    '',
    'Ctrl-C stops waiting; the downloads keep going.',
  ],
  examples: [
    'yanhe2 status',
    'yanhe2 mine --limit 5',
    'yanhe2 search 微积分 --term 42',
    'yanhe2 course 70101',
    'yanhe2 session 70101 850101',
    'yanhe2 calendar',
    'yanhe2 calendar 2026-09-21',
    'yanhe2 calendar --all --page 2',
    'yanhe2 download 70101 850101 --stream both',
    'yanhe2 download 70101 --all --stream audio --dry-run',
  ],
  options: Object.values(OPTIONS),
  positionals: { min: 0, max: Infinity },
  data:
    'By action. status: { signed_in, account, badge, expires_at }; terms: { terms: [{ id, name, current }] }; ' +
    'search: { keyword, term_id, page, last_page, total, courses: [Course] }; mine: { account, page, last_page, total, courses: [Course] }; ' +
    'course: { course: Course, sessions: [Session], note? }; session: { session: Session & { duration, streams: { screen, camera, mic } } }; ' +
    'calendar: { view: "my_courses", start, end, days: [{ date, sessions }] } or, with --all, { view: "all_courses", date, page, last_page, total, periods: [{ name, begin, end, sessions }] }; ' +
    'download: { output_dir, dry_run, waited, items: [{ item_id, course_id, session_id, course_title, session_title, stream, status, path, error? }] }. ' +
    'Course: { id, title, teacher, college, term }; Session: { id, course_id, title, subtitle, teacher, room, started_at, ended_at, status }.',
  dataSchema: YANHE2_SCHEMA,
  serve,
};
