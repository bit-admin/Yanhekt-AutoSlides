// `yhdl` / `autoslides download`: fetch one recorded session's video.
//
// Deliberately narrower than the app's Download panel: recordings from
// cvideo.yanhekt.cn only, no sign-in, no extraction, no queue. The session is
// resolved from its id through the two lookups that need no account (session
// detail by id, then the video record), and the CDN is signed with an
// anonymously minted video token — so an empty login token is passed all the
// way down and no request carries a Bearer.
//
// Files are named exactly as the app names them (`buildDownloadFileName`), so
// a lecture fetched here shows up in the Lectures library like any other.
import fs from 'node:fs';
import path from 'node:path';
import { cliProgramName } from '@common/cliCommands';
import { buildDownloadFileName } from '@common/downloadNaming';
import { lectureLabel } from '@common/lectureNaming';
import { queueErrorText } from '@common/recordingProblems';
import { parseDownloadArgs, type CliStream, type DownloadOptions } from '../downloadArgs';
import { EXIT, endStatusLine, fail, info, out, status } from '../terminal';
import type { CliContext } from '../types';

const PROGRAM = cliProgramName('download');
const ANONYMOUS = '';

export function downloadHelp(): string {
  return [
    `Usage: ${PROGRAM} <session link or id> [options]`,
    '',
    'Download a recorded Yanhekt lecture as an .mp4. No sign-in is needed.',
    '',
    'The session can be its id, or the link of its page on yanhekt.cn, with or',
    'without https://. A course link is not enough: open one session and use that.',
    '',
    'Examples:',
    `  ${PROGRAM} https://www.yanhekt.cn/session/<id>`,
    `  ${PROGRAM} <id> --stream both -o ~/Lectures`,
    '',
    'Options:',
    '  -s, --stream <which>  screen (default), camera, or both',
    '  -o, --output <dir>    Save here for this run instead of the folder set in AutoSlides',
    '      --intranet        Use the campus intranet route (default: public network)',
    '  -f, --force           Download again even if the file already exists',
    '  -v, --verbose         Print diagnostic logs',
    '  -h, --help            Show this help',
    '  -V, --version         Show the AutoSlides version',
  ].join('\n');
}

export async function runDownload(args: readonly string[], ctx: CliContext): Promise<number> {
  const parsed = parseDownloadArgs(args);
  if (parsed.kind === 'help') {
    out(downloadHelp());
    return EXIT.ok;
  }
  if (parsed.kind === 'version') {
    out(ctx.version);
    return EXIT.ok;
  }
  if (parsed.kind === 'error') {
    fail(PROGRAM, parsed.message);
    info(`Try '${PROGRAM} --help'.`);
    return EXIT.usage;
  }

  const options = parsed.options;
  if (options.verbose) ctx.setVerbose();

  const outputDir = resolveOutputDir(options, ctx);
  if (!outputDir.ok) {
    fail(PROGRAM, outputDir.message);
    return EXIT.failed;
  }

  // The network route is the flag's alone: external unless `--intranet`, and
  // the app's own connection mode is deliberately ignored (owner ruling), so a
  // command behaves the same whatever the app happens to be set to.
  const isIntranetMode = options.intranet;
  if (isIntranetMode) ctx.intranetMappingService.enableForThisProcess();

  let lecture;
  try {
    lecture = await ctx.apiClient.getSessionDownloadInfo(options.sessionId, ANONYMOUS);
  } catch (error) {
    fail(PROGRAM, describeError(error));
    return EXIT.failed;
  }

  const { session, course } = lecture;
  const courseTitle = course.title || 'Unknown Course';
  info(`${courseTitle} · ${session.title}`);

  let failures = 0;
  for (const stream of options.streams) {
    const url = stream === 'camera' ? session.main_url : session.vga_url;
    if (!url) {
      fail(PROGRAM, `this session has no ${stream} recording`);
      failures++;
      continue;
    }

    const fileName = buildDownloadFileName({
      name: `${stream}_${lectureLabel(courseTitle, session.title)}`,
      courseId: course.id,
      sessionId: session.session_id,
    });
    const filePath = path.join(outputDir.dir, `${fileName}.mp4`);

    if (!options.force && fs.existsSync(filePath)) {
      // The path itself goes to stdout just below; naming it here too printed it twice.
      info('Already downloaded. Use --force to download it again.');
      out(filePath);
      continue;
    }

    const result = await downloadStream(stream, url, fileName, outputDir.dir, isIntranetMode, ctx);
    if (result === 'interrupted') return EXIT.interrupted;
    if (result === 'failed') {
      failures++;
      continue;
    }
    out(filePath);
  }

  return failures > 0 ? EXIT.failed : EXIT.ok;
}

function resolveOutputDir(
  options: DownloadOptions,
  ctx: CliContext
): { ok: true; dir: string } | { ok: false; message: string } {
  if (options.outputDir) {
    // An explicit folder is created on request, like `mkdir -p`.
    const dir = path.resolve(options.outputDir);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      return { ok: false, message: `cannot use ${dir}: ${describeError(error)}` };
    }
    return { ok: true, dir };
  }

  // The app's folder is never created here: when it is missing it is usually a
  // disconnected drive, and a plain folder planted at its mount point would
  // make macOS mount the drive under another name.
  const dir = ctx.configService.getConfig().outputDirectory;
  if (!dir || !fs.existsSync(dir)) {
    return {
      ok: false,
      message: `the AutoSlides output folder is not available (${dir || 'not set'}). Use --output <dir>.`,
    };
  }
  return { ok: true, dir };
}

async function downloadStream(
  stream: CliStream,
  url: string,
  fileName: string,
  outputDir: string,
  isIntranetMode: boolean,
  ctx: CliContext
): Promise<'done' | 'failed' | 'interrupted'> {
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
      info('Stopped.');
      return 'interrupted';
    }
    return 'done';
  } catch (error) {
    endStatusLine();
    removePartialFile();
    if (interrupted) {
      info('Stopped. Run the same command again to resume.');
      return 'interrupted';
    }
    fail(PROGRAM, `${stream}: ${describeError(error)}`);
    return 'failed';
  } finally {
    stopListening();
  }
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return queueErrorText(message) || 'unknown error';
}
