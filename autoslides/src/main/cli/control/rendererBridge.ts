// Main's side of the questions an `autoslides` command asks the renderer (see
// `@common/cliControl`): sign-in state and the Download panel's queue.
//
// The renderer says it is ready once its handler is installed; a reload or a
// crash takes that back and fails whatever was waiting, since the queue lives
// in the renderer and goes with it. With no main window (macOS keeps the app
// running after the last one closes) a request opens one.
import type { BrowserWindow, WebContents } from 'electron';
import {
  isFinalDownloadState,
  type CliControlMethod,
  type CliControlMethods,
  type CliControlRequest,
  type CliControlResponse,
  type CliDownloadUpdate,
} from '@common/cliControl';
import { CliError } from '../errors';

const READY_TIMEOUT_MS = 60_000;

type Waiter = { resolve: () => void; reject: (error: Error) => void };
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type DownloadListener = (update: CliDownloadUpdate) => void;

export class RendererBridge {
  private readyContents: WebContents | null = null;
  private readyWaiters: Waiter[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  // Last state per queued item, so a listener added after an update still sees it.
  private latest = new Map<string, CliDownloadUpdate>();
  private listeners = new Map<string, Set<DownloadListener>>();
  private resetListeners = new Set<(reason: string) => void>();

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly openWindow: () => void,
  ) {}

  // The renderer's three channels (`cli:control*`, registered in `ipc/cliIpc.ts`).

  /** `contents` installed its handler. Only the main window's renderer calls this. */
  markReady(contents: WebContents): void {
    if (this.readyContents === contents) return;
    this.readyContents = contents;
    const lost = (): void => {
      contents.off('did-start-navigation', onNavigation);
      if (this.readyContents !== contents) return;
      this.readyContents = null;
      this.fail('AutoSlides reloaded its window, which clears the download list');
    };
    // In-page navigations (the router) keep the renderer; only a new document loses it.
    const onNavigation = (details: { isMainFrame: boolean; isSameDocument: boolean }): void => {
      if (details.isMainFrame && !details.isSameDocument) lost();
    };
    contents.on('did-start-navigation', onNavigation);
    contents.once('render-process-gone', lost);
    contents.once('destroyed', lost);
    for (const waiter of this.readyWaiters.splice(0)) waiter.resolve();
  }

  private fail(reason: string): void {
    const error = new CliError('failed', reason);
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.latest.clear();
    for (const listener of [...this.resetListeners]) listener(reason);
  }

  private whenReady(): Promise<void> {
    if (this.readyContents && !this.readyContents.isDestroyed()) return Promise.resolve();
    if (!this.getWindow()) this.openWindow();
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };
      this.readyWaiters.push(waiter);
      setTimeout(() => {
        const index = this.readyWaiters.indexOf(waiter);
        if (index === -1) return;
        this.readyWaiters.splice(index, 1);
        reject(new CliError('app_not_running', 'AutoSlides started but its window did not get ready in time'));
      }, READY_TIMEOUT_MS);
    });
  }

  async request<M extends CliControlMethod>(
    method: M,
    params: CliControlMethods[M]['params'],
  ): Promise<CliControlMethods[M]['result']> {
    await this.whenReady();
    const contents = this.readyContents;
    if (!contents) throw new CliError('app_not_running', 'AutoSlides has no window to run the command in');
    const id = this.nextId++;
    const request: CliControlRequest<M> = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      contents.send('cli:controlRequest', request);
    });
  }

  handleResponse(sender: WebContents, response: CliControlResponse): void {
    if (sender !== this.readyContents) return;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.message));
  }

  handleDownloadUpdate(sender: WebContents, update: CliDownloadUpdate): void {
    if (sender !== this.readyContents) return;
    this.latest.set(update.itemId, update);
    for (const listener of [...(this.listeners.get(update.itemId) ?? [])]) listener(update);
  }

  /** Note an item's state as `queueDownload` answered it, before any update arrives. */
  seedDownload(update: CliDownloadUpdate): void {
    if (!this.latest.has(update.itemId)) this.latest.set(update.itemId, update);
  }

  /**
   * Follow one queued item until it ends. `onUpdate` sees its current state at
   * once, then every change. Returns a function that stops listening.
   */
  watchDownload(itemId: string, onUpdate: DownloadListener): () => void {
    let set = this.listeners.get(itemId);
    if (!set) {
      set = new Set();
      this.listeners.set(itemId, set);
    }
    set.add(onUpdate);
    const current = this.latest.get(itemId);
    if (current) onUpdate(current);
    return () => {
      set.delete(onUpdate);
      if (set.size === 0) {
        this.listeners.delete(itemId);
        const last = this.latest.get(itemId);
        if (last && isFinalDownloadState(last.state)) this.latest.delete(itemId);
      }
    };
  }

  /** Called with a reason when the renderer goes away. Returns a function that stops listening. */
  onReset(listener: (reason: string) => void): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }
}
