// Drive (2026-11-20): slides uploaded to Yanhekt's public image host, recorded
// per folder in metadata.json `drive.files`. Pure rules shared by main and the
// renderer: whether a slide's upload record still matches its file, and the
// per-folder counts the Slides page shows.
import type { SlideDriveFile, SlideMetadata } from './sidecars/metadata';

/** A slide on disk as the Drive rules need it. */
export interface DriveFileStat {
  name: string;
  size: number;
  mtimeMs: number;
}

/**
 * `uploaded`: the record matches the file (quick check: size and modified
 * time). `changed`: there is a record but the file differs from what was
 * uploaded (a crop), or could not be confirmed by the quick check. `none`: no
 * record. A `changed` file may still hold the uploaded bytes (Restore Crop
 * copies them back); the main process settles that with the MD5.
 */
export type DriveFileState = 'uploaded' | 'changed' | 'none';

export function driveFileState(record: SlideDriveFile | undefined, stat: DriveFileStat): DriveFileState {
  if (!record) return 'none';
  return record.size === stat.size && record.mtimeMs === stat.mtimeMs ? 'uploaded' : 'changed';
}

export type DriveFolderStatus = 'none' | 'partial' | 'uploaded' | 'changed';

export interface DriveFolderCounts {
  /** Extracted slides (`Slide_*.png` in the folder). */
  total: number;
  uploaded: number;
  changed: number;
  notUploaded: number;
  status: DriveFolderStatus;
  /** Newest `updatedAt` among the records, or null. */
  lastUploadAt: string | null;
}

/** Counts over the folder's extracted slides. Records of trashed slides are ignored. */
export function driveFolderCounts(meta: Pick<SlideMetadata, 'drive'> | null | undefined, files: DriveFileStat[]): DriveFolderCounts {
  const records = meta?.drive?.files ?? {};
  let uploaded = 0;
  let changed = 0;
  for (const file of files) {
    const state = driveFileState(records[file.name], file);
    if (state === 'uploaded') uploaded++;
    else if (state === 'changed') changed++;
  }
  const total = files.length;
  const notUploaded = total - uploaded - changed;
  let lastUploadAt: string | null = null;
  for (const record of Object.values(records)) {
    if (!lastUploadAt || record.updatedAt > lastUploadAt) lastUploadAt = record.updatedAt;
  }
  const status: DriveFolderStatus = changed > 0
    ? 'changed'
    : uploaded === 0
      ? 'none'
      : uploaded === total ? 'uploaded' : 'partial';
  return { total, uploaded, changed, notUploaded, status, lastUploadAt };
}

/** One recorded share link, as the Slides page shows it. */
export interface DriveShareLink {
  id: string;
  createdAt: string;
  longUrl: string;
  shortUrl?: string;
  imageCount: number;
  /** Whether the link carries the slide timeline (read from the link). */
  timeline: boolean;
  /** The link of the folder as it is now (every slide uploaded and unchanged). Cannot be removed. */
  current: boolean;
  /** False when the link is too long for the short-link service. */
  canShorten: boolean;
}

/** One folder's upload state, for the Slides page. */
export interface DriveFolderSummary {
  name: string;
  path: string;
  /** False for a folder without metadata.json (made before 5.0.0, or by Web Capture): it cannot be uploaded. */
  recognised: boolean;
  courseId?: string;
  sessionId?: string;
  liveId?: string;
  courseTitle?: string;
  sessionTitle?: string;
  counts: DriveFolderCounts;
  /**
   * The folder's share links, oldest first. A fully uploaded folder's
   * current link is recorded when first seen, so the last one is current
   * unless slides changed since.
   */
  shares: DriveShareLink[];
  /** Folder modified time, for sorting. */
  mtimeMs: number;
}

export type DriveUploadPhase = 'checking' | 'uploading' | 'done' | 'cancelled' | 'error';

/** Progress of one folder upload, pushed from main. */
export interface DriveUploadProgress {
  jobId: string;
  folderPath: string;
  phase: DriveUploadPhase;
  /** Slides to send (not counting the ones already uploaded). */
  total: number;
  done: number;
  failed: number;
  /** Slides skipped because their record already matched. */
  skipped: number;
  /** Why the job stopped: an error message, or `sign-in` when the account was signed out mid-run. */
  error?: string;
}

export type DriveError =
  | 'sign-in'
  | 'not-recognised'
  | 'not-found'
  | 'too-long'
  | 'last-link'
  | 'current-link'
  | 'busy'
  | 'failed';

export type DriveResult<T> = { ok: true; data: T } | { ok: false; error: DriveError; message?: string; count?: number };
