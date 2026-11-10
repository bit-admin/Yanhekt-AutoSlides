// Shared types for the post-processing pipeline.
// Ported from autoslides/src/renderer/shared/postProcessing/types.ts.
//
// Web changes: `TrashReason` comes from the slideStore's canonical union
// (which includes 'manual'), and the AI phase is single-image only — the
// classifier contract carries no batch endpoint and no batch-size config
// (desktop's multi-image dispatch, 413 split, and prompt-type plumbing are
// not ported).

import type { TrashReason } from '../slideStore';
import type { AIErrorKind } from '../ai/llmClient';

export type { TrashReason };
export type { AIErrorKind };

export type PostProcessingPhase =
  | 'idle'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type PostProcessingStatus = 'completed' | 'cancelled' | 'failed'

export interface ExclusionItem {
  name: string
  pHash: string
}

/**
 * The exclusion-list enablement rule: preset entries can be toggled off
 * (`isEnabled === false`), user-added entries are always active.
 */
export function filterEnabledExclusionItems<T extends { isPreset?: boolean; isEnabled?: boolean }>(
  list: T[],
): T[] {
  return list.filter((item) => !item.isPreset || item.isEnabled !== false)
}

/**
 * Pixel check a phase-1 pHash duplicate must also pass. pHash looks at a 64x64
 * thumbnail, so a progressive-reveal step (one more line of text) can land
 * within the Hamming threshold of the previous step. A match is trashed only
 * when the two images are also the same slide by the detector's SSIM test
 * (same threshold and downsampling). Ported from the Qt extractor 2.1.0.
 */
export interface DuplicateSSIMCheck {
  /** <= 0 turns the check off (pHash alone decides). */
  ssimThreshold: number
  enableDownsampling: boolean
  downsampleWidth: number
  downsampleHeight: number
}

/**
 * Build the phase-1 SSIM check from the extraction settings. `extractionThreshold`
 * is the threshold the folder was actually extracted with (metadata.json), which
 * differs from Settings for classroom-adaptive runs; it wins when known.
 */
export function duplicateSSIMCheckFrom(
  slideConfig: Partial<Omit<DuplicateSSIMCheck, 'ssimThreshold'>> & { ssimThreshold?: number } | null | undefined,
  extractionThreshold?: number | null,
): DuplicateSSIMCheck {
  return {
    ssimThreshold: extractionThreshold ?? slideConfig?.ssimThreshold ?? 0.9987,
    enableDownsampling: slideConfig?.enableDownsampling !== false,
    downsampleWidth: slideConfig?.downsampleWidth || 480,
    downsampleHeight: slideConfig?.downsampleHeight || 270,
  }
}

export interface PostProcessingConfig {
  pHashThreshold: number
  /** Absent = pHash alone decides phase 1. */
  duplicateSSIMCheck?: DuplicateSSIMCheck
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: ExclusionItem[]
  // Fit-inside target for images sent to the AI classifier.
  aiImageResizeWidth: number
  aiImageResizeHeight: number
}

export interface PostProcessingInput {
  outputPath: string          // IndexedDB folder name holding the images
  imageFiles: string[]        // filenames within the folder
  config: PostProcessingConfig
  promptType: 'live' | 'recorded'
  // Files that already carry a persisted AI verdict — phase 3 skips them so
  // re-runs only classify new slides (and never re-trash restored ones).
  phase3ExcludeFiles?: string[]
  // User login token, forwarded to the classifier (builtin service key).
  token?: string
}

// Adapter contract for reading images. The pipeline never touches storage
// directly — it goes through the data source (IndexedDB on the web).
export interface PipelineDataSource {
  // Returns null when the image can't be read (logged and counted as failed).
  readForPHash(filename: string): Promise<ImageData | null>
  // Raw base64 PNG for the LLM. Indexed (palette) PNGs are returned as-is;
  // otherwise fit-inside resized to the target box. Null on read failure.
  readForAI(filename: string, targetWidth: number, targetHeight: number): Promise<string | null>
  moveToTrash(filename: string, reason: TrashReason, reasonDetails: string): Promise<boolean>
}

export type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit'

export interface SingleClassificationResult {
  success: boolean
  result?: { classification: ClassificationValue }
  error?: string
  errorKind?: AIErrorKind
}

// Injected by the runner; implemented by lib/ai/aiFilteringClient.
export interface ClassifierCallbacks {
  classifySingleImage(base64Image: string, token?: string): Promise<SingleClassificationResult>
}

export interface PostProcessingFailure {
  filename: string
  errorType: string
  message: string
  retryCount: number
  errorKind?: AIErrorKind
}

export interface PhaseProgress {
  processed: number
  total: number
}

export interface PostProcessingProgress {
  phase: PostProcessingPhase
  phase1: PhaseProgress & { duplicatesRemoved: number; skipped: boolean }
  phase2: PhaseProgress & { excludedRemoved: number; skipped: boolean }
  phase3: PhaseProgress & {
    batchesCompleted: number
    batchesTotal: number
    aiFiltered: number
    aiFilteredEdit: number
    failed: number
    retrying: number
    skipped: boolean
  }
}

export interface PostProcessingResult {
  status: PostProcessingStatus
  duplicatesRemoved: string[]
  excludedRemoved: string[]
  aiNotSlide: string[]
  aiMaybeSlideEdit: string[]
  failed: PostProcessingFailure[]
}

export interface PostProcessingContext {
  signal?: AbortSignal
  onProgress?: (snap: PostProcessingProgress) => void
  // Called once per file as it lands in the trash. Used by callers that hold a
  // reactive in-memory mirror of the slide list (the playback page) so they can
  // splice the removed item out without re-reading storage.
  onItemRemoved?: (filename: string, reason: TrashReason) => void
  // Required when config.enableAIFiltering is set.
  classifier?: ClassifierCallbacks
  // Every AI verdict, including 'slide' — feeds the persisted exclude list.
  onItemClassified?: (filename: string, classification: ClassificationValue) => void
  // Optional in-place auto-crop for may_be_slide_edit. Returns true when crop applied.
  autoCrop?: (filename: string) => Promise<boolean>
  // After a successful auto-crop (file stays active).
  onItemCropped?: (filename: string) => void | Promise<void>
}

export interface SlideHashInfo {
  filename: string
  pHash: string
  error?: string
}
