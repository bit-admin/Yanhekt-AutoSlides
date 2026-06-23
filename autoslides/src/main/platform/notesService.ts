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
} from '@common/notesTypes';
import { NOTE_GROUP_NAME_MAX } from '@common/notesTypes';
import { createLogger } from '@main/infra/logger';

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
}

export type { NoteSummary };
