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
import { announceCredentials, readCredentials } from '../auth';
import { toCliError } from '../classifyError';
import {
  ITEM_SHAPE,
  STREAM_OPTION,
  collectTargets,
  failureOf,
  itemBase,
  plannedFile,
  resolveLecture,
  streamUrl,
  streamsOf,
  unresolvedItem,
  type CliStream,
  type Item,
  type Lecture,
} from '../downloadPlan';
import { CliError } from '../errors';
import { endStatusLine, info, out, status } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';

async function readStdinTargets(): Promise<string[]> {
  if (process.stdin.isTTY) throw new CliError('usage', '"-" reads session ids from stdin, but stdin is a terminal');
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').split(/[\s,]+/).filter(Boolean);
}

/** The arguments with `-` replaced by the ids on stdin. */
async function expandStdin(input: CommandInput): Promise<CommandInput> {
  if (!input.positionals.includes('-')) return input;
  const fromStdin = await readStdinTargets();
  if (fromStdin.length === 0) throw new CliError('usage', 'no session ids on stdin');
  return { ...input, positionals: [...input.positionals.filter((p) => p !== '-'), ...fromStdin] };
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

async function run(rawInput: CommandInput, ctx: CliContext): Promise<CommandResult> {
  const streams = streamsOf(rawInput);
  const force = rawInput.options.force === true;
  const dryRun = rawInput.options['dry-run'] === true;

  const hasToken = rawInput.options.token !== undefined || rawInput.options.account !== undefined;
  if (typeof rawInput.options.course !== 'string' && hasToken) {
    throw new CliError('usage', '--token and --account only apply with --course: downloads themselves never sign in');
  }

  const outputDir = resolveOutputDir(rawInput, ctx, !dryRun);
  const input = await expandStdin(rawInput);
  const { targets, skipped } = await collectTargets(input, {
    apiClient: ctx.apiClient,
    lookupToken: ANONYMOUS,
    listToken: () => {
      const credentials = readCredentials(input, ctx);
      announceCredentials(credentials);
      return credentials.token;
    },
    notice: info,
  });
  const items: Item[] = [...skipped];
  const many = targets.length > 1;

  for (const [index, target] of targets.entries()) {
    let lecture: Lecture;
    try {
      lecture = await resolveLecture(target, ctx.apiClient, ANONYMOUS);
    } catch (error) {
      const item = unresolvedItem(target.sessionId, error);
      info(`${target.sessionId}: ${item.error?.message}`);
      items.push(item);
      continue;
    }

    info(`${many ? `[${index + 1}/${targets.length}] ` : ''}${lecture.course.title} · ${lecture.session.title}`);

    for (const stream of streams) {
      const base = itemBase(target, lecture, stream);
      const url = streamUrl(lecture, stream);
      if (!url) {
        const message = `this session has no ${stream} recording`;
        info(message);
        items.push({ ...base, status: 'failed', path: null, error: { code: 'no_recording', message } });
        continue;
      }

      const { fileName, filePath } = plannedFile(outputDir, lecture, stream);

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

  return { data: { output_dir: outputDir, dry_run: dryRun, items }, error: failureOf(items) };
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
    STREAM_OPTION,
    { long: 'output', short: 'o', value: 'dir', description: 'Save here for this run instead of the folder set in AutoSlides' },
    { long: 'course', value: 'course', description: 'Every recorded session of this course (id or link); the list needs sign-in' },
    { long: 'dry-run', description: 'Resolve everything and print the files it would write; download nothing' },
    { long: 'force', short: 'f', description: 'Download again even if the file already exists' },
  ],
  positionals: { min: 0, max: Infinity },
  network: true,
  tokenUse: 'Only with --course, to list the course\'s sessions; the videos are always fetched anonymously',
  data: `{ output_dir, dry_run, items: [${ITEM_SHAPE}] }; ItemStatus: "downloaded"|"skipped"|"planned"|"failed"|"interrupted"`,
  run,
};
