// Notion watch-notes provider: appends kept slide images to a Notion page as
// image blocks, in capture order.
//
// Pick mode only: a tab's page comes from the student's choice in the Notes tab
// (a page the connection was granted under Content access), never from config.
// Main owns the token and each tab's page; the renderer sends a tab id, PNG
// bytes and a `Slide_*.png` name. Only Settings reads the token back, to show it.
//
// Only images are written: no text, metadata, timeline or headings.
import { shell } from 'electron';
import type { ConfigService } from '@main/platform/configService';
import { createLogger } from '@main/infra/logger';
import type {
  NotionErrorCode,
  NotionPageList,
  NotionResult,
  NotionTargetInfo,
} from '@common/notionNotesTypes';
import { isSafeSlideFilename } from './obsidianPaths';
import {
  defaultTransport,
  isNotionId,
  isNotionPageUrl,
  isPlausibleToken,
  notionRequest,
  pageEmoji,
  pageTitle,
  toPageList,
  workspaceNameOf,
  type NotionRequest,
  type NotionTransport,
} from './notionApi';

const log = createLogger('NotionNotes');

/** Notion's maximum; the picker walks cursors to build the page tree. */
const SEARCH_PAGE_SIZE = 100;

export class NotionNotesService {
  private targets = new Map<string, NotionTargetInfo>();
  private chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly transport: NotionTransport = defaultTransport,
  ) {}

  private call<T>(req: NotionRequest, token?: string | null): Promise<NotionResult<T>> {
    const auth = token ?? this.configService.getNotionToken();
    if (!auth) return Promise.resolve({ ok: false, error: 'no_token' });
    return notionRequest<T>(auth, req, this.transport);
  }

  /** Verify the token against Notion, then store it. */
  async connect(rawToken: string): Promise<NotionResult<{ workspaceName: string }>> {
    const token = rawToken.trim();
    if (!isPlausibleToken(token)) return { ok: false, error: 'unauthorized' };
    const me = await this.call<{ bot?: { workspace_name?: string | null } }>({ method: 'GET', path: '/users/me' }, token);
    if (!me.ok) return me;
    const workspaceName = workspaceNameOf(me.data);
    this.configService.setNotionToken(token, workspaceName);
    return { ok: true, data: { workspaceName } };
  }

  disconnect(): void {
    this.configService.clearNotionToken();
    this.targets.clear();
    this.chains.clear();
  }

  /** Pages the connection can see, most recently edited first. */
  async searchPages(query: string, cursor: string | null): Promise<NotionResult<NotionPageList>> {
    const body: Record<string, unknown> = {
      filter: { property: 'object', value: 'page' },
      sort: { timestamp: 'last_edited_time', direction: 'descending' },
      page_size: SEARCH_PAGE_SIZE,
    };
    const q = query.trim();
    if (q) body.query = q;
    if (cursor) body.start_cursor = cursor;
    const res = await this.call<Parameters<typeof toPageList>[0]>({ method: 'POST', path: '/search', body });
    return res.ok ? { ok: true, data: toPageList(res.data) } : res;
  }

  /** Make `pageId` this tab's target, after confirming the connection can read it. */
  async choosePage(tabId: string, pageId: string): Promise<NotionResult<NotionTargetInfo>> {
    if (!isNotionId(pageId)) return { ok: false, error: 'bad_request' };
    const res = await this.call<Parameters<typeof pageTitle>[0] & { id: string; url?: string }>({
      method: 'GET',
      path: `/pages/${pageId}`,
    });
    if (!res.ok) return res;
    const info: NotionTargetInfo = {
      pageId: res.data.id,
      title: pageTitle(res.data),
      emoji: pageEmoji(res.data),
      url: typeof res.data.url === 'string' && isNotionPageUrl(res.data.url) ? res.data.url : '',
    };
    this.targets.set(tabId, info);
    return { ok: true, data: info };
  }

  /** Upload one slide and append it to the tab's page as an image block. */
  append(tabId: string, bytes: Uint8Array | ArrayBuffer, filename: string): Promise<NotionResult<void>> {
    const run = async (): Promise<NotionResult<void>> => {
      const target = this.targets.get(tabId);
      if (!target) return { ok: false, error: 'no_target' };
      if (!isSafeSlideFilename(filename)) return { ok: false, error: 'bad_request' };

      const created = await this.call<{ id: string }>({
        method: 'POST',
        path: '/file_uploads',
        body: { filename, content_type: 'image/png' },
      });
      if (!created.ok) return this.failed(created);

      const form = new FormData();
      const data = new Uint8Array(bytes); // own ArrayBuffer copy, as Blob requires
      form.append('file', new Blob([data], { type: 'image/png' }), filename);
      const sent = await this.call<unknown>({
        method: 'POST',
        path: `/file_uploads/${created.data.id}/send`,
        body: form,
      });
      if (!sent.ok) return this.failed(sent);

      const appended = await this.call<unknown>({
        method: 'PATCH',
        path: `/blocks/${target.pageId}/children`,
        body: {
          children: [{ type: 'image', image: { type: 'file_upload', file_upload: { id: created.data.id } } }],
        },
      });
      if (!appended.ok) return this.failed(appended);
      return { ok: true, data: undefined };
    };
    // Per-tab chain keeps image blocks in capture order.
    const prev = this.chains.get(tabId) ?? Promise.resolve();
    const next = prev.then(run, run);
    this.chains.set(tabId, next);
    return next;
  }

  private failed(res: { ok: false; error: NotionErrorCode; message?: string }): NotionResult<void> {
    log.warn('failed to append slide to Notion page', res.error, res.message);
    return res;
  }

  close(tabId: string): void {
    this.targets.delete(tabId);
    this.chains.delete(tabId);
  }

  async openPage(tabId: string): Promise<NotionResult<void>> {
    const target = this.targets.get(tabId);
    if (!target) return { ok: false, error: 'no_target' };
    if (!target.url) return { ok: false, error: 'bad_request' };
    await shell.openExternal(target.url);
    return { ok: true, data: undefined };
  }
}
