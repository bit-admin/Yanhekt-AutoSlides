// `yhdl course <course link or id>`: one course and its sessions.
//
// The course itself is an anonymous lookup. Its session list is the one
// Yanhekt request that needs a login token, so this is the only place a token
// is read — and `--no-sessions` skips it altogether.
import type { CourseInfoResponse, SessionData } from '@common/apiTypes';
import { announceCredentials, credentialsJson, readCredentials } from '../auth';
import { englishTitle, formatDuration, formatTime, table } from '../format';
import { parseCourseTarget } from '../targets';
import { termKey } from '../terms';
import { info } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';
const EMPTY_NOTE =
  'Yanhekt listed no sessions: the course has no recordings yet, this account may not watch it, or the token is no longer valid.';

export function courseJson(c: Omit<CourseInfoResponse, 'videos'>) {
  return {
    id: String(c.course_id),
    title: c.title,
    title_en: englishTitle(c.title_en),
    professors: c.professors ?? [],
    college: c.college_name || null,
    term: termKey(c.school_year, c.semester) || null,
  };
}

export function sessionRowJson(s: SessionData) {
  return {
    id: String(s.session_id),
    title: s.title,
    week: s.week_number ?? null,
    day: s.day ?? null,
    started_at: s.started_at || null,
    ended_at: s.ended_at || null,
    duration: s.duration || 0,
    streams: { screen: !!s.vga_url, camera: !!s.main_url },
  };
}

const streamsText = (streams: { screen: boolean; camera: boolean }): string =>
  [streams.screen && 'screen', streams.camera && 'camera'].filter(Boolean).join('+') || '-';

async function run(input: CommandInput, ctx: CliContext): Promise<CommandResult> {
  const courseId = parseCourseTarget(input.positionals[0], input.program);
  const withSessions = input.options['no-sessions'] !== true;
  // Before any request: a missing token is a fast, clear failure.
  const credentials = withSessions ? readCredentials(input, ctx) : null;

  const detail = await ctx.apiClient.getCourseDetail(courseId, ANONYMOUS);
  const course = courseJson(detail);

  let sessions: ReturnType<typeof sessionRowJson>[] | null = null;
  if (credentials) {
    announceCredentials(credentials);
    sessions = (await ctx.apiClient.getCourseSessions(courseId, credentials.token)).map(sessionRowJson);
  }

  const data = {
    course,
    sessions,
    auth: credentials ? credentialsJson(credentials) : null,
    ...(sessions && sessions.length === 0 ? { note: EMPTY_NOTE } : {}),
  };

  const header = [
    `${course.title}${course.title_en ? ` (${course.title_en})` : ''}`,
    [course.professors.join(', '), course.term, course.college].filter(Boolean).join(' · '),
  ];
  if (!sessions) return { data, text: header.join('\n') };
  if (sessions.length === 0) {
    info(EMPTY_NOTE);
    return { data, text: header.join('\n') };
  }
  const rows = sessions.map((s) => [
    s.id,
    s.week === null ? '' : String(s.week),
    formatTime(s.started_at ?? undefined),
    formatDuration(s.duration),
    streamsText(s.streams),
    s.title,
  ]);
  return {
    data,
    text: [...header, '', table(['Session', 'Week', 'Start', 'Length', 'Streams', 'Title'], rows)].join('\n'),
    hints: [`Run '${input.program} download <session id>' to download one, or 'session <id>' for its details.`],
  };
}

export const courseCommand: CliCommand = {
  summary: 'Show a course and list its sessions (the list needs sign-in)',
  args: '<course link or id>',
  description: [
    'Show one course and its sessions. A bare number is a course id; a link',
    'such as https://www.yanhekt.cn/course/<id> works too.',
    '',
    'The course details need no sign-in. Listing its sessions does: the token',
    'comes from --token, --account, YANHEKT_TOKEN, or the account signed in to',
    'AutoSlides, in that order. Use --no-sessions to skip the list.',
  ],
  examples: ['course 70101', 'course https://www.yanhekt.cn/course/70101 --json', 'course 70101 --no-sessions'],
  options: [{ long: 'no-sessions', description: 'Show the course only; no sign-in is used' }],
  positionals: { min: 1, max: 1 },
  network: true,
  tokenUse: 'To list the sessions (skipped with --no-sessions)',
  data: '{ course: { id, title, title_en, professors, college, term }, sessions: [{ id, title, week, day, started_at, ended_at, duration (s), streams: { screen, camera } }] | null, auth: { source, account } | null, note?: string }',
  run,
};
