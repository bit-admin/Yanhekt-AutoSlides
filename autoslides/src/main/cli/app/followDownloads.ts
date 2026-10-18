// Wait for items in the app's Download panel to end, showing their progress on
// the client's status line. Shared by `download` (what it just queued) and
// `downloads wait` (what is already there).
import { isFinalDownloadState, type CliDownloadUpdate } from '@common/cliControl';
import type { AppCommandContext } from './types';

export interface Followed {
  itemId: string;
  /** What the status line calls it when it is the only one: `screen`, `camera`… */
  label: string;
}

export interface FollowHandlers<F extends Followed> {
  /** One item ended (completed, failed, removed). Called once per item. */
  onEnd: (followed: F, update: CliDownloadUpdate) => void;
  /** The renderer went away with items still running; `reason` says why. */
  onReset: (reason: string) => void;
}

/**
 * Resolves when every item has ended, the client leaves (Ctrl-C) or the
 * renderer goes away. Items should already be seeded on the bridge
 * (`RendererBridge.seedDownload`) and followed by the renderer.
 */
export function followDownloads<F extends Followed>(
  following: readonly F[],
  ctx: AppCommandContext,
  handlers: FollowHandlers<F>,
): Promise<void> {
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
        const { label } = following[0];
        ctx.term.status(
          only.state === 'queued' ? `Waiting in the download list (${label})…`
          : only.state === 'processing' ? `Merging ${label}…`
          : `Downloading ${label}  ${only.progress}%`
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
          ctx.term.endStatusLine();
          handlers.onEnd(f, update);
          // After the loop, so every watcher is registered before any stops.
          if (left === 0) queueMicrotask(close);
          else render();
        })
      );
    }

    stops.push(
      ctx.renderer.onReset((reason) => {
        handlers.onReset(reason);
        close();
      })
    );
    ctx.signal.addEventListener('abort', close);
    if (left === 0) queueMicrotask(close);
  });
}
