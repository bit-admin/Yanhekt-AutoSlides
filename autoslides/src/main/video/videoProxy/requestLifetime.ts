// How long one local proxy request lives, for the Yanhekt media routes: from
// the player asking until the answer is sent or the player hangs up (a seek, a
// stream switch, a closed tab). Every upstream request and retry wait made for
// it takes this signal, and a body being piped stops when the player goes.
import type * as http from 'http';
import type { Readable } from 'stream';

/** Aborted when `res` closes before the whole answer was written. */
export function requestLifetime(res: http.ServerResponse): AbortSignal {
  const controller = new AbortController();
  res.once('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller.signal;
}

/**
 * Pipe an upstream body to the player. When the player goes the upstream body
 * is destroyed (the socket is released, nothing more is pulled); when the
 * upstream fails mid-way the player's connection is closed rather than left
 * hanging on a half answer.
 */
export function pipeToClient(res: http.ServerResponse, body: Readable): void {
  const stopUpstream = (): void => {
    if (!body.destroyed) body.destroy();
  };
  res.once('close', stopUpstream);
  body.once('error', () => {
    if (!res.destroyed) res.destroy();
  });
  body.pipe(res);
}

/** Wait `ms`, or reject at once with an AbortError when `signal` aborts. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error('The player closed the request');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
