/**
 * The Index API as the site uses it (contract: docs/api.md). Same origin, so
 * relative URLs. Only our own index is read; nothing is fetched from Yanhekt.
 */

export interface CourseResult {
  id: number;
  name: string;
  number: string | null;
  term: string | null;
  teachers: string[];
  sessionCount: number;
  match: { fields: Array<'name' | 'teacher' | 'number' | 'id'> };
}

export interface SearchResponse {
  query: { q: string; term: string | null };
  total: number;
  truncated: boolean;
  results: CourseResult[];
}

export interface TermsResponse {
  /** The last upload (ms), or null. */
  updatedAt: number | null;
  /** Term keys the site offers, newest first. */
  terms: string[];
}

export interface SessionsResponse {
  course: number;
  sessions: number[];
}

/** An API error code (docs/api.md), or `network` when no JSON came back (offline, or the campus WAF challenge page). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('network', 0, String(err));
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('network', res.status, `HTTP ${res.status}, not JSON`);
  }
  if (!res.ok) {
    const e = body as { error?: string; message?: string };
    throw new ApiError(e.error ?? 'internal', res.status, e.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export function search(q: string, term: string | null, signal?: AbortSignal): Promise<SearchResponse> {
  const qs = new URLSearchParams({ q });
  if (term) qs.set('term', term);
  return get(`/api/search?${qs}`, signal);
}

export function courseSessions(id: number, signal?: AbortSignal): Promise<SessionsResponse> {
  return get(`/api/courses/${id}/sessions`, signal);
}

let termsPromise: Promise<TermsResponse> | null = null;

/** Fetched once per page load. */
export function terms(): Promise<TermsResponse> {
  termsPromise ??= get<TermsResponse>('/api/terms').catch((err) => {
    termsPromise = null;
    throw err;
  });
  return termsPromise;
}

export const yanhektCourseUrl = (id: number) => `https://www.yanhekt.cn/course/${id}`;
export const yanhektSessionUrl = (id: number) => `https://www.yanhekt.cn/session/${id}`;

/** AutoSlides Web (web/frontend router: /recorded/:courseId, /player/recorded/:courseId/:sessionId). */
const WEB = 'https://learn.ruc.edu.kg';
export const webCourseUrl = (id: number) => `${WEB}/recorded/${id}`;
export const webSessionUrl = (courseId: number, sessionId: number) => `${WEB}/player/recorded/${courseId}/${sessionId}`;
