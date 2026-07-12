// Ported from autoslides/src/shared/slideMetadataTypes.ts.
// Per-folder slide metadata. On the web this lives on the folder record in
// IndexedDB instead of a colocated `metadata.json`, but the shape is kept
// identical (version 1) so exports/telemetry stay compatible with desktop.
// Web extractions are always watch-mode (`trigger: 'watch'`).
// Change vs desktop: `aiClassifierMode` widened to `string | null` (the
// desktop AIClassifierMode union isn't ported; AI filtering is not available
// in the web version).

export const SLIDE_METADATA_VERSION = 1;

// The source medium of the folder's slides. 'live' is written only for
// live-stream watch-mode extractions; everything else is 'recorded'.
export type SlideMetadataKind = 'recorded' | 'live';

// Identifying context for a group of slides (a folder). All fields optional —
// filled best-effort from the Course/Session data available at the caller.
// Normalization (version 1): `courseId`/`sessionId`/`semester`/`schoolYear`
// are always strings and `weekNumber`/`day` are always numbers.
export interface SlideMetadataSource {
  courseId?: string;
  courseTitle?: string;
  sessionId?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  semester?: string;
  schoolYear?: string;
  college?: string;
  classrooms?: string[];
  weekNumber?: number;
  day?: number;
}

export interface SlideExtractionMeta {
  extractor: 'builtin' | 'qt';
  ssimThreshold?: number;
  extractedAt: string;
  // How the extraction was initiated. Absent (legacy files) is treated as 'auto'.
  //  'auto'  → unattended task-queue / qt-download; assumed complete.
  //  'watch' → produced while the user watched playback (live or recorded);
  //            completeness is unverifiable. All web extractions are 'watch'.
  trigger?: 'auto' | 'watch';
}

// Post-processing provenance: which phases ran, not how many slides each removed.
export interface SlidePostProcessingMeta {
  ran: boolean;
  duplicateRemoval: boolean;
  exclusionList: boolean;
  aiFiltering: boolean;
  aiClassifierMode: string | null;
  completedAt: string;
}

export interface SlideReviewMeta {
  // Set when a human opens the folder's image review and dwells (implicit).
  reviewed: boolean;
  reviewedAt: string | null;
  // One-way latch: a human mutated this folder (delete/restore) while reviewing.
  edited: boolean;
  editedAt: string | null;
  // Current state: any slide in this folder currently has an applied crop.
  // Always false on the web (cropping not available); kept for shape parity.
  cropped: boolean;
}

export interface SlideMetadata {
  version: number;
  kind: SlideMetadataKind;
  source: SlideMetadataSource;
  extraction: SlideExtractionMeta;
  postProcessing?: SlidePostProcessingMeta;
  review: SlideReviewMeta;
  createdAt: string;
  updatedAt: string;
}

// Single source of truth for watch-mode detection (parity with desktop).
export function isWatchExtraction(meta: SlideMetadata | null | undefined): boolean {
  return meta?.extraction?.trigger === 'watch';
}
