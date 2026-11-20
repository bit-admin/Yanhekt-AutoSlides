import { promises as fs } from 'fs';
import type { AxiosResponse } from 'axios';
import path from 'path';
import { appUserAgent } from '@main/infra/appUserAgent';
import { httpFetch } from '@main/infra/http';
import { createLogger } from '@main/infra/logger';
import { ensureWritableOutputDir } from '@main/infra/outputDir';
import { expandTilde } from '@main/infra/pathUtils';
import { sharpService } from '@main/infra/sharpService';
import { buildSlideFolderName, type LectureIdentity } from '@common/lectureNaming';
import {
  buildShareImportTitle,
  splitNoteDisplayName,
  type ExportFolderInfo,
  type ShareImportResult,
  type ShareLectureMeta,
  type UploadedImage,
} from '@common/notesTypes';
import { SHARE_ORIGIN, SHARE_PATH, decodeSharePayload, parseShareLink } from '@common/shareLink';
import { buildCossListUrl, resolveShareImages } from '@common/shareResolve';
import { timelineFromSharePayload } from '@common/shareTimeline';
import type { ConfigService } from './configService';
import type { IntranetApiTransport } from './intranetApiTransport';

const log = createLogger('ShareService');
const UPLOAD_TIMEOUT_MS = 120_000;
const COSS_TIMEOUT_MS = 30_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isPng = (bytes: Buffer): boolean => bytes.subarray(0, 8).equals(PNG_SIGNATURE);

/** Share uploads require the active Yanhekt account; public share links do not. */
export class ShareAuthError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'ShareAuthError';
  }
}

interface UploadEnvelope {
  code: number;
  message?: string;
  displayable?: boolean;
  data: { host: string; path: string };
}

/**
 * Canonical titles of one lecture, looked up by the app itself (signed-in
 * Yanhekt session list, then the course index on this computer for an
 * expired course). '' for what it could not find.
 */
export type LectureTitleLookup = (
  courseId: string,
  sessionId: string | undefined,
) => Promise<{ courseTitle: string; sessionTitle: string } | null>;

/**
 * The share Worker labels a session of an expired course `第N次课` (its
 * position in the Index) when Yanhekt gives no title. That is not a real
 * title and the number can change, so it never names a folder.
 */
const WORKER_POSITION_LABEL = /^第\d+次课$/;

/**
 * The Worker's metadata with the app's own titles laid over it. The app's
 * titles win; the Worker's position label is dropped when the app found none.
 */
export function mergeShareLectureMeta(
  worker: ShareLectureMeta | null,
  own: { courseTitle: string; sessionTitle: string } | null,
): ShareLectureMeta | null {
  const workerSession = worker?.sessionTitle?.trim() ?? '';
  const courseTitle = own?.courseTitle || worker?.courseTitle?.trim() || '';
  const sessionTitle = own?.sessionTitle || (WORKER_POSITION_LABEL.test(workerSession) ? '' : workerSession);
  if (!worker && !courseTitle && !sessionTitle) return null;
  return { ...worker, courseTitle, sessionTitle };
}

/** Upload slides for Share, resolve public links and rebuild local slide folders. */
export class ShareService {
  constructor(
    private readonly configService: Pick<ConfigService, 'getAuthToken' | 'getConfig'>,
    /** Yanhekt hosts (the cbiz upload, COSS reads), through the intranet when it is reachable. */
    private readonly transport: Pick<IntranetApiTransport, 'send'>,
    private readonly lectureTitles: LectureTitleLookup = async () => null,
  ) {}

  /** Headers for multipart upload — no manual Content-Type (FormData sets the boundary). */
  private uploadHeaders(): Record<string, string> {
    const token = this.configService.getAuthToken();
    if (!token) throw new ShareAuthError();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.yanhekt.cn',
      Referer: 'https://www.yanhekt.cn/',
      'Xdomain-Client': 'web_user',
    };
  }

  // ── Image upload ───────────────────────────────────────────────────────

  /**
   * Upload an image to the public MinIO `notes` bucket; returns the permanent
   * public URL ({host}{path}). Same file hashes deterministically to the same URL.
   */
  async uploadImage(bytes: ArrayBuffer | Uint8Array, filename: string, mime: string): Promise<UploadedImage> {
    return this.uploadBytes(bytes, filename, mime);
  }

  /**
   * Upload a local slide without round-tripping the image through the renderer.
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

    const res = await this.transport.send<UploadEnvelope>({
      method: 'POST',
      url: 'https://cbiz.yanhekt.cn/v1/minio/upload',
      headers: this.uploadHeaders(),
      data: form,
      timeout: UPLOAD_TIMEOUT_MS,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Image upload failed (${res.status})`);
    }
    const payload = res.data;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Image upload returned no data');
    }
    if (payload.code !== 0) {
      if (payload.displayable === false || !payload.message) {
        log.warn('Yanhekt image upload error', { code: payload.code, message: payload.message });
        throw new Error(`yanhekt-error:${payload.code}`);
      }
      throw new Error(payload.message);
    }
    const url = `${payload.data.host}${payload.data.path}`;
    log.info('uploaded image', url);
    return { url };
  }

  // ── Export to local slide folders ──────────────────────────────────────

  /** Configured slides output directory, with leading `~` expanded. */
  private exportBaseDir(): string {
    const dir = this.configService.getConfig().outputDirectory;
    return expandTilde(dir);
  }

  /**
   * Local `slides_<displayName>[__c<id>s<id>]` folder path for shared slides.
   *
   * The lecture identity distinguishes same-titled courses, just as it does for
   * freshly extracted slides. With no identity, prepareExportFolder can add a
   * ` (N)` suffix to preserve an existing folder.
   */
  private slidesFolderPath(displayName: string, identity: LectureIdentity = {}): string {
    const { course, session } = splitNoteDisplayName(displayName);
    return path.join(
      this.exportBaseDir(),
      buildSlideFolderName(
        { courseTitle: course || undefined, sessionTitle: session || undefined },
        identity,
      ),
    );
  }

  /** Whether the base export folder for this display name already exists on disk. */
  async exportFolderStatus(displayName: string, identity: LectureIdentity = {}): Promise<ExportFolderInfo> {
    const dir = this.slidesFolderPath(displayName, identity);
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
    identity: LectureIdentity = {},
  ): Promise<ExportFolderInfo> {
    let dir = this.slidesFolderPath(displayName, identity);
    if (mode === 'create') {
      let n = 2;
      while (await this.pathExists(dir)) {
        dir = `${this.slidesFolderPath(displayName, identity)} (${n})`;
        n += 1;
      }
    }
    await ensureWritableOutputDir(this.exportBaseDir(), dir);
    return { exists: true, dir, folderName: path.basename(dir) };
  }

  /**
   * Download a single slide image from its public CDN URL and write it into the
   * export folder. The server stores hashed URLs and may change the extension, so
   * the bytes are re-encoded to real PNG via sharp when available (otherwise the
   * raw bytes are written, best-effort).
   */
  async downloadImageToFolder(url: string, dir: string, filename: string): Promise<void> {
    // COSS images go over the intranet like the API; other hosts are left as they are.
    const res = await this.transport.send<ArrayBuffer>({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: COSS_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Image download failed (${res.status})`);
    }
    const raw = Buffer.from(res.data);
    let out: Buffer = raw;
    // A PNG is kept byte for byte: its MD5 is then the one in its URL, which is
    // what lets the cloned folder record the slide as already on Drive.
    if (!isPng(raw) && sharpService.isAvailable()) {
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
   * share Worker. Runs in the main process so it doesn't hit renderer CORS.
   */
  async shortenShareUrl(fragment: string): Promise<{ url: string }> {
    const res = await httpFetch(`${SHARE_ORIGIN}${SHARE_PATH}/api/shorten`, {
      method: 'POST',
      headers: this.shareHeaders({ 'Content-Type': 'application/json' }),
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
   * Headers for the share Worker: {@link appUserAgent}, and the signed-in
   * Yanhekt token as a Bearer when there is one (like the Index calls).
   */
  private shareHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra, 'User-Agent': appUserAgent() };
    const token = this.configService.getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // ── Share-link resolve ──────────────────────────────────────────────────

  /**
   * Resolve a long `#fragment` or short `/v1/s/<id>` into a title and ordered
   * slide URLs for a local clone. Lists the public COSS `images` bucket to expand
   * the short hashes. Runs in main to avoid renderer CORS and works without auth.
   */
  async resolveShareLink(link: string): Promise<ShareImportResult> {
    const parsed = parseShareLink(link);
    if (!parsed) throw new Error('invalid-share-link');

    let fragment = parsed.fragment;
    let shortMeta: ShareLectureMeta | null = null;
    if (!fragment && parsed.shortId) {
      const got = await this.fetchShortLink(parsed.shortId);
      fragment = got.fragment;
      shortMeta = got.meta;
    }
    if (!fragment) throw new Error('invalid-share-link');

    const payload = decodeSharePayload(fragment);
    if (!payload) throw new Error('invalid-share-link');

    const identity = { courseId: payload.c, sessionId: payload.s, liveId: payload.l };
    const [resolved, workerMeta, ownTitles] = await Promise.all([
      resolveShareImages(payload, (prefix, onlyHash) => this.listCossFolder(prefix, onlyHash)),
      shortMeta ? Promise.resolve(shortMeta) : this.fetchShareMeta(identity.courseId, identity.sessionId),
      this.ownLectureTitles(identity.courseId, identity.sessionId),
    ]);
    const lectureMeta = mergeShareLectureMeta(workerMeta, ownTitles);
    const urls = resolved.filter((r) => r.url !== null).map((r) => r.url as string);
    return {
      title: buildShareImportTitle(identity, lectureMeta),
      identity,
      urls,
      missing: resolved.length - urls.length,
      lectureMeta,
      timeline: timelineFromSharePayload(payload),
    };
  }

  /**
   * Look up a short-link id via the public share Worker. `/v1/api/get` returns
   * `{ fragment, meta }` so the folder title can be rebuilt without a second hop.
   */
  private async fetchShortLink(id: string): Promise<{ fragment: string; meta: ShareLectureMeta | null }> {
    const res = await httpFetch(`${SHARE_ORIGIN}${SHARE_PATH}/api/get?id=${encodeURIComponent(id)}`, {
      headers: this.shareHeaders(),
    });
    if (!res.ok) throw new Error(`Short-link lookup failed (${res.status})`);
    const data = (await res.json()) as { fragment?: string; meta?: ShareLectureMeta | null };
    if (!data.fragment) throw new Error('Short link not found');
    return { fragment: data.fragment, meta: data.meta ?? null };
  }

  /** The app's own titles for a shared lecture; null when it cannot look (no course id) or the lookup fails. */
  private async ownLectureTitles(
    courseId?: string,
    sessionId?: string,
  ): Promise<{ courseTitle: string; sessionTitle: string } | null> {
    if (!courseId) return null;
    try {
      return await this.lectureTitles(String(courseId), sessionId === undefined ? undefined : String(sessionId));
    } catch (error) {
      log.debug('Own lecture title lookup failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /** Long-link path: one Worker hop that fans out to Yanhekt course + session. */
  private async fetchShareMeta(
    courseId?: string,
    sessionId?: string,
  ): Promise<ShareLectureMeta | null> {
    if (!courseId && !sessionId) return null;
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', courseId);
    if (sessionId) params.set('sessionId', sessionId);
    try {
      const res = await httpFetch(`${SHARE_ORIGIN}${SHARE_PATH}/api/meta?${params}`, {
        headers: this.shareHeaders(),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { meta?: ShareLectureMeta | null };
      return data.meta ?? null;
    } catch {
      return null;
    }
  }

  /**
   * List one `YYYY/M` folder of the public `images` bucket → map of basename →
   * bucket-relative key, paginating the S3 ListObjectsV2 response. With
   * `onlyHash` (the folder's one distinct hash, chosen by the shared resolver)
   * one page with the first match is enough. Node has no DOMParser, so the
   * keys are pulled out with a small regex (this is the Node twin of the
   * viewer's DOMParser lister; both feed the shared resolver).
   */
  private async listCossFolder(prefix: string, onlyHash?: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let token: string | null = null;

    do {
      const res: AxiosResponse<string> = await this.transport.send<string>({
        method: 'GET',
        url: buildCossListUrl(prefix, token, onlyHash),
        responseType: 'text',
        timeout: COSS_TIMEOUT_MS,
        validateStatus: () => true,
      });
      if (res.status < 200 || res.status >= 300) break;
      const xml: string = typeof res.data === 'string' ? res.data : String(res.data ?? '');

      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        const key = m[1];
        const base = key.split('/').pop() ?? '';
        if (base) map.set(base, key);
      }

      if (onlyHash) break;
      const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
      const next: RegExpMatchArray | null = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      token = truncated ? (next?.[1] ?? null) : null;
    } while (token);

    return map;
  }
}
