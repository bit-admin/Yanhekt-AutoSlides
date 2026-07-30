/**
 * Yanhekt cloud-note client. Browser port of the desktop app's NotesService
 * (autoslides/src/main/platform/notesService.ts): same endpoints and request
 * shapes, but fetched through the Worker proxy (/api/yanhekt) which injects the
 * yanhekt Origin/Referer/Xdomain-Client headers the note API requires.
 *
 * Every call returns the `NotesResult` envelope so callers can surface
 * auth/network failures uniformly ('not-signed-in' is mapped locally, before
 * any request, when no token is stored).
 */

import { authStore } from '../../stores/authStore';
import { NOTE_GROUP_NAME_MAX } from './notesTypes';
import type {
  NoteDetail,
  NoteGroup,
  NoteListParams,
  NoteListResult,
  NotesResult,
  UploadedImage,
} from './notesTypes';
import { createLogger } from '../logger';

const log = createLogger('NotesClient');

const PROXY_BASE = '/api/yanhekt';

/** Call surface shared with the desktop CloudNotesProvider (overrideRegistry). */
export interface CloudNotesProvider {
  list(params?: NoteListParams): Promise<NotesResult<NoteListResult>>;
  get(id: number): Promise<NotesResult<NoteDetail>>;
  create(): Promise<NotesResult<number>>;
  updateTitle(id: number, title: string, groupId?: number): Promise<NotesResult<void>>;
  updateContent(id: number, content: string): Promise<NotesResult<void>>;
  moveToGroup(
    id: number,
    groupId: number,
    title: string,
    content?: string,
  ): Promise<NotesResult<number>>;
  delete(id: number): Promise<NotesResult<void>>;
  groupList(): Promise<NotesResult<NoteGroup[]>>;
  groupCreate(name: string): Promise<NotesResult<void>>;
  groupDelete(id: number): Promise<NotesResult<void>>;
  uploadImage(bytes: ArrayBuffer, filename: string, mime: string): Promise<NotesResult<UploadedImage>>;
}

interface ApiEnvelope<T> {
  code: number | string;
  message?: string;
  data: T;
}

class NotesAuthError extends Error {
  constructor() {
    super('not-signed-in');
    this.name = 'NotesAuthError';
  }
}

function requireToken(): string {
  const token = authStore.token.value;
  if (!token) throw new NotesAuthError();
  return token;
}

async function request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const token = requireToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${PROXY_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`Note API request failed (${res.status}): ${method} ${path}`);
  }
  const payload = (await res.json()) as ApiEnvelope<T>;
  if (payload.code !== 0 && payload.code !== '0') {
    throw new Error(payload.message || `Note API error code ${payload.code}`);
  }
  return payload.data;
}

/** Wrap a call into the NotesResult envelope, mapping auth failures. */
async function run<T>(fn: () => Promise<T>): Promise<NotesResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof NotesAuthError) return { ok: false, error: 'not-signed-in' };
    const message = error instanceof Error ? error.message : String(error);
    log.warn('note call failed:', message);
    return { ok: false, error: message };
  }
}

export const notesClient: CloudNotesProvider = {
  /**
   * List notes (paginated). `content` is empty in list results — use get() to
   * edit. The server ignores group filtering here (see NoteListParams), so
   * callers filter by `note_group_id` client-side.
   */
  list(params: NoteListParams = {}) {
    const { page = 1, pageSize = 20, keyword = '' } = params;
    const qs = new URLSearchParams({
      with_brief: 'false',
      keyword,
      page: String(page),
      page_size: String(pageSize),
      with_page: 'true',
    });
    return run(() => request<NoteListResult>('GET', `/v1/note/list?${qs.toString()}`));
  },

  /** Fetch a single note (full content) by its database id. */
  get(id: number) {
    return run(() => request<NoteDetail>('GET', `/v1/note?id=${encodeURIComponent(id)}`));
  },

  /** Create a blank note; returns the new note's id. */
  create() {
    return run(async () => {
      const data = await request<{ id: number; success?: boolean }>('POST', '/v1/note', {
        content: '',
        version: 2,
      });
      return data.id;
    });
  },

  /**
   * Update a note's title and optionally assign it to a group.
   * Only group ids ≥ 1 are accepted by the server — omit the field to leave
   * the current group alone (never send 0; that errors with "笔记分组ID不能小于1").
   */
  updateTitle(id: number, title: string, groupId?: number) {
    const body: Record<string, unknown> = { id, title };
    if (groupId !== undefined && groupId > 0) body.note_group_id = groupId;
    return run(() => request<void>('PUT', '/v1/note', body));
  },

  /** Replace a note's content (stringified Editor.js document). */
  updateContent(id: number, content: string) {
    return run(() => request<void>('PUT', '/v1/note/content', { id, content }));
  },

  /**
   * Move a note into a group, or to Ungrouped when `groupId` is 0.
   *
   * Assigning a real group (≥ 1) is a normal PUT with `note_group_id`.
   * Ungrouping cannot be done in place: the server rejects `note_group_id: 0`
   * ("笔记分组ID不能小于1"), and omitting the field leaves the old group (the
   * official site's own ungroup is a silent no-op). Workaround: create a fresh
   * ungrouped note with the same title/content, then delete the original.
   *
   * Returns the note id after the operation (new id when ungrouped, same id
   * when moved into a group). Optional `content` avoids a re-fetch when the
   * caller already has the live editor document.
   */
  moveToGroup(id: number, groupId: number, title: string, content?: string) {
    return run(async () => {
      if (groupId > 0) {
        await request<void>('PUT', '/v1/note', { id, title, note_group_id: groupId });
        return id;
      }

      // Always fetch so we can skip no-op ungroups and fall back for content.
      const detail = await request<NoteDetail>('GET', `/v1/note?id=${encodeURIComponent(id)}`);
      if (detail.note_group_id == null || detail.note_group_id === 0) {
        return id;
      }

      const body = content ?? detail.content ?? '';
      const created = await request<{ id: number; success?: boolean }>('POST', '/v1/note', {
        content: '',
        version: 2,
      });
      const newId = created.id;
      await request<void>('PUT', '/v1/note', { id: newId, title });
      if (body) await request<void>('PUT', '/v1/note/content', { id: newId, content: body });
      await request<void>('DELETE', '/v1/note', { id });
      log.info('ungrouped note via recreate', { from: id, to: newId });
      return newId;
    });
  },

  /** Delete a note by id. */
  delete(id: number) {
    return run(() => request<void>('DELETE', '/v1/note', { id }));
  },

  groupList() {
    return run(() => request<NoteGroup[]>('GET', '/v1/note/group/list?with_note=false'));
  },

  /** Create a group. Server enforces a 6-character name limit; returns no id — re-fetch the list. */
  groupCreate(name: string) {
    return run(async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Group name is required');
      if (trimmed.length > NOTE_GROUP_NAME_MAX) {
        throw new Error(`Group name must be at most ${NOTE_GROUP_NAME_MAX} characters`);
      }
      await request<void>('POST', '/v1/note/group', { name: trimmed });
    });
  },

  /** Delete a group by id (orphaned notes fall back to the default group). */
  groupDelete(id: number) {
    return run(() => request<void>('DELETE', '/v1/note/group', { id }));
  },

  /**
   * Upload an image to the public MinIO `notes` bucket; returns the permanent
   * public URL ({host}{path}). Same file hashes deterministically to the same
   * URL. No manual Content-Type — FormData sets the multipart boundary.
   */
  uploadImage(bytes: ArrayBuffer, filename: string, mime: string) {
    return run(async () => {
      const token = requireToken();
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: mime || 'application/octet-stream' }), filename || 'image.png');
      form.append('bucket', 'notes');

      const res = await fetch(`${PROXY_BASE}/v1/minio/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        throw new Error(`Image upload failed (${res.status})`);
      }
      const payload = (await res.json()) as ApiEnvelope<{ host: string; path: string }>;
      if (payload.code !== 0 && payload.code !== '0') {
        throw new Error(payload.message || `Image upload error code ${payload.code}`);
      }
      return { url: `${payload.data.host}${payload.data.path}` };
    });
  },
};
