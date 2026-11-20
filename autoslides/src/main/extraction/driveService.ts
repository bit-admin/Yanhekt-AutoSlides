/**
 * Drive (2026-11-20): upload a folder's slides to Yanhekt's public image host.
 * The records live in the folder's metadata.json (version 2, `drive`), written
 * only through SlideMetadataService.
 *
 * Facts this relies on (checked 2026-11-20, report in REFERENCE): the image
 * URL is `coss.yanhekt.cn/images/<YYYY>/<M>/<md5 of the uploaded bytes>.png`,
 * the same bytes give the same URL within a month, and an upload is public
 * and cannot be deleted. So a slide whose record still matches its file is
 * never sent again, and any change to the file (a crop) needs a new upload.
 *
 * Folders without metadata.json are not recognised (made before 5.0.0, or by
 * Web Capture) and are never uploaded.
 */
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@main/infra/logger';
import { readOutputDir } from '@main/infra/outputDir';
import { expandTilde } from '@main/infra/pathUtils';
import type { ShareService } from '@main/platform/shareService';
import { decodeSharePayload, parseCossImageUrl, payloadHasTimeline } from '@common/shareLink';
import { buildSlideShareLink, MAX_SHORTENABLE_FRAGMENT_BYTES } from '@common/shareCreation';
import {
  driveFileState,
  driveFolderCounts,
  type DriveFileStat,
  type DriveFolderSummary,
  type DriveResult,
  type DriveShareLink,
  type DriveUploadProgress,
} from '@common/driveStatus';
import type { SlideDriveFile, SlideMetadata, SlideShareRecord } from '@common/sidecars/metadata';
import type { SlideMetadataService } from './slideMetadataService';
import type { SlideTimelineService } from './slideTimelineService';

const log = createLogger('Drive');

/** Uploads in flight at once, per folder. */
const UPLOAD_CONCURRENCY = 3;

const isSlideFile = (name: string): boolean => name.startsWith('Slide_') && name.endsWith('.png');

export function md5Of(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex');
}

type Uploader = Pick<ShareService, 'uploadImage' | 'shortenShareUrl'>;
type MetadataStore = Pick<
  SlideMetadataService,
  'read' | 'writeExtraction' | 'recordDriveUploads' | 'saveShare' | 'removeShare'
>;
type TimelineStore = Pick<SlideTimelineService, 'read'>;

interface UploadJob {
  progress: DriveUploadProgress;
  cancelled: boolean;
}

export class DriveService {
  private jobs = new Map<string, UploadJob>();

  constructor(
    private readonly uploader: Uploader,
    private readonly metadata: MetadataStore,
    private readonly timelines: TimelineStore,
    private readonly signedIn: () => boolean,
  ) {}

  /** `Slide_*.png` files of a folder with size and modified time, in name order. */
  private async slideStats(folderPath: string): Promise<DriveFileStat[]> {
    let names: string[];
    try {
      names = (await fs.readdir(folderPath)).filter(isSlideFile).sort();
    } catch {
      return [];
    }
    const stats = await Promise.all(names.map(async (name) => {
      try {
        const stat = await fs.stat(path.join(folderPath, name));
        return stat.isFile() ? { name, size: stat.size, mtimeMs: stat.mtimeMs } : null;
      } catch {
        return null;
      }
    }));
    return stats.filter((s): s is DriveFileStat => s !== null);
  }

  /**
   * Records whose quick check failed but whose file still holds the uploaded
   * bytes (Restore Crop copies the original back with a new modified time):
   * refresh their size and time, so they count as uploaded from now on.
   */
  private async settleChanged(folderPath: string, meta: SlideMetadata, files: DriveFileStat[]): Promise<SlideMetadata> {
    const records = meta.drive?.files;
    if (!records) return meta;
    const refreshed: Record<string, SlideDriveFile> = {};
    for (const file of files) {
      const record = records[file.name];
      if (driveFileState(record, file) !== 'changed' || record.size !== file.size) continue;
      try {
        const md5 = md5Of(await fs.readFile(path.join(folderPath, file.name)));
        if (md5 === record.md5) refreshed[file.name] = { ...record, mtimeMs: file.mtimeMs };
      } catch { /* unreadable: stays changed */ }
    }
    if (Object.keys(refreshed).length === 0) return meta;
    await this.metadata.recordDriveUploads(folderPath, refreshed);
    return { ...meta, drive: { files: { ...records, ...refreshed } } };
  }

  /** One folder's Drive summary (also used after an upload). */
  async folderSummary(folderPath: string): Promise<DriveFolderSummary> {
    const resolved = path.resolve(expandTilde(folderPath));
    const files = await this.slideStats(resolved);
    let meta = await this.metadata.read(resolved, { afterWrites: true });
    if (meta) meta = await this.settleChanged(resolved, meta, files);
    let mtimeMs = 0;
    try { mtimeMs = (await fs.stat(resolved)).mtimeMs; } catch { /* gone */ }
    const counts = driveFolderCounts(meta, files);
    let currentUrl: string | undefined;
    if (meta && counts.status === 'uploaded') ({ meta, currentUrl } = await this.recordCurrentShare(resolved, meta, files));
    return {
      name: path.basename(resolved),
      path: resolved,
      recognised: meta !== null,
      courseId: meta?.source.courseId,
      sessionId: meta?.source.sessionId,
      liveId: meta?.source.liveId,
      courseTitle: meta?.source.courseTitle,
      sessionTitle: meta?.source.sessionTitle,
      counts,
      shares: (meta?.shares ?? []).map((share) => shareLinkOf(share, share.longUrl === currentUrl)),
      mtimeMs,
    };
  }

  /**
   * A fully uploaded folder's link as it is now: every slide in name order,
   * always with the slide timeline when the folder has one that maps onto its
   * slides (so Clone Slides from Link can use it); images only otherwise. Recorded in `shares` the first time it is seen, so each
   * change to the uploaded slides (or the timeline) leaves a new version and
   * the older links stay listed; they keep working, since uploads cannot be
   * deleted. The id is derived from the link, so two reads racing to record
   * it write the same record.
   */
  private async recordCurrentShare(
    folderPath: string,
    meta: SlideMetadata,
    files: DriveFileStat[],
  ): Promise<{ meta: SlideMetadata; currentUrl?: string }> {
    const records = meta.drive?.files ?? {};
    let timeline = null;
    try {
      timeline = await this.timelines.read(folderPath, { afterWrites: true });
    } catch { /* no timeline: images only */ }
    const link = buildSlideShareLink(
      { courseId: meta.source.courseId, sessionId: meta.source.sessionId, liveId: meta.source.liveId },
      files.map((f) => ({ filename: f.name, url: records[f.name].url })),
      timeline,
    );
    if (!link) return { meta };
    const currentUrl = link.longUrl;
    if (meta.shares?.some((share) => share.longUrl === currentUrl)) return { meta, currentUrl };
    const share: SlideShareRecord = {
      id: createHash('sha256').update(link.longUrl).digest('hex').slice(0, 16),
      createdAt: new Date().toISOString(),
      longUrl: link.longUrl,
      files: files.map((f) => f.name),
      timeline: linkHasTimeline(link.longUrl),
    };
    const written = await this.metadata.saveShare(folderPath, share);
    if (written === 'failed' || written === 'blocked') return { meta, currentUrl };
    return { meta: { ...meta, shares: [...(meta.shares ?? []).filter((s) => s.id !== share.id), share] }, currentUrl };
  }

  /**
   * Take one link off the folder's list (the link itself keeps working).
   * Refused for the last link and for the current one, which the next read
   * would record again anyway.
   */
  async removeShare(folderPath: string, id: string): Promise<DriveResult<null>> {
    const resolved = path.resolve(expandTilde(folderPath));
    const { shares } = await this.folderSummary(resolved);
    const share = shares.find((s) => s.id === id);
    if (!share) return { ok: false, error: 'not-found' };
    if (shares.length <= 1) return { ok: false, error: 'last-link' };
    if (share.current) return { ok: false, error: 'current-link' };
    const written = await this.metadata.removeShare(resolved, id);
    return written === 'failed' || written === 'blocked' ? { ok: false, error: 'failed' } : { ok: true, data: null };
  }

  /** Make a short link for one recorded share and keep it on the record. */
  async shortenShare(folderPath: string, id: string): Promise<DriveResult<DriveShareLink>> {
    const resolved = path.resolve(expandTilde(folderPath));
    const share = (await this.metadata.read(resolved, { afterWrites: true }))?.shares?.find((s) => s.id === id);
    if (!share) return { ok: false, error: 'not-found' };
    if (share.shortUrl) return { ok: true, data: shareLinkOf(share) };
    if (!shareLinkOf(share).canShorten) return { ok: false, error: 'too-long' };
    const next = { ...share, shortUrl: (await this.uploader.shortenShareUrl(fragmentOf(share.longUrl))).url };
    const written = await this.metadata.saveShare(resolved, next);
    if (written === 'failed' || written === 'blocked') return { ok: false, error: 'failed' };
    return { ok: true, data: shareLinkOf(next) };
  }

  /** Every `slides_*` folder in the output folder, newest first. */
  async folderSummaries(outputDir: string): Promise<DriveFolderSummary[]> {
    const root = path.resolve(expandTilde(outputDir));
    const entries = await readOutputDir(root);
    const folders = entries.filter((e) => e.isDirectory() && e.name.startsWith('slides_'));
    const summaries = await Promise.all(folders.map((e) => this.folderSummary(path.join(root, e.name))));
    return summaries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  progressOf(jobId: string): DriveUploadProgress | null {
    return this.jobs.get(jobId)?.progress ?? null;
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.cancelled = true;
  }

  /**
   * Upload the slides of one folder that have no matching record. Resolves
   * when the job ends; `onProgress` gets every step. Refuses an unrecognised
   * folder, a folder already uploading, and a signed-out app.
   */
  async uploadFolder(
    folderPath: string,
    onProgress: (progress: DriveUploadProgress) => void,
    jobId: string = randomUUID(),
  ): Promise<DriveResult<DriveUploadProgress>> {
    if (!this.signedIn()) return { ok: false, error: 'sign-in' };
    const resolved = path.resolve(expandTilde(folderPath));
    if ([...this.jobs.values()].some((j) => j.progress.folderPath === resolved && !isFinished(j.progress))) {
      return { ok: false, error: 'busy' };
    }
    const meta = await this.metadata.read(resolved, { afterWrites: true });
    if (!meta) return { ok: false, error: 'not-recognised' };

    const job: UploadJob = {
      progress: { jobId, folderPath: resolved, phase: 'checking', total: 0, done: 0, failed: 0, skipped: 0 },
      cancelled: false,
    };
    this.jobs.set(jobId, job);
    const emit = () => onProgress({ ...job.progress });
    emit();

    try {
      const files = await this.slideStats(resolved);
      const settled = await this.settleChanged(resolved, meta, files);
      const records = settled.drive?.files ?? {};
      const pending = files.filter((f) => driveFileState(records[f.name], f) !== 'uploaded');
      job.progress.skipped = files.length - pending.length;
      job.progress.total = pending.length;
      job.progress.phase = 'uploading';
      emit();

      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < pending.length && !job.cancelled) {
          const file = pending[next++];
          try {
            const record = await this.uploadOne(resolved, file, records[file.name]);
            if (record) {
              await this.metadata.recordDriveUploads(resolved, { [file.name]: record });
              job.progress.done++;
            } else {
              job.progress.failed++;
            }
          } catch (error) {
            job.progress.failed++;
            log.warn('Drive upload failed', file.name, error instanceof Error ? error.message : error);
            // Signed out mid-run: stop, and say why (the renderer words it).
            if (error instanceof Error && error.name === 'ShareAuthError') {
              job.cancelled = true;
              job.progress.error = 'sign-in';
            }
          }
          emit();
        }
      };
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, worker));
      job.progress.phase = job.cancelled ? 'cancelled' : 'done';
    } catch (error) {
      job.progress.phase = 'error';
      job.progress.error = error instanceof Error ? error.message : String(error);
      log.error('Drive upload stopped', resolved, error);
    }
    emit();
    const final = { ...job.progress };
    this.jobs.delete(jobId);
    return { ok: true, data: final };
  }

  /**
   * Upload one slide. The record is kept only when the returned URL names the
   * MD5 of the bytes sent: otherwise the host changed the file, and the URL
   * would not identify this slide. Null = not recorded.
   */
  private async uploadOne(folderPath: string, file: DriveFileStat, previous: SlideDriveFile | undefined): Promise<SlideDriveFile | null> {
    const bytes = await fs.readFile(path.join(folderPath, file.name));
    // Read the stat again with the bytes: the quick check must describe what was sent.
    const stat = await fs.stat(path.join(folderPath, file.name));
    const md5 = md5Of(bytes);
    const { url } = await this.uploader.uploadImage(bytes, file.name, 'image/png');
    const ref = parseCossImageUrl(url);
    if (!ref || ref.hash !== md5) {
      log.warn('Drive upload URL does not name the file MD5', file.name, url);
      return null;
    }
    const now = new Date().toISOString();
    return {
      url,
      md5,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      uploadedAt: previous?.uploadedAt ?? now,
      updatedAt: now,
    };
  }

  /**
   * Record a folder made by Clone Slides from Link: metadata.json with
   * `extractor: 'share'` and the link's lecture facts, then an upload record
   * for every slide whose bytes are the ones its URL names (the images are on
   * Drive already). `slides` pairs each written file with its source URL.
   */
  async recordClone(
    folderPath: string,
    input: { source: SlideMetadata['source']; slides: Array<{ filename: string; url: string }> },
  ): Promise<DriveResult<null>> {
    const resolved = path.resolve(expandTilde(folderPath));
    const written = await this.metadata.writeExtraction(resolved, {
      source: input.source,
      extraction: { extractor: 'share', extractedAt: new Date().toISOString(), trigger: 'auto' },
    });
    if (written === 'failed' || written === 'blocked') return { ok: false, error: 'failed' };
    const records: Record<string, SlideDriveFile> = {};
    const now = new Date().toISOString();
    for (const { filename, url } of input.slides) {
      if (!isSlideFile(filename) || path.basename(filename) !== filename) continue;
      const ref = parseCossImageUrl(url);
      if (!ref) continue;
      try {
        const filePath = path.join(resolved, filename);
        const md5 = md5Of(await fs.readFile(filePath));
        if (md5 !== ref.hash) continue;
        const stat = await fs.stat(filePath);
        records[filename] = { url, md5, size: stat.size, mtimeMs: stat.mtimeMs, uploadedAt: now, updatedAt: now };
      } catch { /* missing file: no record */ }
    }
    await this.metadata.recordDriveUploads(resolved, records);
    return { ok: true, data: null };
  }
}

const fragmentOf = (longUrl: string): string => longUrl.slice(longUrl.indexOf('#') + 1);

/** Read from the link itself, so older records report what the link really carries. */
function linkHasTimeline(longUrl: string): boolean {
  const payload = decodeSharePayload(fragmentOf(longUrl));
  return !!payload && payloadHasTimeline(payload);
}

function shareLinkOf(share: SlideShareRecord, current = false): DriveShareLink {
  return {
    id: share.id,
    createdAt: share.createdAt,
    longUrl: share.longUrl,
    ...(share.shortUrl ? { shortUrl: share.shortUrl } : {}),
    imageCount: share.files.length,
    timeline: linkHasTimeline(share.longUrl),
    current,
    canShorten: fragmentOf(share.longUrl).length <= MAX_SHORTENABLE_FRAGMENT_BYTES,
  };
}

function isFinished(progress: DriveUploadProgress): boolean {
  return progress.phase === 'done' || progress.phase === 'cancelled' || progress.phase === 'error';
}
