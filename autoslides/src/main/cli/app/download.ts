// `autoslides download`: put recorded sessions in the app's Download panel and
// follow them until they finish.
//
// Unlike `yhdl download`, which fetches the files itself, anonymously, on the
// route its own flags choose, everything here is the app's: its signed-in
// account, its network settings (route, prefer-anonymous), its output folder,
// and the queue itself — concurrency, auto-extraction, the panel's rows. The
// files are found and named the same way, so `--dry-run` and the skip of a
// file that is already there behave as in the terminal.
//
// Ctrl-C in the terminal only stops waiting; what was queued keeps going.
import fs from 'node:fs';
import { isFinalDownloadState, type CliDownloadUpdate } from '@common/cliControl';
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
import type { CommandInput, CommandResult } from '../types';
import { requireSignIn } from './signIn';
import type { AppCommand, AppCommandContext } from './types';

/** An item the app is downloading for this command. */
interface Following {
  /** Its row in `items`. */
  index: number;
  itemId: string;
  stream: CliStream;
  filePath: string;
}

function outputDirOf(ctx: AppCommandContext): string {
  // Not created here, as in the terminal: a missing folder is usually a disconnected drive.
  const dir = ctx.configService.getConfig().outputDirectory;
  if (!dir || !fs.existsSync(dir)) {
    throw new CliError(
      'failed',
      `the AutoSlides output folder is not available (${dir || 'not set'})`,
      'Choose one in Settings > Download & Playback, or reconnect its drive.'
    );
  }
  return dir;
}

function finalItem(item: Item, follow: Following, update: CliDownloadUpdate): Item {
  if (update.state === 'completed') return { ...item, status: 'downloaded', path: follow.filePath };
  const message =
    update.state === 'removed' ? 'removed from the download list in AutoSlides' : update.error || 'download failed';
  return { ...item, status: 'failed', path: null, error: { code: 'failed', message } };
}

/** Wait for every followed item to end, showing their progress. Resolves early when the client leaves. */
function follow(following: Following[], items: Item[], input: CommandInput, ctx: AppCommandContext): Promise<void> {
  return new Promise((resolve) => {
    const progress = new Map<string, CliDownloadUpdate>();
    const stops: Array<() => void> = [];
    let left = following.length;
    let closed = false;

    const close = (): void => {
      if (closed) return;
      closed = true;
      stops.forEach((stop) => stop());
      ctx.signal.removeEventListener('abort', close);
      ctx.term.endStatusLine();
      resolve();
    };

    const render = (): void => {
      const states = following.map((f) => progress.get(f.itemId)).filter((u): u is CliDownloadUpdate => !!u);
      if (following.length === 1) {
        const [only] = states;
        if (!only) return;
        const stream = following[0].stream;
        ctx.term.status(
          only.state === 'queued' ? `Waiting in the download list (${stream})…`
          : only.state === 'processing' ? `Merging ${stream}…`
          : `Downloading ${stream}  ${only.progress}%`
        );
        return;
      }
      const done = following.length - left;
      const percent = Math.floor(states.reduce((sum, u) => sum + u.progress, 0) / following.length);
      ctx.term.status(`Downloading  ${done}/${following.length} finished  ${percent}%`);
    };

    for (const f of following) {
      let finished = false;
      stops.push(
        ctx.renderer.watchDownload(f.itemId, (update) => {
          if (finished || closed) return;
          progress.set(f.itemId, update);
          if (!isFinalDownloadState(update.state)) {
            render();
            return;
          }
          finished = true;
          left -= 1;
          const item = finalItem(items[f.index], f, update);
          items[f.index] = item;
          if (item.status === 'downloaded') {
            ctx.term.endStatusLine();
            if (!input.json) ctx.term.out(f.filePath);
          } else {
            ctx.term.info(`${item.session_title ?? item.session_id} (${f.stream}): ${item.error?.message}`);
          }
          // After the loop, so every watcher is registered before any stops.
          if (left === 0) queueMicrotask(close);
          else render();
        })
      );
    }

    stops.push(
      ctx.renderer.onReset((reason) => {
        for (const f of following) {
          if (items[f.index].status === 'queued') {
            items[f.index] = { ...items[f.index], status: 'failed', path: null, error: { code: 'failed', message: reason } };
          }
        }
        close();
      })
    );
    ctx.signal.addEventListener('abort', close);
    if (left === 0) queueMicrotask(close);
  });
}

async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const streams = streamsOf(input);
  const force = input.options.force === true;
  const dryRun = input.options['dry-run'] === true;
  const wait = input.options['no-wait'] !== true;

  const { token } = await requireSignIn(ctx);
  const outputDir = outputDirOf(ctx);
  const { targets, skipped } = await collectTargets(input, {
    apiClient: ctx.apiClient,
    lookupToken: token,
    listToken: () => token,
    notice: ctx.term.info,
  });
  const items: Item[] = [...skipped];
  const following: Following[] = [];
  const many = targets.length > 1;

  for (const [index, target] of targets.entries()) {
    if (ctx.signal.aborted) break;
    let lecture: Lecture;
    try {
      lecture = await resolveLecture(target, ctx.apiClient, token);
    } catch (error) {
      const item = unresolvedItem(target.sessionId, error);
      ctx.term.info(`${target.sessionId}: ${item.error?.message}`);
      items.push(item);
      continue;
    }

    ctx.term.info(`${many ? `[${index + 1}/${targets.length}] ` : ''}${lecture.course.title} · ${lecture.session.title}`);

    for (const stream of streams) {
      const base = itemBase(target, lecture, stream);
      if (!streamUrl(lecture, stream)) {
        const message = `this session has no ${stream} recording`;
        ctx.term.info(message);
        items.push({ ...base, status: 'failed', path: null, error: { code: 'no_recording', message } });
        continue;
      }

      const { filePath } = plannedFile(outputDir, lecture, stream);
      if (!force && fs.existsSync(filePath)) {
        ctx.term.info('Already downloaded. Use --force to queue it again.');
        items.push({ ...base, status: 'skipped', path: filePath });
        if (!input.json) ctx.term.out(filePath);
        continue;
      }
      if (dryRun) {
        items.push({ ...base, status: 'planned', path: filePath });
        if (!input.json) ctx.term.out(filePath);
        continue;
      }

      const queued = await ctx.renderer.request('queueDownload', {
        lecture: { session: lecture.session, course: lecture.course },
        stream,
      });
      if (!queued.added) ctx.term.info('Already in the download list in AutoSlides; following that one.');
      if (queued.state === 'completed') {
        items.push({ ...base, status: 'downloaded', path: filePath });
        if (!input.json) ctx.term.out(filePath);
        continue;
      }
      ctx.renderer.seedDownload(queued);
      following.push({ index: items.length, itemId: queued.itemId, stream, filePath });
      items.push({ ...base, status: 'queued', path: filePath });
    }
  }

  const data = { output_dir: outputDir, dry_run: dryRun, waited: wait, items };
  if (!wait) {
    const hints = following.length > 0 ? ['Queued in AutoSlides; the Download panel shows its progress.'] : undefined;
    return { data, hints, error: failureOf(items) };
  }
  await follow(following, items, input, ctx);
  return { data, error: failureOf(items) };
}

export const appDownloadCommand: AppCommand = {
  summary: 'Download recorded sessions through the app\'s Download panel',
  args: '<session link or id…>',
  description: [
    'Queue recorded Yanhekt lectures in the AutoSlides Download panel and wait',
    'until they finish. The app\'s account, network settings, output folder and',
    'auto-extraction apply. Ctrl-C stops waiting; the downloads keep going.',
    '',
    'Give one or more session ids or session links (https://www.yanhekt.cn/session/<id>),',
    'or "-" to read them from stdin. A bare number is always a session id.',
    'To queue every recorded session of a course, use --course with its id or link.',
  ],
  examples: [
    'download https://www.yanhekt.cn/session/850101',
    'download 850101 850102 --stream both',
    'download --course 70101 --dry-run',
    'download --course 70101 --no-wait --json',
  ],
  options: [
    STREAM_OPTION,
    { long: 'course', value: 'course', description: 'Every recorded session of this course (id or link)' },
    { long: 'dry-run', description: 'Resolve everything and print the files it would write; queue nothing' },
    { long: 'force', short: 'f', description: 'Queue it even if the file is already in the output folder' },
    { long: 'no-wait', description: 'Return once queued instead of waiting for the downloads' },
  ],
  positionals: { min: 0, max: Infinity },
  data: `{ output_dir, dry_run, waited, items: [${ITEM_SHAPE}] }; ItemStatus: "downloaded"|"skipped"|"planned"|"queued"|"failed"`,
  serve,
};
