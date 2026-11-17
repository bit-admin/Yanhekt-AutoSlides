import { createLogger } from '@shared/utils/logger';
import { createWorkerRequests } from './workerRequests';
const log = createLogger('WorkerClientFactory');
/**
 * Generic Web Worker request/response client for mlClassifierClient,
 * autoCropWorkerClient and pHashWorkerClient. The request lifecycle (every
 * request ends: answer, worker error, failed send, timeout or destroy) lives
 * in `workerRequests.ts`; this adds the logger and the app's time limits.
 *
 * Out of scope (different pattern, not unified):
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
  /** Rejects with a `WorkerRequestError` when the worker cannot answer; never stays pending. */
  request<R extends TResponse = TResponse>(
    message: Omit<WorkerMessageBase, 'id'> & Record<string, unknown>,
    transferables?: Transferable[],
    options?: { timeoutMs?: number },
  ): Promise<R>;
  destroy(): void;
}

/** Long enough for one image on a slow machine; a worker that takes longer is stuck. */
export const WORKER_REQUEST_TIMEOUT_MS = 60_000;
/** Loading an ONNX model, the slowest thing a worker is asked to do. */
export const WORKER_INIT_TIMEOUT_MS = 180_000;

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
  /**
   * Time limit per request; defaults to `WORKER_REQUEST_TIMEOUT_MS`. `null` for
   * none: a client whose callers send many requests at once, where a request's
   * wait is mostly the queue ahead of it and says nothing about a stuck worker.
   */
  timeoutMs?: number | null;
}

export function createWorkerClient<TResponse extends WorkerResponseBase = WorkerResponseBase>(
  options: CreateWorkerClientOptions<TResponse>,
): WorkerClient<TResponse> {
  return createWorkerRequests<TResponse>({
    createWorker: options.createWorker,
    name: options.workerName,
    isResponse: options.isResponse,
    timeoutMs: options.timeoutMs === null ? undefined : (options.timeoutMs ?? WORKER_REQUEST_TIMEOUT_MS),
    onProblem: (message, detail) => log.error(`[${message}]`, detail),
  });
}
