import { promises as fs } from 'fs';
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
import { SHARE_ORIGIN, SHARE_PATH, decodeSharePayload, parseShareLink, payloadHasTimeline } from '@common/shareLink';
import { buildCossListUrl, resolveShareImages } from '@common/shareResolve';
import { timelineFromSharePayload } from '@common/shareTimeline';
import type { ConfigService } from './configService';
import type { IntranetApiTransport } from './intranetApiTransport';

const log = createLogger('ShareService');
const UPLOAD_TIMEOUT_MS = 120_000;

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

/** Upload slides for Share, resolve public links and rebuild local slide folders. */
export class ShareService {
  constructor(
    private readonly configService: Pick<ConfigService, 'getAuthToken' | 'getConfig'>,
    private readonly cbiz: Pick<IntranetApiTransport, 'send'>,
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
  async uploadImage(bytes: ArrayBuffer, filename: string, mime: string): Promise<UploadedImage> {
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

    const res = await this.cbiz.send<UploadEnvelope>({
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
    const res = await httpFetch(url);
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
   *
   * `requireTimeline` rejects v2 / no-timeline payloads after decode (and after
   * the short-link hop) so callers that need `timeline.json` skip the bucket list.
   */
  async resolveShareLink(
    link: string,
    opts?: { requireTimeline?: boolean },
  ): Promise<ShareImportResult> {
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
    // Lectures clone needs timeline.json; fail before the public bucket listing.
    if (opts?.requireTimeline && !payloadHasTimeline(payload)) {
      throw new Error('share-link-no-timeline');
    }

    const identity = { courseId: payload.c, sessionId: payload.s, liveId: payload.l };
    const [resolved, lectureMeta] = await Promise.all([
      resolveShareImages(payload, (prefix) => this.listCossFolder(prefix)),
      shortMeta ? Promise.resolve(shortMeta) : this.fetchShareMeta(identity.courseId, identity.sessionId),
    ]);
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
   * bucket-relative key, paginating the S3 ListObjectsV2 response. Node has no
   * DOMParser, so the keys are pulled out with a small regex (this is the Node
   * twin of the Worker's DOMParser lister; both feed the shared resolver).
   */
  private async listCossFolder(prefix: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let token: string | null = null;

    do {
      const res: Response = await httpFetch(buildCossListUrl(prefix, token));
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
