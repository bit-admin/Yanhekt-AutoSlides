// What `download` works out before anything is fetched, shared by the terminal
// command (`yhdl download`, which fetches the files itself) and the app command
// (`autoslides download`, which queues them in the Download panel): which
// sessions, what each one resolves to, and the file each stream becomes.
import path from 'node:path';
import type { SessionData, SessionDownloadInfo } from '@common/apiTypes';
import { buildDownloadFileName } from '@common/downloadNaming';
import { lectureLabel } from '@common/lectureNaming';
import type { ApiClient } from '@main/platform/apiClient';
import type { OptionSpec } from './args';
import { toCliError } from './classifyError';
import { CliError, type CliErrorCode } from './errors';
import { parseCourseTarget, parseSessionTarget } from './targets';
import type { CommandInput } from './types';

export type CliStream = 'screen' | 'camera';

const STREAM_CHOICES: Record<string, CliStream[]> = {
  screen: ['screen'],
  camera: ['camera'],
  both: ['screen', 'camera'],
};

export const STREAM_OPTION: OptionSpec = {
  long: 'stream',
  short: 's',
  value: 'which',
  choices: Object.keys(STREAM_CHOICES),
  description: 'screen (default), camera, or both',
};

export const streamsOf = (input: CommandInput): CliStream[] =>
  STREAM_CHOICES[(input.options.stream as string | undefined) ?? 'screen'];

export interface Lecture {
  /** `title` is the canonical Chinese name: it becomes part of the file name. */
  course: SessionDownloadInfo['course'];
  session: SessionData;
}

/** One session to fetch: already known (from a course list) or resolved by id when its turn comes. */
export type Target = { sessionId: string; lecture?: Lecture };

export type ItemStatus = 'downloaded' | 'skipped' | 'planned' | 'queued' | 'failed' | 'interrupted';

export interface Item {
  session_id: string;
  course_id: string | null;
  course_title: string | null;
  session_title: string | null;
  stream: CliStream | null;
  status: ItemStatus;
  path: string | null;
  error?: { code: CliErrorCode; message: string };
}

export const ITEM_SHAPE =
  '{ session_id, course_id, course_title, session_title, stream: "screen"|"camera"|null, status: ItemStatus, path: string|null, error?: { code, message } }';

export interface PlanDeps {
  apiClient: ApiClient;
  /** Token for the course detail hop (empty = anonymous). */
  lookupToken: string;
  /** Token for a course's session list, the one hop that needs a sign-in. Called only with `--course`. */
  listToken: () => string;
  notice: (text: string) => void;
}

/** Sessions named on the command line (already without `-`), or every recorded one of `--course`. */
export async function collectTargets(
  input: CommandInput,
  deps: PlanDeps
): Promise<{ targets: Target[]; skipped: Item[] }> {
  const courseArg = input.options.course;
  if (typeof courseArg !== 'string') {
    if (input.positionals.length === 0) throw new CliError('usage', 'missing session link or id');
    // Every argument is checked before anything is fetched.
    const ids = [...new Set(input.positionals.map((r) => parseSessionTarget(r, input.program)))];
    return { targets: ids.map((sessionId) => ({ sessionId })), skipped: [] };
  }

  if (input.positionals.length > 0) throw new CliError('usage', 'give either session ids or --course, not both');
  const courseId = parseCourseTarget(courseArg, input.program);
  const listToken = deps.listToken();
  const detail = await deps.apiClient.getCourseDetail(courseId, deps.lookupToken);
  const sessions = await deps.apiClient.getCourseSessions(courseId, listToken);
  if (sessions.length === 0) {
    throw new CliError(
      'not_found',
      'Yanhekt listed no sessions: the course has no recordings yet, this account may not watch it, or the token is no longer valid.'
    );
  }

  const course: Lecture['course'] = {
    id: courseId,
    title: detail.title,
    titleEn: detail.title_en,
    college_name: detail.college_name,
    school_year: detail.school_year,
    semester: detail.semester,
  };
  const targets: Target[] = [];
  const skipped: Item[] = [];
  for (const session of sessions) {
    const sessionId = String(session.session_id);
    if (session.main_url || session.vga_url) {
      targets.push({ sessionId, lecture: { course, session } });
    } else {
      // Not recorded yet (a future class) — expected in a course list, so not a failure.
      skipped.push({
        session_id: sessionId,
        course_id: courseId,
        course_title: detail.title,
        session_title: session.title,
        stream: null,
        status: 'skipped',
        path: null,
        error: { code: 'no_recording', message: 'no recording yet' },
      });
    }
  }
  if (skipped.length > 0) deps.notice(`${skipped.length} of ${sessions.length} sessions have no recording yet and are skipped.`);
  return { targets, skipped };
}

export async function resolveLecture(target: Target, apiClient: ApiClient, token: string): Promise<Lecture> {
  if (target.lecture) return target.lecture;
  const { session, course } = await apiClient.getSessionDownloadInfo(target.sessionId, token);
  return { course: { ...course, id: String(course.id), title: course.title || 'Unknown Course' }, session };
}

/** The item for a session that could not be resolved. */
export function unresolvedItem(sessionId: string, error: unknown): Item {
  return {
    session_id: sessionId,
    course_id: null,
    course_title: null,
    session_title: null,
    stream: null,
    status: 'failed',
    path: null,
    error: toCliError(error).toJSON(),
  };
}

export function itemBase(target: Target, lecture: Lecture, stream: CliStream) {
  return {
    session_id: target.sessionId,
    course_id: lecture.course.id,
    course_title: lecture.course.title,
    session_title: lecture.session.title,
    stream,
  };
}

export const streamUrl = (lecture: Lecture, stream: CliStream): string =>
  (stream === 'camera' ? lecture.session.main_url : lecture.session.vga_url) ?? '';

/** File name (no extension) and path the app gives this stream, so the Lectures library finds it. */
export function plannedFile(outputDir: string, lecture: Lecture, stream: CliStream): { fileName: string; filePath: string } {
  const fileName = buildDownloadFileName({
    name: `${stream}_${lectureLabel(lecture.course.title, lecture.session.title)}`,
    courseId: lecture.course.id,
    sessionId: String(lecture.session.session_id),
  });
  return { fileName, filePath: path.join(outputDir, `${fileName}.mp4`) };
}

/** The run's error when any item failed: one reason keeps its own exit code (3 for not found…); a mix is 1. */
export function failureOf(items: readonly Item[], noun = 'downloads'): CliError | undefined {
  const failed = items.filter((i) => i.status === 'failed');
  if (failed.length === 0) return undefined;
  const codes = new Set(failed.map((i) => i.error?.code ?? 'failed'));
  const code: CliErrorCode = codes.size === 1 ? [...codes][0] : 'failed';
  const message = failed.length === 1 && failed[0].error ? failed[0].error.message : `${failed.length} ${noun} failed`;
  return new CliError(code, message);
}
