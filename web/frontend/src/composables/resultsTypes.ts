// Slides-page view models.
// Ported from autoslides/src/renderer/features/results/resultsTypes.ts.
// Crop fields are hydrated from slideStore (IndexedDB) rather than a
// filesystem crop-manifest join.

import type { TrashEntry, TrashReason } from '../lib/slideStore'
import type { SlideMetadata } from '../lib/slideMetadataTypes'

export type { TrashReason }
export type { SlideMetadata }
// Historic alias preserved from the desktop call sites.
export type ResultsReason = TrashReason
export type RemovedEntry = TrashEntry

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** In-memory baseline: one slide's crop rect reused on other slides. */
export interface BaselineCrop {
  rect: CropRect
  sourceFilename: string
  /** slideStore id (`folder/filename`) of the source slide. */
  sourceId: string
}

export interface BaselineCropActionSummary {
  cropped: number
  outOfBounds: number
  failed: number
}

/** Summary for batch / single Canny auto-crop (no post-crop dedup this phase). */
export interface AutoCropActionSummary {
  cropped: number
  noDetection: number
  failed: number
}

export interface ResultsFolder {
  name: string
  path?: string
  activeCount: number
  removedCount: number
  // Per-folder metadata; null/undefined = none.
  metadata?: SlideMetadata | null
  coverImageId?: string
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
  // Crop state (active slides only; from slideStore).
  isCropped?: boolean
  isAutoCropped?: boolean
  cropRect?: CropRect
  croppedAt?: string
}

export type ResultsViewMode = 'folders' | 'images'
export type ContextMode = 'context' | 'removed-only' | 'extracted-only'
