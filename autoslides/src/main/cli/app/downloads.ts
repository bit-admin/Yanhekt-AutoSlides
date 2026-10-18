// `autoslides downloads`: the app's Download panel from the terminal — list its
// rows, wait for them, and the panel's own buttons (cancel, retry, Clear
// Completed). The panel is the one in the window: what is done here shows
// there at once, and the other way round.
//
// Items are named by their item id (from `--json`), or by a session id or link,
// which takes every row of that session. An app-only command: `yhdl` has no
// queue. Yanhekt rows only: the renderer leaves Yanhe 2.0 transcripts out.
// Works while signed out, except `retry`, which downloads again.
import path from 'node:path';
import type { CliDownloadUpdate, CliQueueItem } from '@common/cliControl';
import { buildDownloadFileName } from '@common/downloadNaming';
import { parseSessionInput } from '@common/sessionInput';
import { CliError } from '../errors';
import { table } from '../format';
import type { CommandInput, CommandResult } from '../types';
import { followDownloads } from './followDownloads';
import { requireSignIn } from './signIn';
import type { AppCommand, AppCommandContext } from './types';

const ACTIONS = ['list', 'wait', 'cancel', 'retry', 'clear'] as const;
type Action = (typeof ACTIONS)[number];

const isAction = (word: string): word is Action => (ACTIONS as readonly string[]).includes(word);

/** The panel's "Cancelled by user", told apart from a failure. */
const CANCELLED = 'Cancelled by user';

type Status = 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'removed';

interface Row {
  item_id: string;
  session_id: string;
  course_id: string | null;
  course_title: string;
  session_title: string;
  kind: CliQueueItem['kind'];
  status: Status;
  progress: number;
  path: string | null;
  error?: string;
  added_at: string;
  completed_at: string | null;
  extraction: CliQueueItem['extraction'];
}

const ROW_SHAPE =
  '{ item_id, session_id, course_id, course_title, session_title, kind: "screen"|"camera"|"audio", status: RowStatus, progress: 0-100, path: string|null, error?, added_at, completed_at: string|null, extraction: { state, progress, error? }|null }';

function statusOf(update: Pick<CliDownloadUpdate, 'state' | 'error'>): Status {
  if (update.state === 'error') return update.error === CANCELLED ? 'cancelled' : 'failed';
  return update.state;
}

const EXTENSIONS: Record<CliQueueItem['kind'], string> = {
  screen: '.mp4',
  camera: '.mp4',
  audio: '.aac',
};

function rowOf(item: CliQueueItem, outputDir: string): Row {
  const fileName = outputDir
    ? `${buildDownloadFileName({ name: item.name, courseId: item.courseId ?? undefined, sessionId: item.sessionId })}${EXTENSIONS[item.kind]}`
    : null;
  const status = statusOf(item);
  return {
    item_id: item.itemId,
    session_id: item.sessionId,
    course_id: item.courseId,
    course_title: item.courseTitle,
    session_title: item.sessionTitle,
    kind: item.kind,
    status,
    progress: item.progress,
    path: fileName ? path.join(outputDir, fileName) : null,
    ...(item.error && status !== 'cancelled' ? { error: item.error } : {}),
    added_at: new Date(item.addedAt).toISOString(),
    completed_at: item.completedAt ? new Date(item.completedAt).toISOString() : null,
    extraction: item.extraction,
  };
}

function rowsText(rows: readonly Row[]): string {
  if (rows.length === 0) return 'The download list is empty.';
  return table(
    ['STATUS', 'DONE', 'KIND', 'SESSION', 'LECTURE', 'ITEM'],
    rows.map((r) => [
      r.status,
      `${r.progress}%`,
      r.kind,
      r.session_id,
      `${r.course_title} · ${r.session_title}`,
      r.item_id,
    ])
  );
}

/** The rows the arguments name, in panel order. Every argument must match something. */
function select(rows: readonly Row[], selectors: readonly string[], program: string): Row[] {
  const picked = new Set<string>();
  for (const selector of selectors) {
    const exact = rows.find((r) => r.item_id === selector);
    if (exact) {
      picked.add(exact.item_id);
      continue;
    }
    const parsed = parseSessionInput(selector);
    if (parsed.kind !== 'session') {
      throw new CliError('usage', `not an item id, session id or session link: ${selector}`, `Item ids are in '${program} downloads --json'.`);
    }
    const matches = rows.filter((r) => r.session_id === parsed.sessionId);
    if (matches.length === 0) {
      throw new CliError('not_found', `nothing in the download list for session ${parsed.sessionId}`, `Run '${program} downloads' to see the list.`);
    }
    matches.forEach((r) => picked.add(r.item_id));
  }
  return rows.filter((r) => picked.has(r.item_id));
}

async function listRows(ctx: AppCommandContext): Promise<Row[]> {
  const outputDir = ctx.configService.getConfig().outputDirectory || '';
  const { items } = await ctx.renderer.request('listDownloads', {});
  return items.map((item) => rowOf(item, outputDir));
}

const isUnfinished = (r: Row): boolean => r.status === 'queued' || r.status === 'downloading' || r.status === 'processing';

/** Wait for the unfinished ones among `rows`; each row ends up with how it ended. */
async function waitFor(rows: Row[], ctx: AppCommandContext): Promise<void> {
  const unfinished = rows.filter(isUnfinished);
  if (unfinished.length === 0) return;
  const states = await ctx.renderer.request('followDownloads', { itemIds: unfinished.map((r) => r.item_id) });
  states.forEach((state) => ctx.renderer.seedDownload(state));

  const byId = new Map(rows.map((r, index) => [r.item_id, index]));
  const update = (itemId: string, change: Partial<Row>): void => {
    const index = byId.get(itemId);
    if (index !== undefined) rows[index] = { ...rows[index], ...change };
  };
  const following = unfinished.map((r) => ({ itemId: r.item_id, label: r.kind, row: r }));
  await followDownloads(following, ctx, {
    onEnd: (f, end) => {
      const status = statusOf(end);
      const error = status === 'failed' ? end.error || 'download failed' : undefined;
      update(f.itemId, { status, progress: end.progress, ...(error ? { error } : {}) });
      const label = `${f.row.session_title} (${f.row.kind})`;
      if (status === 'completed') {
        if (f.row.path) ctx.term.out(f.row.path);
      } else {
        ctx.term.info(`${label}: ${status === 'failed' ? error : status === 'removed' ? 'removed from the download list' : 'cancelled'}`);
      }
    },
    onReset: (reason) => {
      for (const f of following) {
        const index = byId.get(f.itemId);
        if (index !== undefined && isUnfinished(rows[index])) update(f.itemId, { status: 'failed', error: reason });
      }
    },
  });
}

/** The run's error when something it waited for did not complete. */
function failureOf(rows: readonly Row[]): CliError | undefined {
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'cancelled' || r.status === 'removed' || isUnfinished(r));
  if (failed.length === 0) return undefined;
  if (failed.length === 1) {
    const [only] = failed;
    return new CliError('failed', `${only.session_title} (${only.kind}): ${only.error ?? only.status}`);
  }
  return new CliError('failed', `${failed.length} downloads did not complete`);
}

async function serve(input: CommandInput, ctx: AppCommandContext): Promise<CommandResult> {
  const [first, ...rest] = input.positionals;
  const action: Action = first === undefined ? 'list' : isAction(first) ? first : 'list';
  const selectors = first !== undefined && isAction(first) ? rest : input.positionals;
  const all = input.options.all === true;

  if (first !== undefined && !isAction(first) && !/^\d+$/.test(first) && parseSessionInput(first).kind !== 'session') {
    // A session id or link alone lists that session; any other word is a typo.
    throw new CliError('usage', `unknown action: ${first}`, `Actions: ${ACTIONS.join(', ')}.`);
  }
  if (all && action !== 'cancel' && action !== 'retry') {
    throw new CliError('usage', '--all only applies to cancel and retry');
  }
  if (action === 'clear' && selectors.length > 0) {
    throw new CliError('usage', 'clear takes no arguments; it removes every finished and failed row');
  }
  if ((action === 'cancel' || action === 'retry') && selectors.length === 0 && !all) {
    throw new CliError('usage', `say what to ${action}: item ids, session ids or links, or --all`);
  }
  if (all && selectors.length > 0) {
    throw new CliError('usage', '--all takes no item or session arguments');
  }

  // Only a retry reaches Yanhekt (it downloads again); the rest is the panel's own business.
  if (action === 'retry') await requireSignIn(ctx);
  const rows = await listRows(ctx);
  const outputDir = ctx.configService.getConfig().outputDirectory || null;

  switch (action) {
    case 'list': {
      const shown = selectors.length > 0 ? select(rows, selectors, input.program) : rows;
      return { data: { output_dir: outputDir, items: shown }, text: rowsText(shown) };
    }

    case 'wait': {
      // Nothing named: everything unfinished now (not what is queued later).
      const picked = selectors.length > 0 ? select(rows, selectors, input.program) : rows.filter(isUnfinished);
      if (picked.length === 0) {
        return { data: { output_dir: outputDir, items: [] }, text: 'Nothing is downloading.' };
      }
      await waitFor(picked, ctx);
      if (ctx.signal.aborted) throw new CliError('interrupted', 'stopped waiting; the downloads keep going');
      return { data: { output_dir: outputDir, items: picked }, error: failureOf(picked) };
    }

    case 'cancel':
    case 'retry': {
      const eligible = action === 'cancel' ? isUnfinished : (r: Row): boolean => r.status === 'failed' || r.status === 'cancelled';
      const picked = all ? rows.filter(eligible) : select(rows, selectors, input.program);
      const changes =
        picked.length > 0
          ? await ctx.renderer.request('changeDownloads', { action, itemIds: picked.map((r) => r.item_id) })
          : [];
      const byId = new Map(changes.map((c) => [c.itemId, c]));
      const items = picked.map((r) => {
        const c = byId.get(r.item_id);
        if (!c?.changed) return { ...r, changed: false };
        // A cancelled running row turns into the panel's "Cancelled by user".
        const status = statusOf({ state: c.state, error: action === 'cancel' ? CANCELLED : undefined });
        const { error: _error, ...rest } = r;
        return { ...rest, status, progress: action === 'retry' || status === 'cancelled' ? 0 : r.progress, changed: true };
      });
      const done = items.filter((i) => i.changed).length;
      const verb = action === 'cancel' ? 'Cancelled' : 'Queued again';
      const unchanged = items.length - done;
      const text =
        items.length === 0
          ? `Nothing to ${action}.`
          : `${verb}: ${done}${unchanged > 0 ? ` (${unchanged} ${action === 'cancel' ? 'had already finished' : 'had not failed'})` : ''}.`;
      const hints = action === 'retry' && done > 0 ? [`Run '${input.program} downloads wait' to follow them.`] : undefined;
      return { data: { action, items }, text, hints };
    }

    case 'clear': {
      const { removed } = await ctx.renderer.request('clearDownloads', {});
      return { data: { removed }, text: removed === 0 ? 'Nothing to clear.' : `Removed ${removed} finished or failed ${removed === 1 ? 'row' : 'rows'}.` };
    }
  }
}

export const appDownloadsCommand: AppCommand = {
  summary: 'List, wait for, cancel or retry what is in the Download panel',
  args: '[list|wait|cancel|retry|clear] [item, session id or link…]',
  description: [
    'The AutoSlides Download panel, as it is in the window. With no action,',
    'list its rows. Name rows by item id (from --json) or by a session id or',
    'link, which takes every row of that session.',
    '',
    '  list    List the rows (all, or the ones named)',
    '  wait    Wait until the named rows, or everything unfinished, end.',
    '          Ctrl-C stops waiting; the downloads keep going',
    '  cancel  Stop unfinished rows (a waiting row leaves the list); --all for every one',
    '  retry   Queue failed or cancelled rows again; --all for every one',
    '  clear   Remove every finished and failed row (the panel\'s Clear Completed)',
  ],
  examples: [
    'downloads',
    'downloads --json',
    'downloads wait',
    'downloads wait 850101',
    'downloads cancel 850101',
    'downloads retry --all',
    'downloads clear',
  ],
  options: [{ long: 'all', description: 'With cancel or retry: every row it applies to' }],
  positionals: { min: 0, max: Infinity },
  data:
    `list / wait: { output_dir, items: [${ROW_SHAPE}] }; cancel / retry: { action, items: [Row & { changed: boolean }] }; clear: { removed: number }; ` +
    'RowStatus: "queued"|"downloading"|"processing"|"completed"|"failed"|"cancelled"|"removed"',
  serve,
};

export { rowOf, select };
