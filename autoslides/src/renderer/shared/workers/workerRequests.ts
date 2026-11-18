/**
 * Request/response over one Web Worker, where every request ends.
 *
 * A request resolves with the worker's answer or rejects with a
 * `WorkerRequestError`; it never stays pending. That matters because the
 * callers are serial queues (post-processing runs one job at a time): one
 * request that never settles would stop everything behind it.
 *
 * What ends a request other than its answer:
 * - the worker reports `error` or `messageerror` (failed to load, crashed, an
 *   answer that could not be cloned): every open request rejects and the
 *   worker is discarded, so the next request starts a fresh one;
 * - the message cannot be sent (`postMessage` throws, for example on a value
 *   that cannot be cloned): that request rejects, the worker stays;
 * - the request's time limit passes: it rejects, and since a worker that did
 *   not answer is not to be trusted with the rest, the worker is discarded and
 *   the other open requests reject too;
 * - `destroy()`: every open request rejects.
 *
 * Events from a discarded worker are ignored, so a late answer cannot settle a
 * request of the worker that replaced it.
 *
 * No imports, on purpose: the desktop app and the web app carry identical
 * copies of this file (see `scripts/check-drift.mjs`).
 */

export type WorkerRequestFailure = 'worker-error' | 'send-failed' | 'timeout' | 'destroyed';

export class WorkerRequestError extends Error {
  constructor(
    readonly reason: WorkerRequestFailure,
    message: string,
  ) {
    super(message);
    this.name = 'WorkerRequestError';
  }
}

/** The part of `Worker` this needs; tests pass a fake. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: { data?: unknown }) => void): void;
}

export interface WorkerRequestsOptions<TResponse extends { id: string }> {
  createWorker: () => WorkerLike;
  /** Short name for error messages, e.g. `'autoCrop'`. */
  name: string;
  /** Which incoming messages are answers. Default: an object with a string `id` that is not a log frame. */
  isResponse?: (data: unknown) => data is TResponse;
  /** Time limit for a request that does not name its own. Omit for none. */
  timeoutMs?: number;
  /** Told when the worker is discarded after a failure. */
  onProblem?: (message: string, detail?: unknown) => void;
}

export interface WorkerRequests<TResponse extends { id: string }> {
  request<R extends TResponse = TResponse>(
    message: { type: string } & Record<string, unknown>,
    transferables?: Transferable[],
    options?: { timeoutMs?: number },
  ): Promise<R>;
  /** Reject everything open and stop the worker. The next request starts a new one. */
  destroy(): void;
}

interface Open<TResponse> {
  resolve: (response: TResponse) => void;
  reject: (error: WorkerRequestError) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const defaultIsResponse = <T extends { id: string }>(data: unknown): data is T => {
  if (typeof data !== 'object' || data === null) return false;
  const frame = data as Record<string, unknown>;
  return typeof frame.id === 'string' && frame.type !== 'log';
};

export function createWorkerRequests<TResponse extends { id: string }>(
  options: WorkerRequestsOptions<TResponse>,
): WorkerRequests<TResponse> {
  const { createWorker, name, isResponse = defaultIsResponse, onProblem } = options;

  let worker: WorkerLike | null = null;
  // Never reset: an id is not reused by the worker that replaces this one.
  let nextId = 0;
  const open = new Map<string, Open<TResponse>>();

  const settle = (id: string): Open<TResponse> | undefined => {
    const entry = open.get(id);
    if (!entry) return undefined;
    open.delete(id);
    if (entry.timer !== null) clearTimeout(entry.timer);
    return entry;
  };

  const rejectAll = (reason: WorkerRequestFailure, message: string): void => {
    for (const id of [...open.keys()]) settle(id)?.reject(new WorkerRequestError(reason, message));
  };

  /** Stop the current worker; whatever is still open rejects with `reason`. */
  const discard = (reason: WorkerRequestFailure, message: string): void => {
    const current = worker;
    worker = null;
    rejectAll(reason, message);
    try {
      current?.terminate();
    } catch {
      // A worker that cannot be stopped is still not used again.
    }
  };

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker;
    const mine = createWorker();
    worker = mine;
    mine.addEventListener('message', (event) => {
      if (worker !== mine) return;
      const data = event.data;
      if (!isResponse(data)) return;
      settle(data.id)?.resolve(data);
    });
    const failed = (what: string) => (event: unknown) => {
      if (worker !== mine) return;
      onProblem?.(`${name} worker ${what}`, event);
      discard('worker-error', `The ${name} worker ${what}`);
    };
    mine.addEventListener('error', failed('reported an error'));
    mine.addEventListener('messageerror', failed('sent a message that could not be read'));
    return mine;
  };

  const request = <R extends TResponse = TResponse>(
    message: { type: string } & Record<string, unknown>,
    transferables?: Transferable[],
    requestOptions?: { timeoutMs?: number },
  ): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      let target: WorkerLike;
      try {
        target = ensureWorker();
      } catch (error) {
        reject(new WorkerRequestError('worker-error', `The ${name} worker could not be started: ${String(error)}`));
        return;
      }
      const id = String((nextId += 1));
      const limit = requestOptions?.timeoutMs ?? options.timeoutMs;
      const timer =
        limit === undefined
          ? null
          : setTimeout(() => {
              const entry = settle(id);
              if (!entry) return;
              entry.reject(
                new WorkerRequestError('timeout', `The ${name} worker did not answer "${message.type}" in ${limit} ms`),
              );
              if (worker === target) {
                onProblem?.(`${name} worker did not answer "${message.type}" in ${limit} ms`);
                discard('worker-error', `The ${name} worker was restarted after a request timed out`);
              }
            }, limit);
      open.set(id, { resolve: resolve as (response: TResponse) => void, reject, timer });
      try {
        if (transferables && transferables.length > 0) target.postMessage({ ...message, id }, transferables);
        else target.postMessage({ ...message, id });
      } catch (error) {
        settle(id)?.reject(
          new WorkerRequestError('send-failed', `Could not send "${message.type}" to the ${name} worker: ${String(error)}`),
        );
      }
    });

  const destroy = (): void => {
    discard('destroyed', `The ${name} worker was stopped`);
  };

  return { request, destroy };
}
