import { describe, expect, it, vi } from 'vitest';
import {
  NOTION_VERSION,
  isNotionId,
  isNotionPageUrl,
  isPlausibleToken,
  mapNotionError,
  notionRequest,
  pageTitle,
  retryAfterMs,
  toPageList,
  type NotionTransport,
} from './notionApi';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function transport(...responses: Array<Response | Error>): NotionTransport & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch, sleep: vi.fn(async () => undefined) } as never;
}

describe('notionRequest', () => {
  it('sends auth, version and a JSON body', async () => {
    const t = transport(json(200, { ok: 1 }));
    const res = await notionRequest('secret_token', { method: 'POST', path: '/search', body: { query: 'x' } }, t);
    expect(res).toEqual({ ok: true, data: { ok: 1 } });
    const [url, init] = t.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.notion.com/v1/search');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer secret_token',
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe('{"query":"x"}');
  });

  it('leaves Content-Type to fetch for multipart', async () => {
    const t = transport(json(200, {}));
    const form = new FormData();
    await notionRequest('tok', { method: 'POST', path: '/file_uploads/x/send', body: form }, t);
    const init = t.fetch.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('retries a 429 once after Retry-After', async () => {
    const t = transport(json(429, { code: 'rate_limited' }, { 'Retry-After': '2' }), json(200, { id: 'a' }));
    const res = await notionRequest('tok', { method: 'GET', path: '/users/me' }, t);
    expect(res.ok).toBe(true);
    expect(t.sleep).toHaveBeenCalledWith(2000);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second 429', async () => {
    const t = transport(json(429, {}), json(429, { code: 'rate_limited' }));
    const res = await notionRequest('tok', { method: 'GET', path: '/users/me' }, t);
    expect(res).toMatchObject({ ok: false, error: 'rate_limited' });
  });

  it('maps a thrown fetch to network', async () => {
    const t = transport(new Error('ENOTFOUND'));
    const res = await notionRequest('tok', { method: 'GET', path: '/users/me' }, t);
    expect(res).toMatchObject({ ok: false, error: 'network' });
  });
});

describe('mapNotionError', () => {
  it('maps statuses and Notion codes', () => {
    expect(mapNotionError(401, { code: 'unauthorized' })).toBe('unauthorized');
    expect(mapNotionError(404, { code: 'object_not_found' })).toBe('not_shared');
    expect(mapNotionError(403, { code: 'restricted_resource' })).toBe('not_shared');
    expect(mapNotionError(429, null)).toBe('rate_limited');
    expect(mapNotionError(400, { code: 'validation_error', message: 'File size exceeds the limit of 5 MB' })).toBe('too_large');
    expect(mapNotionError(413, null)).toBe('too_large');
    expect(mapNotionError(400, { code: 'validation_error', message: 'body.children should be defined' })).toBe('api');
    expect(mapNotionError(500, null)).toBe('api');
  });

  it('caps and defaults Retry-After', () => {
    expect(retryAfterMs('3')).toBe(3000);
    expect(retryAfterMs(null)).toBe(1000);
    expect(retryAfterMs('junk')).toBe(1000);
    expect(retryAfterMs('600')).toBe(30_000);
  });
});

describe('page payloads', () => {
  const page = (title: Array<{ plain_text: string }>, extra: object = {}) => ({
    object: 'page',
    id: '1a2b3c4d-0000-0000-0000-00000000abcd',
    properties: { Name: { type: 'title', title } },
    ...extra,
  });

  it('joins multi-part titles and handles untitled pages', () => {
    expect(pageTitle(page([{ plain_text: '泛函' }, { plain_text: '分析 ' }]))).toBe('泛函分析');
    expect(pageTitle(page([]))).toBe('');
    expect(pageTitle({})).toBe('');
  });

  it('builds a page list with emoji and cursor, skipping non-pages', () => {
    const list = toPageList({
      results: [
        page([{ plain_text: 'Lectures' }], {
          icon: { type: 'emoji', emoji: '📚' },
          parent: { type: 'page_id', page_id: 'p0' },
        }),
        page([{ plain_text: 'Top' }], { id: 'top', parent: { type: 'workspace', workspace: true } }),
        { object: 'data_source', id: 'x' },
      ],
      has_more: true,
      next_cursor: 'cur',
    });
    expect(list).toEqual({
      pages: [
        { id: '1a2b3c4d-0000-0000-0000-00000000abcd', title: 'Lectures', emoji: '📚', parentId: 'p0' },
        { id: 'top', title: 'Top', emoji: null, parentId: null },
      ],
      nextCursor: 'cur',
    });
    expect(toPageList({ results: [], has_more: false, next_cursor: 'cur' }).nextCursor).toBeNull();
  });
});

describe('validators', () => {
  it('accepts Notion ids with or without dashes only', () => {
    expect(isNotionId('1a2b3c4d-0000-0000-0000-00000000abcd')).toBe(true);
    expect(isNotionId('1a2b3c4d00000000000000000000abcd')).toBe(true);
    expect(isNotionId('../users/me')).toBe(false);
    expect(isNotionId('1a2b3c4d-0000-0000-0000-00000000abcd/children')).toBe(false);
  });

  it('opens only Notion https links', () => {
    expect(isNotionPageUrl('https://www.notion.so/Lectures-1a2b')).toBe(true);
    expect(isNotionPageUrl('https://app.notion.com/p/1a2b')).toBe(true);
    expect(isNotionPageUrl('http://www.notion.so/x')).toBe(false);
    expect(isNotionPageUrl('https://evil.example/notion.so')).toBe(false);
    expect(isNotionPageUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects tokens with whitespace or odd length', () => {
    expect(isPlausibleToken('ntn_' + 'a'.repeat(40))).toBe(true);
    expect(isPlausibleToken('secret_' + 'A1'.repeat(20))).toBe(true);
    expect(isPlausibleToken('ntn_abc def' + 'a'.repeat(30))).toBe(false);
    expect(isPlausibleToken('short')).toBe(false);
  });
});
