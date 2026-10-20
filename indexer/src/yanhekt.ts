/**
 * Anonymous cbiz client. Only endpoints that answer without a login token:
 *
 *   GET /v1/course/session?session_id=       session + nested course + nested live
 *   GET /v1/video?id=                        stream URLs (main / vga / room / audio)
 *   GET /v1/course?id=                       course detail (tags, college, …)
 *   GET /v1/course/professor/list?course_id= teachers
 *
 * cbiz answers HTTP 200 with a `code` envelope. The official Origin is
 * required: a foreign Origin is HTTP 403 at the edge.
 */

const CBIZ = 'https://cbiz.yanhekt.cn';
/** md5("<VIDEO_MAGIC>_v1_undefined") — the constant the official SPA sends. */
const XCLIENT_SIGNATURE = '72b77856f6df3f563ab6e658631cac3d';

/** "Not found" codes, one per resource (observed live, 2026-10). */
export const MISSING_CODE = {
  session: '12121010',
  video: '13121010',
  course: '12111010',
} as const;

/** 系统繁忙 — overload, retry later. */
const BUSY_CODE = '61101114';

export type Json = Record<string, unknown>;

export type Outcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'missing' }
  /** Network, timeout, HTTP error, or "busy": stop and retry later. */
  | { kind: 'transient'; reason: string }
  /** A code we do not know. Recorded, then skipped. */
  | { kind: 'unexpected'; code: string; message: string };

export interface Api {
  session(id: number): Promise<Outcome<Json>>;
  video(id: number): Promise<Outcome<Json>>;
  course(id: number): Promise<Outcome<Json>>;
  professors(courseId: number): Promise<Outcome<unknown[]>>;
}

/** Sleep that wakes early (without throwing) when `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Hard cap on requests plus a wall-clock deadline for one run. */
export class Budget {
  readonly maxRequests: number;
  private readonly deadlineMs: number;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private used = 0;

  constructor(maxRequests: number, deadlineMs: number, intervalMs: number, now: () => number = Date.now) {
    this.maxRequests = maxRequests;
    this.deadlineMs = deadlineMs;
    this.intervalMs = intervalMs;
    this.now = now;
  }

  get spent(): number {
    return this.used;
  }

  /** Room for `n` more paced requests before the cap and the deadline? */
  canAfford(n: number): boolean {
    return this.used + n <= this.maxRequests && this.now() + n * this.intervalMs <= this.deadlineMs;
  }

  take(): void {
    this.used += 1;
  }
}

/** Start-to-start spacing between requests, plus up to 10% jitter. */
export class Pacer {
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly wait_: (ms: number) => Promise<void>;
  private last = Number.NEGATIVE_INFINITY;

  constructor(intervalMs: number, now: () => number = Date.now, wait: (ms: number) => Promise<void> = sleep) {
    this.intervalMs = intervalMs;
    this.now = now;
    this.wait_ = wait;
  }

  async wait(): Promise<void> {
    const jitter = Math.floor(this.intervalMs * 0.1 * Math.random());
    const delay = this.last + this.intervalMs + jitter - this.now();
    if (delay > 0) await this.wait_(delay);
    this.last = this.now();
  }
}

export interface ClientOptions {
  fetch: typeof fetch;
  pacer: Pacer;
  userAgent: string;
  timeoutMs: number;
}

export class YanhektClient implements Api {
  private readonly opts: ClientOptions;

  constructor(opts: ClientOptions) {
    this.opts = opts;
  }

  session(id: number): Promise<Outcome<Json>> {
    return this.get(`/v1/course/session?session_id=${id}&with_video=true`, MISSING_CODE.session);
  }

  video(id: number): Promise<Outcome<Json>> {
    return this.get(`/v1/video?id=${id}`, MISSING_CODE.video);
  }

  course(id: number): Promise<Outcome<Json>> {
    return this.get(`/v1/course?id=${id}&with_professor_badges=true`, MISSING_CODE.course);
  }

  professors(courseId: number): Promise<Outcome<unknown[]>> {
    return this.get(`/v1/course/professor/list?course_id=${courseId}`, MISSING_CODE.course, true);
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      Origin: 'https://www.yanhekt.cn',
      Referer: 'https://www.yanhekt.cn/',
      'User-Agent': this.opts.userAgent,
      'Xdomain-Client': 'web_user',
      'Xclient-Version': 'v1',
      'Xclient-Signature': XCLIENT_SIGNATURE,
      'Xclient-Timestamp': Math.floor(Date.now() / 1000).toString(),
    };
  }

  private async get<T>(path: string, missingCode: string, arrayData = false): Promise<Outcome<T>> {
    await this.opts.pacer.wait();
    let res: Response;
    try {
      res = await this.opts.fetch(`${CBIZ}${path}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
    } catch (err) {
      return { kind: 'transient', reason: `network: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!res.ok) return { kind: 'transient', reason: `http ${res.status}` };
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: 'transient', reason: 'invalid json' };
    }
    return classify<T>(body, missingCode, arrayData);
  }
}

/** Map a cbiz envelope to an outcome. */
export function classify<T>(body: unknown, missingCode: string, arrayData = false): Outcome<T> {
  if (!body || typeof body !== 'object') return { kind: 'transient', reason: 'empty body' };
  const env = body as { code?: unknown; message?: unknown; data?: unknown };
  const code = String(env.code ?? '');
  const message = typeof env.message === 'string' ? env.message : '';
  if (code === '0') {
    const data = env.data;
    if (arrayData) return { kind: 'ok', data: (Array.isArray(data) ? data : []) as T };
    if (data && typeof data === 'object' && !Array.isArray(data) && (data as Json).id != null) {
      return { kind: 'ok', data: data as T };
    }
    // code 0 without an object: treat as "not found" rather than guess.
    return { kind: 'missing' };
  }
  if (code === missingCode) return { kind: 'missing' };
  if (code === BUSY_CODE) return { kind: 'transient', reason: `busy ${code}` };
  return { kind: 'unexpected', code, message };
}
