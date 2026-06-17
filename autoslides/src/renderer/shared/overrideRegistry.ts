// Generic runtime-override registry (production infra; demo-agnostic).
//
// Each slot is an optional hook. Production consumers read `overrides.x ?? real`,
// so with the registry empty (the default) every code path is the real one. An
// optional bootstrap — currently only demo mode (src/renderer/demo/bootstrap.ts)
// — may populate these slots. Deleting that bootstrap (and the demo/ folders)
// leaves this object empty, so the app runs entirely on real behavior.
//
// This module imports nothing demo-specific. Slot value types are kept minimal
// (structural) so `shared/` never depends on `features/`; consumers in the owning
// domain cast to their concrete types at the seam (as they did before).

import type { ApiTransport } from './services/apiClient'

export interface ResultImageItem {
  reason?: string
  name?: string
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

// Mirrors features/results ResultsDataIO structurally (kept loose so shared/ does
// not import features/). The Results View / PDF Maker consumers cast on read.
export interface ResultsDataProvider {
  getFolders(): Promise<Array<{ name: string; path: string; imageCount: number }>>
  getImages(folderPath: string): Promise<Array<{ name: string; path: string }>>
  getTrashEntries(): Promise<unknown[]>
  getCropEntries(): Promise<unknown[]>
}

export interface PlaybackDemo {
  poster(kind: 'screen' | 'camera'): string
  // Fabricated extracted slides for the screen-recording gallery. Loosely typed
  // (PlaybackPage casts to its Slide type); presence of this slot also tells the
  // video players to fabricate a dual-stream view and never load a real source.
  gallerySlides(): unknown[]
}

export interface RuntimeOverrides {
  /** Data source for ApiClient (collapses every per-method demo branch). */
  apiTransport?: ApiTransport
  /** Sentinel login token so the app appears signed in without a real one. */
  authToken?: () => string
  /** Backing reads for Results View + PDF Maker. */
  resultsProvider?: ResultsDataProvider
  /** Image source for a Results View item (thumbnail + crop editor). */
  resultImageSource?: (item: ResultImageItem) => string
  /** Seeded crop rectangle for the crop editor's first open. */
  cropDefaultRect?: () => CropRect
  /** Greeting line (avoids leaking a real name / rolling a random greeting). */
  greeting?: () => string
  /** Home page "Saved Courses" card lists. */
  savedSearches?: { live: () => string[]; recorded: () => string[] }
  /** Fake playback surfaces; presence disables real video loading. */
  playbackDemo?: PlaybackDemo
  /** When true, the download + task queues never start real network/extraction. */
  suppressRealWork?: boolean
}

export const overrides: RuntimeOverrides = {}
