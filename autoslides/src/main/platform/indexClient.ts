import { appUserAgent } from '@main/infra/appUserAgent';
import { SHARE_ORIGIN } from '@common/shareLink';

/**
 * The Index API on the share Worker (contract: share/docs/api.md). First-party,
 * so every request carries {@link appUserAgent}, like the other ruc.edu.kg calls,
 * and the signed-in Yanhekt token as a Bearer (the Index does not check it yet;
 * it is there for when it does). The answers are the same for everyone.
 */
const INDEX_BASE = `${SHARE_ORIGIN}/api`;
const INDEX_TIMEOUT_MS = 10_000;
/** Index answers change only when a crawl is uploaded; a few minutes is plenty. */
const INDEX_TTL_MS = 5 * 60 * 1000;

/** An Index error code (share/docs/api.md), or `network` when no JSON came back. */
export class IndexError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'IndexError';
  }
}

const memo = new Map<string, { at: number; value: unknown }>();

let tokenOf: () => string | null = () => null;

/** Where the Bearer comes from (main.ts: the active Yanhekt token). */
export function setIndexTokenSource(source: () => string | null): void {
  tokenOf = source;
}

async function get<T>(path: string): Promise<T> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < INDEX_TTL_MS) return hit.value as T;

  let res: Response;
  try {
    res = await fetch(`${INDEX_BASE}${path}`, {
      headers: indexHeaders(),
      signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
    });
  } catch (error) {
    throw new IndexError('network', error instanceof Error ? error.message : String(error));
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new IndexError('network', `HTTP ${res.status}, not JSON`);
  }
  if (!res.ok) {
    const e = body as { error?: string; message?: string };
    throw new IndexError(e.error ?? 'internal', e.message ?? `HTTP ${res.status}`);
  }
  // Only answers are kept; a failure is asked again next time.
  memo.set(path, { at: Date.now(), value: body });
  return body as T;
}

/** The session ids the Index holds for a course, ascending. `not-found` for a course it does not have. */
export async function indexSessionIds(courseId: string): Promise<string[]> {
  const data = await get<{ sessions?: Array<number | string> }>(
    `/courses/${encodeURIComponent(courseId)}/sessions`,
  );
  return (data.sessions ?? []).map(String);
}

function indexHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': appUserAgent(), Accept: 'application/json' };
  const token = tokenOf();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** One `/api/search` result (share/docs/api.md). */
export interface IndexSearchRow {
  id: string;
  name: string;
  number: string | null;
  term: string | null;
  teachers: string[];
}

export interface IndexSearchAnswer {
  total: number;
  /** The best 200 at most. */
  results: IndexSearchRow[];
}

/**
 * `GET /api/search`: a word search in one term, or with `term` null an
 * identifier lookup (course id, course link, registrar code) in any term.
 */
export async function indexSearch(q: string, term: string | null): Promise<IndexSearchAnswer> {
  const params = new URLSearchParams({ q });
  if (term) params.set('term', term);
  const data = await get<{ total?: number; results?: Array<Record<string, unknown>> }>(`/search?${params.toString()}`);
  const results = (data.results ?? []).map((r) => ({
    id: String(r.id),
    name: typeof r.name === 'string' ? r.name : '',
    number: r.number == null || r.number === '' ? null : String(r.number),
    term: typeof r.term === 'string' ? r.term : null,
    teachers: Array.isArray(r.teachers) ? r.teachers.filter((t): t is string => typeof t === 'string') : [],
  }));
  return { total: Number(data.total) || results.length, results };
}

/** The course with this id, or null when the Index does not have it. */
export async function indexCourseById(courseId: string): Promise<IndexSearchRow | null> {
  const { results } = await indexSearch(courseId, null);
  return results.find((r) => r.id === courseId) ?? null;
}

/** The one course with this registrar code (Yanhe 2.0 `kcwybm`), compared whole; null when none or several. */
export async function indexCourseByNumber(code: string): Promise<IndexSearchRow | null> {
  const key = code.trim().toLowerCase();
  const { results } = await indexSearch(code.trim(), null);
  const matches = results.filter((r) => r.number !== null && r.number.trim().toLowerCase() === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Test hook: forget memoized answers. */
export function clearIndexMemo(): void {
  memo.clear();
}
