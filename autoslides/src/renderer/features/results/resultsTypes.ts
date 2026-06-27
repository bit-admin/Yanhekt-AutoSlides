// Renderer-side Results View view models. Canonical crop/trash types come from
// @common/types; renderer-only types (ResultsFolder, ResultsItem, etc.) stay here.

import type { CropRect, CropEntry, TrashReason } from '@common/types'
import type { SlideMetadata } from '@common/slideMetadataTypes'

export type { CropRect, CropEntry, TrashReason }
export type { SlideMetadata }
// Historic alias preserved for renderer call sites.
export type ResultsReason = TrashReason

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
  // Per-folder metadata (recorded extractions only); null/undefined = none.
  metadata?: SlideMetadata | null
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
