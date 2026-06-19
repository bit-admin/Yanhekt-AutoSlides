import { createLogger } from '@shared/utils/logger';
const log = createLogger('WorkerClientFactory');
/**
 * Generic Web Worker request/response client. Replaces the duplicated
 * lazy-init/pending-map/ID-counter scaffolding shared by mlClassifierClient
 * and autoCropWorkerClient.
 *
 * Out of scope (different pattern, not unified):
 *   - pHashWorkerClient: per-request addEventListener/removeEventListener
 *     with string IDs (no shared pending map).
 *   - processing/workerHelpers.ts (SlideProcessorService): class-based with
 *     self-healing (auto-restart on error) and per-request 30s timeouts.
 */

export interface WorkerMessageBase {
  id: string;
  type: string;
}

export interface WorkerResponseBase {
  id: string;
  success: boolean;
  error?: string;
}

export interface WorkerClient<TResponse extends WorkerResponseBase = WorkerResponseBase> {
  request<R extends TResponse = TResponse>(
    message: Omit<WorkerMessageBase, 'id'> & Record<string, unknown>,
    transferables?: Transferable[],
  ): Promise<R>;
  destroy(): void;
}

export interface CreateWorkerClientOptions<TResponse extends WorkerResponseBase = WorkerResponseBase> {
  /**
   * Factory that constructs the worker. Use Vite's `?worker` import so the
   * worker is statically detected and compiled, e.g.
   * `import MyWorker from './my.worker?worker'` → `createWorker: () => new MyWorker()`.
   * (A bare `new Worker(new URL(...))` passed through a variable is NOT detected
   * by Vite and gets copied as a raw `.ts` asset in the packaged build.)
   */
  createWorker: () => Worker;
  /** Short name used in error logs (e.g. `'autoCrop'`, `'slideClassifier'`). */
  workerName: string;
  /**
   * Optional predicate to filter out non-response messages (e.g. log frames).
   * Return `true` if the incoming message is a response that should be routed
   * through the pending map; `false` to ignore it.
   */
  isResponse?: (data: unknown) => data is TResponse;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const defaultIsResponse = <T extends WorkerResponseBase>(data: unknown): data is T => {
  if (!isObject(data)) return false;
  if (typeof data.id !== 'string') return false;
  // Treat anything with type === 'log' as a log frame, not a response.
  if (data.type === 'log') return false;
  return true;
};

export function createWorkerClient<TResponse extends WorkerResponseBase = WorkerResponseBase>(
  options: CreateWorkerClientOptions<TResponse>,
): WorkerClient<TResponse> {
  const { createWorker, workerName, isResponse = defaultIsResponse } = options;

  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<string, (response: TResponse) => void>();

  const ensureWorker = (): Worker => {
    if (worker) return worker;
    worker = createWorker();
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!isResponse(data)) return;
      const resolver = pending.get(data.id);
      if (!resolver) return;
      pending.delete(data.id);
      resolver(data);
    });
    worker.addEventListener('error', (event) => {
      log.error(`[${workerName} worker error]`, event);
    });
    return worker;
  };

  const request = <R extends TResponse = TResponse>(
    message: Omit<WorkerMessageBase, 'id'> & Record<string, unknown>,
    transferables?: Transferable[],
  ): Promise<R> => {
    const w = ensureWorker();
    const id = String(++nextId);
    return new Promise<R>((resolve) => {
      pending.set(id, resolve as (response: TResponse) => void);
      if (transferables && transferables.length > 0) {
        w.postMessage({ ...message, id }, transferables);
      } else {
        w.postMessage({ ...message, id });
      }
    });
  };

  const destroy = (): void => {
    pending.clear();
    if (worker) {
      worker.terminate();
      worker = null;
    }
    nextId = 0;
  };

  return { request, destroy };
}
