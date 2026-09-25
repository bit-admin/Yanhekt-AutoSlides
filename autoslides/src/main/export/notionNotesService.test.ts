import { beforeEach, describe, expect, it, vi } from 'vitest';

const shellMock = vi.hoisted(() => ({ openExternal: vi.fn() }));

vi.mock('electron', () => ({
  app: { isPackaged: true },
  shell: shellMock,
}));

import { NotionNotesService } from './notionNotesService';
import type { NotionTransport } from './notionApi';
import type { ConfigService } from '@main/platform/configService';

const TOKEN = 'ntn_' + 'x'.repeat(40);
const PAGE_ID = '1a2b3c4d-0000-0000-0000-00000000abcd';
const png = new Uint8Array([137, 80, 78, 71]).buffer;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let store: { token: string | null; workspace: string };
let responses: Array<(url: string, init: RequestInit) => Response>;
let calls: Array<{ url: string; init: RequestInit }>;

function service(): NotionNotesService {
  const configService = {
    getNotionToken: () => store.token,
    setNotionToken: (token: string, workspace: string) => {
      store.token = token;
      store.workspace = workspace;
    },
    clearNotionToken: () => {
      store.token = null;
      store.workspace = '';
    },
  } as unknown as ConfigService;
  const transport: NotionTransport = {
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error(`unexpected request ${url}`);
      return next(url, init);
    }) as typeof fetch,
    sleep: async () => undefined,
  };
  return new NotionNotesService(configService, transport);
}

const pageBody = {
  object: 'page',
  id: PAGE_ID,
  url: 'https://www.notion.so/Lectures-1a2b3c4d',
  icon: { type: 'emoji', emoji: '📚' },
  properties: { title: { type: 'title', title: [{ plain_text: 'Lectures' }] } },
};

async function withPage(svc: NotionNotesService, tabId = 't1') {
  responses.push(() => json(200, pageBody));
  const res = await svc.choosePage(tabId, PAGE_ID);
  expect(res.ok).toBe(true);
  return res;
}

beforeEach(() => {
  store = { token: TOKEN, workspace: '' };
  responses = [];
  calls = [];
  shellMock.openExternal.mockReset();
});

describe('connect / disconnect', () => {
  it('verifies the token, stores it, and returns only the workspace name', async () => {
    store.token = null;
    const svc = service();
    responses.push(() => json(200, { object: 'user', type: 'bot', bot: { workspace_name: 'Kate’s Notes' } }));
    const res = await svc.connect(`  ${TOKEN}\n`);
    expect(res).toEqual({ ok: true, data: { workspaceName: 'Kate’s Notes' } });
    expect(JSON.stringify(res)).not.toContain(TOKEN);
    expect(store).toEqual({ token: TOKEN, workspace: 'Kate’s Notes' });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('does not store a token Notion rejects', async () => {
    store.token = null;
    const svc = service();
    responses.push(() => json(401, { code: 'unauthorized', message: 'API token is invalid.' }));
    expect(await svc.connect(TOKEN)).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(store.token).toBeNull();
  });

  it('rejects a malformed token without calling Notion', async () => {
    const svc = service();
    expect(await svc.connect('not a token')).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(calls).toHaveLength(0);
  });

  it('disconnect clears the token and every tab target', async () => {
    const svc = service();
    await withPage(svc);
    svc.disconnect();
    expect(store.token).toBeNull();
    expect(await svc.append('t1', png, 'Slide_1.png')).toMatchObject({ ok: false, error: 'no_target' });
  });
});

describe('searchPages', () => {
  it('filters to pages, sorts by last edit and pages with a cursor', async () => {
    const svc = service();
    responses.push(() => json(200, { results: [pageBody], has_more: false, next_cursor: null }));
    const res = await svc.searchPages(' lec ', 'cur1');
    expect(res).toEqual({
      ok: true,
      data: { pages: [{ id: PAGE_ID, title: 'Lectures', emoji: '📚', parentId: null }], nextCursor: null },
    });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      filter: { property: 'object', value: 'page' },
      sort: { timestamp: 'last_edited_time', direction: 'descending' },
      page_size: 100,
      query: 'lec',
      start_cursor: 'cur1',
    });
  });

  it('needs a token', async () => {
    store.token = null;
    expect(await service().searchPages('', null)).toMatchObject({ ok: false, error: 'no_token' });
  });
});

describe('choosePage', () => {
  it('rejects anything but a Notion id', async () => {
    const svc = service();
    expect(await svc.choosePage('t1', '../users/me')).toMatchObject({ ok: false, error: 'bad_request' });
    expect(calls).toHaveLength(0);
  });

  it('maps an unshared page', async () => {
    const svc = service();
    responses.push(() => json(404, { code: 'object_not_found' }));
    expect(await svc.choosePage('t1', PAGE_ID)).toMatchObject({ ok: false, error: 'not_shared' });
  });

  it('returns the page and opens only its Notion URL', async () => {
    const svc = service();
    const res = await withPage(svc);
    expect(res).toEqual({
      ok: true,
      data: { pageId: PAGE_ID, title: 'Lectures', emoji: '📚', url: 'https://www.notion.so/Lectures-1a2b3c4d' },
    });
    await svc.openPage('t1');
    expect(shellMock.openExternal).toHaveBeenCalledWith('https://www.notion.so/Lectures-1a2b3c4d');
  });

  it('drops a non-Notion page URL', async () => {
    const svc = service();
    responses.push(() => json(200, { ...pageBody, url: 'https://evil.example/' }));
    const res = await svc.choosePage('t1', PAGE_ID);
    expect(res.ok && res.data.url).toBe('');
    expect(await svc.openPage('t1')).toMatchObject({ ok: false, error: 'bad_request' });
    expect(shellMock.openExternal).not.toHaveBeenCalled();
  });
});

describe('append', () => {
  it('needs a chosen page', async () => {
    expect(await service().append('t1', png, 'Slide_1.png')).toMatchObject({ ok: false, error: 'no_target' });
  });

  it('rejects unsafe file names', async () => {
    const svc = service();
    await withPage(svc);
    expect(await svc.append('t1', png, '../x.png')).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it('creates, sends and attaches the upload as an image block', async () => {
    const svc = service();
    await withPage(svc);
    calls = [];
    responses.push(
      () => json(200, { id: 'up1', status: 'pending' }),
      () => json(200, { id: 'up1', status: 'uploaded' }),
      () => json(200, { results: [] }),
    );
    expect(await svc.append('t1', png, 'Slide_12.png')).toEqual({ ok: true, data: undefined });

    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'POST https://api.notion.com/v1/file_uploads',
      'POST https://api.notion.com/v1/file_uploads/up1/send',
      `PATCH https://api.notion.com/v1/blocks/${PAGE_ID}/children`,
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ filename: 'Slide_12.png', content_type: 'image/png' });
    const form = calls[1].init.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('Slide_12.png');
    expect(file.type).toBe('image/png');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(png));
    expect(JSON.parse(calls[2].init.body as string)).toEqual({
      children: [{ type: 'image', image: { type: 'file_upload', file_upload: { id: 'up1' } } }],
    });
  });

  it('stops at the first failing step and reports it', async () => {
    const svc = service();
    await withPage(svc);
    responses.push(
      () => json(200, { id: 'up1' }),
      () => json(400, { code: 'validation_error', message: 'The file size exceeds the limit for this workspace.' }),
    );
    expect(await svc.append('t1', png, 'Slide_1.png')).toMatchObject({ ok: false, error: 'too_large' });
    expect(responses).toHaveLength(0);
  });

  it('keeps slides of one tab in order', async () => {
    const svc = service();
    await withPage(svc);
    calls = [];
    const ok = () => json(200, { id: 'u' });
    for (let i = 0; i < 6; i++) responses.push(ok);
    await Promise.all([svc.append('t1', png, 'Slide_1.png'), svc.append('t1', png, 'Slide_2.png')]);
    const created = calls.filter((c) => c.url.endsWith('/file_uploads')).map((c) => JSON.parse(c.init.body as string).filename);
    expect(created).toEqual(['Slide_1.png', 'Slide_2.png']);
    expect(calls[2].init.method).toBe('PATCH');
  });
});
