import { appUserAgent } from '@main/infra/appUserAgent';
import { SHARE_ORIGIN } from '@common/shareLink';

/**
 * The Index API on the share Worker (contract: share/docs/api.md). First-party,
 * so every request carries {@link appUserAgent}, like the other ruc.edu.kg calls.
 * No login: the Index answers the same to everyone.
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

async function get<T>(path: string): Promise<T> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < INDEX_TTL_MS) return hit.value as T;

  let res: Response;
  try {
    res = await fetch(`${INDEX_BASE}${path}`, {
      headers: { 'User-Agent': appUserAgent(), Accept: 'application/json' },
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

/** Test hook: forget memoized answers. */
export function clearIndexMemo(): void {
  memo.clear();
}
