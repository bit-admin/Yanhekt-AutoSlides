// Shared types for the unified post-processing pipeline.
//
// The pipeline runs the same three-phase workflow (duplicate-pHash, exclusion-pHash,
// AI classification) across three call sites: task-queue jobs, the playback-page
// manual trigger, and the offline-processing tab. The types here define the input
// shape, progress callbacks, and result envelope every adapter consumes.

export type TrashReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit'

export type AIErrorKind =
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'quota_exceeded'
  | 'auth_failed'
  | 'cloudflare_blocked'
  | 'timeout'
  | 'network'
  | 'service_unavailable'
  | 'server_error'
  | 'bad_request'
  | 'parse_failed'
  | 'unknown'

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

export interface PostProcessingConfig {
  pHashThreshold: number
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: ExclusionItem[]
  aiBatchSize: number
  aiImageResizeWidth: number
  aiImageResizeHeight: number
  // Live mode uses the single-image AI endpoint even for batches of 1 because the
  // 'live' prompt variant is shaped to return `{ classification: ... }` rather than
  // the batch `{ image_0: ... }` map. Defaults to false everywhere except the live
  // playback flow.
  useSingleImageApi?: boolean
}

export interface PostProcessingInput {
  outputPath: string          // disk directory holding the images and the trash subfolder
  imageFiles: string[]         // filenames within outputPath
  config: PostProcessingConfig
  promptType: 'live' | 'recorded'
  token?: string
}

// Adapter contract for reading images. A and B point at the `slideExtraction` IPC
// namespace; C points at the `offline` namespace. The pipeline never calls IPC
// directly — it goes through the data source so the file-source vs offline-source
// branch is the adapter's concern, not the pipeline's.
export interface PipelineDataSource {
  // Returns null when the file can't be read (logged and counted as failed).
  readForPHash(filename: string): Promise<ImageData | null>
  readForAI(
    filename: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<string | null>
  moveToTrash(filename: string, reason: TrashReason, reasonDetails: string): Promise<boolean>
}

export interface PostProcessingFailure {
  filename: string
  errorType: string
  errorKind?: AIErrorKind
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
  // splice the removed item out without re-reading disk.
  onItemRemoved?: (filename: string, reason: TrashReason) => void
  // Called once per file with its AI verdict (including 'slide'). Used by the
  // playback page to set each slide's `aiDecision` field for the UI.
  onItemClassified?: (filename: string, classification: 'slide' | 'not_slide' | 'may_be_slide_edit') => void
}

export interface SlideHashInfo {
  filename: string
  pHash: string
  error?: string
}
