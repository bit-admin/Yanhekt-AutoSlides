export type ResultsReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropEntry {
  filename: string
  originalPath: string
  originalParentFolder: string
  cropPath: string
  rect: CropRect
  croppedAt: string
  autoCropped?: boolean
}

export interface RemovedEntry {
  id: string
  filename: string
  originalPath: string
  originalParentFolder: string
  trashPath: string
  reason: ResultsReason
  reasonDetails?: string
  trashedAt: string
}

export interface ResultsFolder {
  name: string
  path?: string
  activeCount: number
  removedCount: number
}

export interface BaselineCrop {
  rect: CropRect
  sourceFilename: string
  sourceImagePath: string
}

export interface AutoCropActionSummary {
  cropped: number
  noDetection: number
  deduped: number
  failed: number
}

export interface BaselineCropActionSummary {
  cropped: number
  outOfBounds: number
  deduped: number
  failed: number
}

export interface DedupActionSummary {
  deduped: number
  failed: number
}

export interface ResultsItem {
  id: string
  name: string
  status: 'active' | 'removed'
  imagePath?: string
  trashPath?: string
  originalPath?: string
  reason?: ResultsReason
  reasonDetails?: string
  trashedAt?: string
  isCropped?: boolean
  isAutoCropped?: boolean
  cropPath?: string
  cropRect?: CropRect
  croppedAt?: string
}

export type ResultsViewMode = 'folders' | 'images'
export type ContextMode = 'context' | 'removed-only' | 'extracted-only'

export interface AutoCropTarget {
  id?: string
  originalPath: string
  filename: string
  needsRestore: boolean
}

export interface DedupCandidate {
  originalPath: string
  filename: string
}
