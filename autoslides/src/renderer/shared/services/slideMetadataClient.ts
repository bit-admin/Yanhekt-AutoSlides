// Renderer-side helper for writing per-folder slide metadata. Lives in
// shared/services so both PostProcessingService and feature composables may
// import it (shared/ may not import features/). All calls are best-effort —
// metadata recording must never break extraction or review flows.
import { DataStore } from './dataStore';
import { createLogger } from '@shared/utils/logger';
import type {
  SlideMetadataSource,
  SlideExtractionMeta,
  SlidePostProcessingMeta,
} from '@common/slideMetadataTypes';

const log = createLogger('SlideMetadataClient');

// Build identifying context from the volatile session store (keyed by sessionId).
// Returns an empty object when the session isn't cached — callers can still pass
// an explicit `source` override for the fields they hold directly.
function sourceFromDataStore(sessionId?: string): SlideMetadataSource {
  if (!sessionId) return {};
  const data = DataStore.getSessionData(sessionId);
  if (!data) return {};
  const ci = data.courseInfo;
  return {
    courseId: ci?.id,
    courseTitle: ci?.title,
    sessionId: data.session_id != null ? String(data.session_id) : sessionId,
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
    sessionId: toStringId(source.sessionId),
    semester: toStringId(source.semester),
    schoolYear: toStringId(source.schoolYear),
    weekNumber: toNumber(source.weekNumber),
    day: toNumber(source.day),
  };
}

// Overlay only defined keys so an explicit partial never blanks a DataStore value.
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
  // Used to enrich `source` from the cached session data.
  sessionId?: string;
  // Fields the caller holds directly (wins over DataStore-derived values).
  source?: Partial<SlideMetadataSource>;
}

/** Create/refresh metadata.json for a recorded extraction folder. */
export async function recordRecordedExtraction(input: RecordRecordedExtractionInput): Promise<void> {
  try {
    const source = normalizeSource(mergeSource(sourceFromDataStore(input.sessionId), input.source));
    const extraction: SlideExtractionMeta = {
      extractor: input.extractor,
      ssimThreshold: input.ssimThreshold,
      extractedAt: new Date().toISOString(),
    };
    await window.electronAPI.slideMetadata.writeExtraction(input.folderPath, { source, extraction });
  } catch (error) {
    log.warn('Failed to record extraction metadata:', error);
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
