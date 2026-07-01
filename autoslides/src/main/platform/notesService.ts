/**
 * Yanhekt Cloud Note Service
 *
 * Thin client over Yanhekt's server-side note API (cbiz.yanhekt.cn/v1/note*).
 * Runs in the main process so it can (a) read the auth token from electron-store
 * via ConfigService — the Tools window can't read the main window's localStorage —
 * and (b) bypass the note API's yanhekt.cn-only CORS lock (Node has no CORS).
 *
 * The only non-obvious auth gate is the `Xdomain-Client: web_user` header; the
 * xclient signing headers are NOT enforced by this API. See
 * REFERENCE/yanhekt-note-api-report.md for the verified endpoint surface.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { ConfigService } from './configService';
import { sharpService } from '@main/infra/sharpService';
import type {
  NoteSummary,
  NoteDetail,
  NoteListResult,
  NoteListParams,
  NoteGroup,
  UploadedImage,
  ExportFolderInfo,
  ShareImportResult,
} from '@common/notesTypes';
import { NOTE_GROUP_NAME_MAX } from '@common/notesTypes';
import type { SlideMetadataSource } from '@common/slideMetadataTypes';
import { SHARE_ORIGIN, SHARE_PATH, decodeSharePayload, parseShareLink } from '@common/shareLink';
import { buildCossListUrl, resolveShareImages } from '@common/shareResolve';
import { createLogger } from '@main/infra/logger';
import { appUserAgent } from '@main/infra/appUserAgent';

const log = createLogger('NotesService');

const BASE = 'https://cbiz.yanhekt.cn';

/** Thrown when no auth token is available (user not signed in via the main window). */
export class NotesAuthError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'NotesAuthError';
  }
}

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

export class NotesService {
  constructor(private readonly configService: ConfigService) {}

  /** Verified minimal header set. `Xdomain-Client: web_user` is the critical gate. */
  private jsonHeaders(): Record<string, string> {
    const token = this.configService.getAuthToken();
    if (!token) throw new NotesAuthError();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.yanhekt.cn',
      Referer: 'https://www.yanhekt.cn/',
      'Xdomain-Client': 'web_user',
    };
  }

  /** Headers for multipart upload — no manual Content-Type (FormData sets the boundary). */
  private uploadHeaders(): Record<string, string> {
    const token = this.configService.getAuthToken();
    if (!token) throw new NotesAuthError();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.yanhekt.cn',
      Referer: 'https://www.yanhekt.cn/',
      'Xdomain-Client': 'web_user',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const init: RequestInit = { method, headers: this.jsonHeaders() };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, init);
    if (!res.ok) {
      throw new Error(`Note API request failed (${res.status}): ${method} ${path}`);
    }
    const payload = (await res.json()) as ApiEnvelope<T>;
    if (payload.code !== 0) {
      throw new Error(payload.message || `Note API error code ${payload.code}`);
    }
    return payload.data;
  }

  // ── Notes ──────────────────────────────────────────────────────────────

  /**
   * List notes (paginated). `content` is empty in list results — use get() to edit.
   * The server ignores group filtering here (see NoteListParams), so callers filter
   * by `note_group_id` client-side. `keyword` search IS honoured server-side.
   */
  async list(params: NoteListParams = {}): Promise<NoteListResult> {
    const { page = 1, pageSize = 20, keyword = '' } = params;
    const qs = new URLSearchParams({
      with_brief: 'false',
      keyword,
      page: String(page),
      page_size: String(pageSize),
      with_page: 'true',
    });
    log.debug('list', { page, pageSize, keyword });
    return this.request<NoteListResult>('GET', `/v1/note/list?${qs.toString()}`);
  }

  /** Fetch a single note (full content) by its database id. */
  async get(id: number): Promise<NoteDetail> {
    return this.request<NoteDetail>('GET', `/v1/note?id=${encodeURIComponent(id)}`);
  }

  /** Create a blank note; returns the new note's id. */
  async create(): Promise<number> {
    const data = await this.request<{ id: number; success?: boolean }>(
      'POST',
      '/v1/note',
      { content: '', version: 2 },
    );
    log.info('created note', data.id);
    return data.id;
  }

  /** Update a note's title and optionally assign it to a group. */
  async updateTitle(id: number, title: string, groupId?: number): Promise<void> {
    const body: Record<string, unknown> = { id, title };
    if (groupId !== undefined) body.note_group_id = groupId;
    await this.request('PUT', '/v1/note', body);
  }

  /** Replace a note's content (stringified Editor.js document). */
  async updateContent(id: number, content: string): Promise<void> {
    await this.request('PUT', '/v1/note/content', { id, content });
  }

  /** Move a note into a group (0 = default group). */
  async moveToGroup(id: number, groupId: number): Promise<void> {
    await this.request('PUT', '/v1/note', { id, note_group_id: groupId });
  }

  /** Delete a note by id. */
  async remove(id: number): Promise<void> {
    await this.request('DELETE', '/v1/note', { id });
    log.info('deleted note', id);
  }

  // ── Groups ─────────────────────────────────────────────────────────────

  async groupList(): Promise<NoteGroup[]> {
    return this.request<NoteGroup[]>('GET', '/v1/note/group/list?with_note=false');
  }

  /** Create a group. Server enforces a 6-character name limit. */
  async groupCreate(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Group name is required');
    if (trimmed.length > NOTE_GROUP_NAME_MAX) {
      throw new Error(`Group name must be at most ${NOTE_GROUP_NAME_MAX} characters`);
    }
    await this.request('POST', '/v1/note/group', { name: trimmed });
    log.info('created group', trimmed);
  }

  /** Delete a group by id (verified: DELETE /v1/note/group {id}). */
  async groupRemove(id: number): Promise<void> {
    await this.request('DELETE', '/v1/note/group', { id });
    log.info('deleted group', id);
  }

  // ── Image upload ───────────────────────────────────────────────────────

  /**
   * Upload an image to the public MinIO `notes` bucket; returns the permanent
   * public URL ({host}{path}). Same file hashes deterministically to the same URL.
   */
  async uploadImage(bytes: ArrayBuffer, filename: string, mime: string): Promise<UploadedImage> {
    return this.uploadBytes(bytes, filename, mime);
  }

  /**
   * Upload an image straight from a local file path. Used by the slide-import
   * queue: the file is read and uploaded entirely in the main process, avoiding a
   * base64 round-trip through the renderer for each of (potentially) hundreds of
   * slides.
   */
  async uploadImageFromPath(filePath: string): Promise<UploadedImage> {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return this.uploadBytes(bytes, path.basename(filePath), mime);
  }

  /** Shared multipart upload to the public MinIO `notes` bucket. */
  private async uploadBytes(
    data: ArrayBuffer | Uint8Array,
    filename: string,
    mime: string,
  ): Promise<UploadedImage> {
    const form = new FormData();
    form.append('file', new Blob([data as BlobPart], { type: mime || 'application/octet-stream' }), filename || 'image.png');
    form.append('bucket', 'notes');

    const res = await fetch(`${BASE}/v1/minio/upload`, {
      method: 'POST',
      headers: this.uploadHeaders(),
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Image upload failed (${res.status})`);
    }
    const payload = (await res.json()) as ApiEnvelope<{ host: string; path: string }>;
    if (payload.code !== 0) {
      throw new Error(payload.message || `Image upload error code ${payload.code}`);
    }
    const url = `${payload.data.host}${payload.data.path}`;
    log.info('uploaded image', url);
    return { url };
  }

  // ── Export to local slide folders ──────────────────────────────────────

  /** Configured slides output directory, with leading `~` expanded. */
  private exportBaseDir(): string {
    const dir = this.configService.getConfig().outputDirectory;
    return dir.startsWith('~') ? path.join(os.homedir(), dir.slice(1)) : dir;
  }

  /** Local `slides_<displayName>` folder path for a managed note's display name. */
  private slidesFolderPath(displayName: string): string {
    const safe = displayName.replace(/[/\\]/g, '_');
    return path.join(this.exportBaseDir(), `slides_${safe}`);
  }

  /** Whether the base export folder for this display name already exists on disk. */
  async exportFolderStatus(displayName: string): Promise<ExportFolderInfo> {
    const dir = this.slidesFolderPath(displayName);
    let exists = false;
    try {
      exists = (await fs.stat(dir)).isDirectory();
    } catch {
      exists = false;
    }
    return { exists, dir, folderName: path.basename(dir) };
  }

  /**
   * Create the destination folder and return its path. `fresh` uses the base
   * `slides_<name>` path (caller is responsible for clearing a prior folder via
   * trash.removeFolders); `create` resolves a unique ` (N)` suffix so an existing
   * folder is preserved alongside the new export.
   */
  async prepareExportFolder(
    displayName: string,
    mode: 'fresh' | 'create',
  ): Promise<ExportFolderInfo> {
    let dir = this.slidesFolderPath(displayName);
    if (mode === 'create') {
      let n = 2;
      while (await this.pathExists(dir)) {
        dir = `${this.slidesFolderPath(displayName)} (${n})`;
        n += 1;
      }
    }
    await fs.mkdir(dir, { recursive: true });
    return { exists: true, dir, folderName: path.basename(dir) };
  }

  /**
   * Download a single note image from its public CDN URL and write it into the
   * export folder. The server stores hashed URLs and may change the extension, so
   * the bytes are re-encoded to real PNG via sharp when available (otherwise the
   * raw bytes are written, best-effort).
   */
  async downloadImageToFolder(url: string, dir: string, filename: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Image download failed (${res.status})`);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    let out: Buffer = raw;
    if (sharpService.isAvailable()) {
      const sharp = sharpService.getSharp();
      if (sharp) out = await sharp(raw).png().toBuffer();
    }
    await fs.writeFile(path.join(dir, filename), out);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  // ── Share short links ──────────────────────────────────────────────────

  /**
   * Exchange a share-link fragment for a KV-backed short URL via the public
   * share Worker. Runs in the main process so it doesn't hit renderer CORS; the
   * endpoint needs no auth.
   */
  async shortenShareUrl(fragment: string): Promise<{ url: string }> {
    const res = await fetch(`${SHARE_ORIGIN}${SHARE_PATH}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': appUserAgent() },
      body: JSON.stringify({ fragment }),
    });
    if (!res.ok) {
      throw new Error(`Short-link request failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
      throw new Error('Short-link response missing url');
    }
    return { url: data.url };
  }

  /**
   * Publish a lecture to AutoSlides Index (v2). Sends the v1 share fragment plus
   * the folder metadata `source` and the derived review flags to the Worker,
   * which verifies the auth token against Yanhekt before recording it. Returns
   * the canonical index URL and whether this was a duplicate of an existing
   * version (same images, same order).
   */
  async publishToIndex(
    fragment: string,
    source: SlideMetadataSource,
    review: { reviewed: boolean; edited: boolean },
  ): Promise<{ shareId: string; indexUrl: string; duplicate: boolean }> {
    const token = this.configService.getAuthToken();
    if (!token) throw new NotesAuthError();
    const res = await fetch(`${SHARE_ORIGIN}/v2/api/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': appUserAgent(),
      },
      body: JSON.stringify({ fragment, source, review }),
    });
    if (res.status === 401) throw new NotesAuthError('AutoSlides Index rejected the sign-in token');
    if (!res.ok) throw new Error(`Publish failed (${res.status})`);
    const data = (await res.json()) as {
      ok?: boolean;
      shareId?: string;
      indexUrl?: string;
      duplicate?: boolean;
    };
    if (!data.ok || !data.indexUrl || !data.shareId) {
      throw new Error('Publish response malformed');
    }
    return { shareId: data.shareId, indexUrl: data.indexUrl, duplicate: !!data.duplicate };
  }

  // ── Share-link import ("Cloud Index" webview interception) ───────────────

  /**
   * Resolve a share link (long `#fragment` or short `/v1/s/<id>`) into the note
   * title and ordered public image URLs, ready to import as a managed note or
   * export to a local folder. Lists the public coss `images` bucket to expand
   * the short hashes — runs in the main process to avoid renderer CORS, like the
   * other coss/yanhekt calls. Needs no auth (everything it touches is public).
   */
  async resolveShareLink(link: string): Promise<ShareImportResult> {
    const parsed = parseShareLink(link);
    if (!parsed) throw new Error('invalid-share-link');

    let fragment = parsed.fragment;
    if (!fragment && parsed.shortId) {
      fragment = await this.fetchShortFragment(parsed.shortId);
    }
    if (!fragment) throw new Error('invalid-share-link');

    const payload = decodeSharePayload(fragment);
    if (!payload) throw new Error('invalid-share-link');

    const resolved = await resolveShareImages(payload, (prefix) => this.listCossFolder(prefix));
    const urls = resolved.filter((r) => r.url !== null).map((r) => r.url as string);
    return { title: payload.t, urls, missing: resolved.length - urls.length };
  }

  /** Look up a short-link id's stored fragment via the public share Worker. */
  private async fetchShortFragment(id: string): Promise<string> {
    const res = await fetch(`${SHARE_ORIGIN}${SHARE_PATH}/api/get?id=${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': appUserAgent() },
    });
    if (!res.ok) throw new Error(`Short-link lookup failed (${res.status})`);
    const data = (await res.json()) as { fragment?: string };
    if (!data.fragment) throw new Error('Short link not found');
    return data.fragment;
  }

  /**
   * List one `YYYY/M` folder of the public `images` bucket → map of basename →
   * bucket-relative key, paginating the S3 ListObjectsV2 response. Node has no
   * DOMParser, so the keys are pulled out with a small regex (this is the Node
   * twin of the Worker's DOMParser lister; both feed the shared resolver).
   */
  private async listCossFolder(prefix: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let token: string | null = null;

    do {
      const res: Response = await fetch(buildCossListUrl(prefix, token));
      if (!res.ok) break;
      const xml: string = await res.text();

      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        const key = m[1];
        const base = key.split('/').pop() ?? '';
        if (base) map.set(base, key);
      }

      const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
      const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      token = truncated ? (next?.[1] ?? null) : null;
    } while (token);

    return map;
  }

}

export type { NoteSummary };
