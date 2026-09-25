// Thin Notion REST client for the watch-notes provider: one request helper
// with the error mapping, plus pure payload readers. No state — the service
// owns the token and the per-tab targets.
import type {
  NotionErrorCode,
  NotionPageList,
  NotionPageSummary,
  NotionResult,
} from '@common/notionNotesTypes';

export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2026-03-11';

/** Longest Retry-After we honor before giving up and pausing the queue. */
const MAX_RETRY_WAIT_MS = 30_000;

export interface NotionTransport {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

export const defaultTransport: NotionTransport = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

interface NotionErrorBody {
  code?: string;
  message?: string;
}

/** HTTP status + Notion error code → our error code. */
export function mapNotionError(status: number, body: NotionErrorBody | null): NotionErrorCode {
  const code = body?.code ?? '';
  const message = body?.message ?? '';
  if (status === 401 || code === 'unauthorized') return 'unauthorized';
  if (status === 404 || status === 403 || code === 'object_not_found' || code === 'restricted_resource') {
    return 'not_shared';
  }
  if (status === 429 || code === 'rate_limited') return 'rate_limited';
  if (status === 413 || (status === 400 && /\b(size|too large|exceeds?)\b/i.test(message))) return 'too_large';
  return 'api';
}

/** Retry-After (seconds) → ms, capped; 1s when absent or malformed. */
export function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return 1000;
  return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
}

export interface NotionRequest {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  /** JSON body, or FormData for a multipart upload. */
  body?: unknown;
}

/**
 * One Notion call. A 429 is retried once after Retry-After; any other failure
 * comes back as a NotionResult error so the queue can pause on it.
 */
export async function notionRequest<T>(
  token: string,
  req: NotionRequest,
  transport: NotionTransport = defaultTransport,
): Promise<NotionResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
  };
  let body: RequestInit['body'];
  if (req.body instanceof FormData) {
    body = req.body; // fetch sets the multipart boundary
  } else if (req.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body);
  }

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await transport.fetch(`${NOTION_API_BASE}${req.path}`, { method: req.method, headers, body });
    } catch (err) {
      return { ok: false, error: 'network', message: err instanceof Error ? err.message : String(err) };
    }
    if (res.ok) {
      return { ok: true, data: (await res.json()) as T };
    }
    if (res.status === 429 && attempt === 0) {
      await transport.sleep(retryAfterMs(res.headers.get('Retry-After')));
      continue;
    }
    let errBody: NotionErrorBody | null = null;
    try {
      errBody = (await res.json()) as NotionErrorBody;
    } catch {
      errBody = null;
    }
    return { ok: false, error: mapNotionError(res.status, errBody), message: errBody?.message };
  }
}

interface RichText {
  plain_text?: string;
}

interface PageLike {
  id?: string;
  object?: string;
  url?: string;
  icon?: { type?: string; emoji?: string } | null;
  parent?: { type?: string; page_id?: string } | null;
  properties?: Record<string, { type?: string; title?: RichText[] }>;
}

/** The page's title property, joined; '' when untitled. */
export function pageTitle(page: PageLike): string {
  for (const prop of Object.values(page.properties ?? {})) {
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t) => t.plain_text ?? '').join('').trim();
    }
  }
  return '';
}

export function pageEmoji(page: PageLike): string | null {
  return page.icon?.type === 'emoji' && page.icon.emoji ? page.icon.emoji : null;
}

export function toPageSummary(page: PageLike): NotionPageSummary | null {
  if (page.object !== 'page' || typeof page.id !== 'string') return null;
  const parentId = page.parent?.type === 'page_id' && typeof page.parent.page_id === 'string' ? page.parent.page_id : null;
  return { id: page.id, title: pageTitle(page), emoji: pageEmoji(page), parentId };
}

export function toPageList(res: { results?: PageLike[]; next_cursor?: string | null; has_more?: boolean }): NotionPageList {
  const pages = (res.results ?? []).map(toPageSummary).filter((p): p is NotionPageSummary => p !== null);
  return { pages, nextCursor: res.has_more && res.next_cursor ? res.next_cursor : null };
}

/** Notion ids are UUIDs, with or without dashes. */
export function isNotionId(id: string): boolean {
  return /^[0-9a-f]{32}$/i.test(id.replace(/-/g, '')) && /^[0-9a-f-]{32,36}$/i.test(id);
}

/** Only Notion's own page links are opened. */
export function isNotionPageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.notion.so' || u.hostname === 'notion.so' || u.hostname === 'app.notion.com');
  } catch {
    return false;
  }
}

/** Integration tokens are a single opaque word; reject pasted whitespace/newlines. */
export function isPlausibleToken(token: string): boolean {
  return /^[\w-]{20,200}$/.test(token);
}

export function workspaceNameOf(me: { bot?: { workspace_name?: string | null } }): string {
  return me.bot?.workspace_name?.trim() ?? '';
}
