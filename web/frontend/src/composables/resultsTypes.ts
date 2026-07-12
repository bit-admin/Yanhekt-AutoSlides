// Slides-page view models.
// Ported from autoslides/src/renderer/features/results/resultsTypes.ts with
// all crop-related types dropped (cropping is not available on the web).
// `RemovedEntry` is the slideStore's TrashEntry — identical shape to the
// desktop trash-manifest entry.

import type { TrashEntry, TrashReason } from '../lib/slideStore'
import type { SlideMetadata } from '../lib/slideMetadataTypes'

export type { TrashReason }
export type { SlideMetadata }
// Historic alias preserved from the desktop call sites.
export type ResultsReason = TrashReason
export type RemovedEntry = TrashEntry

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
}

export type ResultsViewMode = 'folders' | 'images'
export type ContextMode = 'context' | 'removed-only' | 'extracted-only'
