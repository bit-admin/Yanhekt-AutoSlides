// `yhdl session <session link or id>`: one session, its course and its
// recordings. Anonymous: session detail by id, then the video record.
import type { ApiClient } from '@main/platform/apiClient';
import { englishTitle, formatDuration, formatTime } from '../format';
import { parseSessionTarget } from '../targets';
import { termKey } from '../terms';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';

/** The session lookup, for both the terminal command (anonymous) and the app's (its token). */
export async function showSession(input: CommandInput, apiClient: ApiClient, token: string): Promise<CommandResult> {
  const sessionId = parseSessionTarget(input.positionals[0], input.program);
  const { session, course, audioUrl } = await apiClient.getSessionDownloadInfo(sessionId, token);

  const data = {
    session: {
      id: String(session.session_id),
      title: session.title,
      week: session.week_number ?? null,
      day: session.day ?? null,
      started_at: session.started_at || null,
      ended_at: session.ended_at || null,
      duration: session.duration || 0,
      streams: { screen: !!session.vga_url, camera: !!session.main_url },
      mic: !!audioUrl,
    },
    course: {
      id: String(course.id),
      title: course.title,
      title_en: englishTitle(course.titleEn),
      college: course.college_name || null,
      term: termKey(course.school_year, course.semester) || null,
    },
  };

  const streams = [data.session.streams.screen && 'screen', data.session.streams.camera && 'camera'].filter(Boolean);
  // Ids differ in length (session 6 digits, course 5); keep the titles in one column.
  const idWidth = Math.max(data.session.id.length, data.course.id.length) + 2;
  const lines: [string, string][] = [
    ['Session', `${data.session.id.padEnd(idWidth)}${data.session.title}`],
    ['Course', `${data.course.id.padEnd(idWidth)}${data.course.title}${data.course.title_en ? ` (${data.course.title_en})` : ''}`],
    ['Term', [data.course.term, data.course.college].filter(Boolean).join(' · ')],
    ['Time', [formatTime(session.started_at), session.ended_at?.slice(11, 16)].filter(Boolean).join(' – ')],
    ['Week', data.session.week === null ? '' : String(data.session.week)],
    ['Length', formatDuration(data.session.duration)],
    ['Streams', streams.join(', ') || 'none'],
    ['Mic audio', data.session.mic ? 'yes' : 'no'],
  ];
  return {
    data,
    hints: [`Run '${input.program} download ${data.session.id}' to download it.`],
    text: lines.filter(([, v]) => v).map(([k, v]) => `${k.padEnd(10)}${v}`).join('\n'),
  };
}

const run = (input: CommandInput, ctx: CliContext): Promise<CommandResult> => showSession(input, ctx.apiClient, ANONYMOUS);

export const SESSION_DATA =
  '{ session: { id, title, week, day, started_at, ended_at, duration (s), streams: { screen, camera }, mic }, course: { id, title, title_en, college, term } }';

export const sessionCommand: CliCommand = {
  summary: 'Show one session and its recordings (no sign-in)',
  args: '<session link or id>',
  description: [
    'Show one recorded session: its course, time, length and which streams',
    'exist. A bare number is a session id; a link such as',
    'https://www.yanhekt.cn/session/<id> works too. No sign-in is needed.',
  ],
  examples: ['session 850101', 'session https://www.yanhekt.cn/session/850101 --json'],
  options: [],
  positionals: { min: 1, max: 1 },
  network: true,
  data: SESSION_DATA,
  run,
};
