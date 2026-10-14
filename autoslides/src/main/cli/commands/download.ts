// `yhdl download`: fetch recorded sessions' videos.
//
// Deliberately narrower than the app's Download panel: recordings from
// cvideo.yanhekt.cn only, no extraction, no queue — and no sign-in for the
// video itself. A session is resolved from its id through the two lookups that
// need no account (session detail by id, then the video record), and the CDN
// is signed with an anonymously minted video token, so an empty login token is
// passed all the way down and no download request carries a Bearer.
//
// `--course` is the one exception, and only for finding the sessions: the
// course's session list is the single Yanhekt request that needs a token.
//
// Files are named exactly as the app names them (`buildDownloadFileName`), so
// a lecture fetched here shows up in the Lectures library like any other.
import fs from 'node:fs';
import path from 'node:path';
import type { SessionData } from '@common/apiTypes';
import { buildDownloadFileName } from '@common/downloadNaming';
import { lectureLabel } from '@common/lectureNaming';
import { announceCredentials, readCredentials } from '../auth';
import { toCliError } from '../classifyError';
import { CliError, type CliErrorCode } from '../errors';
import { parseCourseTarget, parseSessionTarget } from '../targets';
import { endStatusLine, info, out, status } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';

type CliStream = 'screen' | 'camera';

const STREAM_CHOICES: Record<string, CliStream[]> = {
  screen: ['screen'],
  camera: ['camera'],
  both: ['screen', 'camera'],
};

interface Lecture {
  courseId: string;
  /** Canonical Chinese title: it becomes part of the file name. */
  courseTitle: string;
  session: SessionData;
}

/** One session to fetch: already known (from a course list) or resolved by id when its turn comes. */
type Target = { sessionId: string; lecture?: Lecture };

type ItemStatus = 'downloaded' | 'skipped' | 'planned' | 'failed' | 'interrupted';

interface Item {
  session_id: string;
  course_id: string | null;
  course_title: string | null;
  session_title: string | null;
  stream: CliStream | null;
  status: ItemStatus;
  path: string | null;
  error?: { code: CliErrorCode; message: string };
}

async function readStdinTargets(): Promise<string[]> {
  if (process.stdin.isTTY) throw new CliError('usage', '"-" reads session ids from stdin, but stdin is a terminal');
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').split(/[\s,]+/).filter(Boolean);
}

async function collectTargets(input: CommandInput, ctx: CliContext): Promise<{ targets: Target[]; skipped: Item[] }> {
  const courseArg = input.options.course;
  const hasToken = input.options.token !== undefined || input.options.account !== undefined;

  if (typeof courseArg !== 'string') {
    if (hasToken) {
      throw new CliError('usage', '--token and --account only apply with --course: downloads themselves never sign in');
    }
    if (input.positionals.length === 0) throw new CliError('usage', 'missing session link or id');
    const raw = input.positionals.includes('-')
      ? [...input.positionals.filter((p) => p !== '-'), ...(await readStdinTargets())]
      : input.positionals;
    // Every argument is checked before anything is fetched.
    const ids = [...new Set(raw.map((r) => parseSessionTarget(r, input.program)))];
    if (ids.length === 0) throw new CliError('usage', 'no session ids on stdin');
    return { targets: ids.map((sessionId) => ({ sessionId })), skipped: [] };
  }

  if (input.positionals.length > 0) throw new CliError('usage', 'give either session ids or --course, not both');
  const courseId = parseCourseTarget(courseArg, input.program);
  const credentials = readCredentials(input, ctx);
  const detail = await ctx.apiClient.getCourseDetail(courseId, ANONYMOUS);
  announceCredentials(credentials);
  const sessions = await ctx.apiClient.getCourseSessions(courseId, credentials.token);
  if (sessions.length === 0) {
    throw new CliError(
      'not_found',
      'Yanhekt listed no sessions: the course has no recordings yet, this account may not watch it, or the token is no longer valid.'
    );
  }

  const targets: Target[] = [];
  const skipped: Item[] = [];
  for (const session of sessions) {
    const sessionId = String(session.session_id);
    if (session.main_url || session.vga_url) {
      targets.push({ sessionId, lecture: { courseId, courseTitle: detail.title, session } });
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
  if (skipped.length > 0) info(`${skipped.length} of ${sessions.length} sessions have no recording yet and are skipped.`);
  return { targets, skipped };
}

async function resolveLecture(target: Target, ctx: CliContext): Promise<Lecture> {
  if (target.lecture) return target.lecture;
  const { session, course } = await ctx.apiClient.getSessionDownloadInfo(target.sessionId, ANONYMOUS);
  return { courseId: String(course.id), courseTitle: course.title || 'Unknown Course', session };
}

function resolveOutputDir(input: CommandInput, ctx: CliContext, create: boolean): string {
  const explicit = input.options.output;
  if (typeof explicit === 'string') {
    // An explicit folder is created on request, like `mkdir -p` (not by a dry run).
    const dir = path.resolve(explicit);
    if (create) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        throw new CliError('failed', `cannot use ${dir}: ${toCliError(error).message}`);
      }
    }
    return dir;
  }

  // The app's folder is never created here: when it is missing it is usually a
  // disconnected drive, and a plain folder planted at its mount point would
  // make macOS mount the drive under another name.
  const dir = ctx.configService.getConfig().outputDirectory;
  if (!dir || !fs.existsSync(dir)) {
    throw new CliError('failed', `the AutoSlides output folder is not available (${dir || 'not set'})`, 'Use --output <dir>.');
  }
  return dir;
}

async function run(input: CommandInput, ctx: CliContext): Promise<CommandResult> {
  const streams = STREAM_CHOICES[(input.options.stream as string | undefined) ?? 'screen'];
  const force = input.options.force === true;
  const dryRun = input.options['dry-run'] === true;

  const outputDir = resolveOutputDir(input, ctx, !dryRun);
  const { targets, skipped } = await collectTargets(input, ctx);
  const items: Item[] = [...skipped];
  const many = targets.length > 1;

  for (const [index, target] of targets.entries()) {
    let lecture: Lecture;
    try {
      lecture = await resolveLecture(target, ctx);
    } catch (error) {
      const failure = toCliError(error);
      info(`${target.sessionId}: ${failure.message}`);
      items.push({
        session_id: target.sessionId,
        course_id: null,
        course_title: null,
        session_title: null,
        stream: null,
        status: 'failed',
        path: null,
        error: failure.toJSON(),
      });
      continue;
    }

    const { session, courseId, courseTitle } = lecture;
    info(`${many ? `[${index + 1}/${targets.length}] ` : ''}${courseTitle} · ${session.title}`);

    for (const stream of streams) {
      const base = {
        session_id: target.sessionId,
        course_id: courseId,
        course_title: courseTitle,
        session_title: session.title,
        stream,
      };
      const url = stream === 'camera' ? session.main_url : session.vga_url;
      if (!url) {
        const message = `this session has no ${stream} recording`;
        info(message);
        items.push({ ...base, status: 'failed', path: null, error: { code: 'no_recording', message } });
        continue;
      }

      const fileName = buildDownloadFileName({
        name: `${stream}_${lectureLabel(courseTitle, session.title)}`,
        courseId,
        sessionId: String(session.session_id),
      });
      const filePath = path.join(outputDir, `${fileName}.mp4`);

      if (!force && fs.existsSync(filePath)) {
        // The path itself goes to stdout just below; naming it here too printed it twice.
        info('Already downloaded. Use --force to download it again.');
        items.push({ ...base, status: 'skipped', path: filePath });
        if (!input.json) out(filePath);
        continue;
      }
      if (dryRun) {
        items.push({ ...base, status: 'planned', path: filePath });
        if (!input.json) out(filePath);
        continue;
      }

      const result = await downloadStream(stream, url, fileName, outputDir, input.options.intranet === true, ctx);
      if (result.status === 'interrupted') {
        items.push({ ...base, status: 'interrupted', path: null });
        return {
          data: { output_dir: outputDir, dry_run: dryRun, items },
          error: new CliError('interrupted', 'stopped', 'Run the same command again to resume.'),
        };
      }
      if (result.status === 'failed') {
        info(`${stream}: ${result.error.message}`);
        items.push({ ...base, status: 'failed', path: null, error: result.error.toJSON() });
        continue;
      }
      items.push({ ...base, status: 'downloaded', path: filePath });
      if (!input.json) out(filePath);
    }
  }

  const data = { output_dir: outputDir, dry_run: dryRun, items };
  const failed = items.filter((i) => i.status === 'failed');
  if (failed.length === 0) return { data };
  // One reason for every failure keeps its own exit code (3 for not found…); a mix is 1.
  const codes = new Set(failed.map((i) => i.error?.code ?? 'failed'));
  const code: CliErrorCode = codes.size === 1 ? [...codes][0] : 'failed';
  const message = failed.length === 1 && failed[0].error ? failed[0].error.message : `${failed.length} downloads failed`;
  return { data, error: new CliError(code, message) };
}

async function downloadStream(
  stream: CliStream,
  url: string,
  fileName: string,
  outputDir: string,
  isIntranetMode: boolean,
  ctx: CliContext
): Promise<{ status: 'done' | 'interrupted' } | { status: 'failed'; error: CliError }> {
  const downloadId = `cli-${stream}`;
  let interrupted = false;
  // Ctrl-C stops the workers and leaves the fetched segments in place, so the
  // same command run again picks up where this one stopped.
  const onInterrupt = (): void => {
    interrupted = true;
    ctx.m3u8DownloadService.cancelDownload(downloadId);
  };
  const stopListening = ctx.onInterrupt(onInterrupt);
  // A merge that is cut short leaves a truncated .mp4 behind; the next run
  // would take it for a finished download.
  const removePartialFile = (): void => {
    fs.rmSync(path.join(outputDir, `${fileName}.mp4`), { force: true });
  };

  try {
    await ctx.m3u8DownloadService.startDownload(
      downloadId,
      url,
      fileName,
      (progress) => {
        if (progress.phase === 0) {
          const percent = progress.total > 0 ? Math.floor((progress.current / progress.total) * 100) : 0;
          status(`Downloading ${stream}  ${progress.current}/${progress.total}  ${percent}%`);
        } else if (progress.phase === 1) {
          status(`Merging ${stream}…`);
        }
      },
      ANONYMOUS,
      { outputDir, isIntranetMode }
    );
    endStatusLine();
    // Ctrl-C in a terminal reaches FFmpeg as well; if it lost that race the
    // merge "finished" with whatever it had written.
    if (interrupted) {
      removePartialFile();
      return { status: 'interrupted' };
    }
    return { status: 'done' };
  } catch (error) {
    endStatusLine();
    removePartialFile();
    if (interrupted) return { status: 'interrupted' };
    return { status: 'failed', error: toCliError(error) };
  } finally {
    stopListening();
  }
}

export const downloadCommand: CliCommand = {
  summary: 'Download recorded sessions as .mp4 (no sign-in)',
  args: '<session link or id…>',
  description: [
    'Download recorded Yanhekt lectures as .mp4. No sign-in is needed.',
    '',
    'Give one or more session ids or session links (https://www.yanhekt.cn/session/<id>),',
    'or "-" to read them from stdin. A bare number is always a session id.',
    'To fetch every recorded session of a course, use --course with its id or',
    'link; listing the sessions is the one step that uses a sign-in.',
  ],
  examples: [
    'download https://www.yanhekt.cn/session/850101',
    'download 850101 850102 --stream both -o ~/Lectures',
    'download --course 70101 --dry-run',
    "course 70101 --json | jq -r '.data.sessions[].id' | {program} download - --json",
  ],
  options: [
    { long: 'stream', short: 's', value: 'which', choices: ['screen', 'camera', 'both'], description: 'screen (default), camera, or both' },
    { long: 'output', short: 'o', value: 'dir', description: 'Save here for this run instead of the folder set in AutoSlides' },
    { long: 'course', value: 'course', description: 'Every recorded session of this course (id or link); the list needs sign-in' },
    { long: 'dry-run', description: 'Resolve everything and print the files it would write; download nothing' },
    { long: 'force', short: 'f', description: 'Download again even if the file already exists' },
  ],
  positionals: { min: 0, max: Infinity },
  network: true,
  tokenUse: 'Only with --course, to list the course\'s sessions; the videos are always fetched anonymously',
  data: '{ output_dir, dry_run, items: [{ session_id, course_id, course_title, session_title, stream: "screen"|"camera"|null, status: "downloaded"|"skipped"|"planned"|"failed"|"interrupted", path: string|null, error?: { code, message } }] }',
  run,
};
