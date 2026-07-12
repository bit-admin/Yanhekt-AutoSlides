// Shared types for the post-processing pipeline.
// Ported from autoslides/src/renderer/shared/postProcessing/types.ts.
//
// Web changes: all AI/classifier machinery is dropped (AI filtering is not
// available in the web version — phase 3 never runs), `TrashReason` comes from
// the slideStore's canonical union (which includes 'manual'), and the data
// source loses `readForAI`. The progress/result envelopes keep their phase-3
// fields for shape parity with desktop consumers.

import type { TrashReason } from '../slideStore';

export type { TrashReason };

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

export interface PostProcessingConfig {
  pHashThreshold: number
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: ExclusionItem[]
}

export interface PostProcessingInput {
  outputPath: string          // IndexedDB folder name holding the images
  imageFiles: string[]        // filenames within the folder
  config: PostProcessingConfig
  promptType: 'live' | 'recorded'
}

// Adapter contract for reading images. The pipeline never touches storage
// directly — it goes through the data source (IndexedDB on the web).
export interface PipelineDataSource {
  // Returns null when the image can't be read (logged and counted as failed).
  readForPHash(filename: string): Promise<ImageData | null>
  moveToTrash(filename: string, reason: TrashReason, reasonDetails: string): Promise<boolean>
}

export interface PostProcessingFailure {
  filename: string
  errorType: string
  message: string
  retryCount: number
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
}

export interface SlideHashInfo {
  filename: string
  pHash: string
  error?: string
}
