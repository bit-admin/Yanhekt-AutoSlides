// Renderer-side helper for writing per-folder slide metadata. Lives in
// shared/services so both PostProcessingService and feature composables may
// import it (shared/ may not import features/). All calls are best-effort —
// metadata recording must never break extraction or review flows.
import type { SessionSnapshot } from './sessionSnapshot';
import { createLogger } from '@shared/utils/logger';
import type {
  SlideMetadataKind,
  SlideMetadataSource,
  SlideExtractionMeta,
  SlidePostProcessingMeta,
} from '@common/slideMetadataTypes';

const log = createLogger('SlideMetadataClient');

// Build identifying context from the session a download or task carries.
// Returns an empty object when there is none — callers can still pass an
// explicit `source` override for the fields they hold directly.
function sourceFromSnapshot(snapshot?: SessionSnapshot): SlideMetadataSource {
  if (!snapshot) return {};
  const data = snapshot.session;
  const ci = snapshot.course;
  return {
    courseId: ci?.id,
    courseTitle: ci?.title,
    courseNumber: ci?.number,
    sessionId: data.session_id != null ? String(data.session_id) : undefined,
    sessionTitle: data.title,
    instructor: ci?.instructor,
    professors: ci?.professors,
    semester: ci?.semester,
    schoolYear: ci?.school_year,
    college: ci?.college_name,
    classrooms: ci?.classrooms?.map(c => c.name),
    weekNumber: data.week_number,
    day: data.day,
  };
}

// metadata version 1 normalizes the inconsistent runtime types the Yanhekt API
// delivers (course/session ids arrive as number-or-string; `semester` is a number
// from getCourseInfo but a string from the course list; `week_number` is a JSON
// number but `day` is a JSON string). We canonicalize identifiers + semester +
// schoolYear to strings and week/day to numbers so the stored file is internally
// consistent regardless of which path supplied the value. See SLIDE_METADATA_VERSION.
function toStringId(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeSource(source: SlideMetadataSource): SlideMetadataSource {
  return {
    ...source,
    courseId: toStringId(source.courseId),
    liveId: toStringId(source.liveId),
    courseNumber: toStringId(source.courseNumber),
    sessionId: toStringId(source.sessionId),
    semester: toStringId(source.semester),
    schoolYear: toStringId(source.schoolYear),
    weekNumber: toNumber(source.weekNumber),
    day: toNumber(source.day),
  };
}

// Overlay only defined keys so an explicit partial never blanks a snapshot value.
function mergeSource(base: SlideMetadataSource, override?: Partial<SlideMetadataSource>): SlideMetadataSource {
  if (!override) return base;
  const merged: SlideMetadataSource = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export interface RecordRecordedExtractionInput {
  folderPath: string;
  extractor: 'builtin' | 'qt';
  ssimThreshold?: number;
  // Source medium of the folder. Defaults to 'recorded' when omitted.
  kind?: SlideMetadataKind;
  // How the extraction was initiated (task/download → 'auto', playback → 'watch').
  trigger?: 'auto' | 'watch';
  // The queued session, used to enrich `source`.
  session?: SessionSnapshot;
  // Fields the caller holds directly (wins over snapshot-derived values).
  source?: Partial<SlideMetadataSource>;
}

/** Create/refresh metadata.json for an extraction folder. */
export async function recordRecordedExtraction(input: RecordRecordedExtractionInput): Promise<void> {
  try {
    const source = normalizeSource(mergeSource(sourceFromSnapshot(input.session), input.source));
    const extraction: SlideExtractionMeta = {
      extractor: input.extractor,
      ssimThreshold: input.ssimThreshold,
      extractedAt: new Date().toISOString(),
      trigger: input.trigger,
    };
    // Deep-clone to strip Vue reactive proxies before the IPC hop: callers build
    // `source` from reactive `course.value`/`session.value`, and Electron's
    // structured clone throws a silent DataCloneError on a Proxy — the failure
    // that left built-in-extractor folders with no metadata.json. All fields are
    // JSON-safe, so a JSON round-trip yields a plain, cloneable object.
    const payload = JSON.parse(JSON.stringify({ source, extraction, kind: input.kind }));
    await window.electronAPI.slideMetadata.writeExtraction(input.folderPath, payload);
  } catch (error) {
    log.warn('Failed to record extraction metadata:', error);
  }
}

/** The SSIM threshold a folder was extracted with, or null when its metadata.json does not say. */
export async function readExtractionSsimThreshold(folderPath: string): Promise<number | null> {
  try {
    const meta = await window.electronAPI.slideMetadata.get(folderPath);
    const value = meta?.extraction?.ssimThreshold;
    return typeof value === 'number' && value > 0 ? value : null;
  } catch (error) {
    log.warn('Failed to read extraction metadata:', error);
    return null;
  }
}

/** Record the post-processing outcome for a folder (no-op if no metadata.json). */
export async function recordPostProcessing(folderPath: string, pp: SlidePostProcessingMeta): Promise<void> {
  try {
    await window.electronAPI.slideMetadata.updatePostProcessing(folderPath, pp);
  } catch (error) {
    log.warn('Failed to record post-processing metadata:', error);
  }
}

/** Mark a folder reviewed (no-op if it has no metadata.json). */
export async function markFolderReviewed(folderPath: string): Promise<void> {
  try {
    await window.electronAPI.slideMetadata.markReviewed(folderPath);
  } catch (error) {
    log.warn('Failed to mark folder reviewed:', error);
  }
}

/**
 * Latch any human edits staged for a folder (crop/delete/restore during the
 * current review session) to disk. No-op if nothing was staged or the folder
 * has no metadata.json. Returns the applied cropped state, if any.
 */
export async function commitFolderEdited(folderPath: string): Promise<{ cropped?: boolean } | null> {
  try {
    const response = await window.electronAPI.slideMetadata.commitEdited(folderPath);
    return response.result;
  } catch (error) {
    log.warn('Failed to commit folder edited state:', error);
    return null;
  }
}
