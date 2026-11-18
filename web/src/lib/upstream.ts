// One way for every Worker route to call its upstream (Yanhekt, the AI origin,
// a service binding): the caller hanging up cancels the upstream request, a
// response must start within a time budget, and a failure is answered the
// same way everywhere instead of as the framework's 500.
//
// The budget covers waiting for the response headers only. Once they arrive
// the body streams for as long as it takes (an AI answer, a segment), and the
// caller hanging up still cancels it.

export type UpstreamFailure = "timeout" | "cancelled" | "unreachable";

/** How long each upstream may take to start answering. */
export const UPSTREAM_TIMEOUTS_MS = {
  yanhekt: 30_000,
  ai: 120_000,
  index: 15_000,
  relay: 30_000,
} as const;

const STATUS: Record<UpstreamFailure, number> = { timeout: 504, cancelled: 499, unreachable: 502 };
const MESSAGE: Record<UpstreamFailure, string> = {
  timeout: "The upstream service did not answer in time",
  cancelled: "The request was cancelled",
  unreachable: "The upstream service could not be reached",
};

/** Set on this Worker's own failure answers, so a route can tell them from the upstream's. */
export const UPSTREAM_FAILURE_HEADER = "X-AutoSlides-Upstream-Failure";

export function upstreamFailure(reason: UpstreamFailure): Response {
  return new Response(JSON.stringify({ success: false, error: MESSAGE[reason], reason }), {
    status: STATUS[reason],
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      [UPSTREAM_FAILURE_HEADER]: reason,
    },
  });
}

export const isUpstreamFailure = (res: Response): boolean => res.headers.has(UPSTREAM_FAILURE_HEADER);

export async function fetchUpstream(
  send: (signal: AbortSignal) => Promise<Response>,
  options: { caller?: AbortSignal; timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (options.caller?.aborted) return upstreamFailure("cancelled");
  options.caller?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  try {
    return await send(controller.signal);
  } catch {
    options.caller?.removeEventListener("abort", onCallerAbort);
    if (timedOut) return upstreamFailure("timeout");
    if (options.caller?.aborted) return upstreamFailure("cancelled");
    return upstreamFailure("unreachable");
  } finally {
    clearTimeout(timer);
  }
}
