import type { OutputData } from '@editorjs/editorjs'
import type { LectureIdentity } from '@common/lectureNaming'
import type { ObsidianErrorCode, ObsidianTargetInfo } from '@common/obsidianNotesTypes'

/**
 * `awaiting` is Obsidian-only: the lecture has no target note yet (auto-create
 * off, or it failed) and kept slides wait until the student picks one.
 */
export type WatchNoteStatus = 'awaiting' | 'creating' | 'ready' | 'error'

interface WatchNoteEntryBase {
  tabId: string
  /** Extraction pipeline instance whose `slideExtracted` events feed this note. */
  instanceId: string
  displayName: string
  identity: LectureIdentity
  /** `slides_…__c…s…` — names the per-lecture image folder for file providers. */
  slidesFolderName: string
  status: WatchNoteStatus
}

export interface YanhektWatchNoteEntry extends WatchNoteEntryBase {
  provider: 'yanhekt'
  noteId: number | null
  /** Working copy of the note's Editor.js document (source of truth for background tabs). */
  content: OutputData
}

/** `appending` is the one item currently being written. */
export type ObsidianQueueStatus = 'queued' | 'appending' | 'appended'

/** One kept slide in an Obsidian entry's queue, as the panel lists it. */
export interface ObsidianQueueItem {
  id: number
  /** 1-based capture order within this entry. */
  index: number
  pngFilename: string
  status: ObsidianQueueStatus
  /** Small JPEG data URL, or null until (or if) it could be made. */
  thumb: string | null
  queuedAt: number
}

export interface ObsidianWatchNoteEntry extends WatchNoteEntryBase {
  provider: 'obsidian'
  target: ObsidianTargetInfo | null
  /** Kept slides in capture order: waiting, being written, or already in the note. */
  items: ObsidianQueueItem[]
  /** Student paused appending (or a write failed); queued slides wait until resumed. */
  paused: boolean
  /** Last failure (auto-create, append), shown in the panel; cleared on success. */
  lastError: ObsidianErrorCode | null
}

export type WatchNoteEntry = YanhektWatchNoteEntry | ObsidianWatchNoteEntry

export interface KeptSlide {
  /** `Slide_*.png`. */
  pngFilename: string
  dataUrl: string
}

/**
 * One provider's write side. The slide stream (watchNotesStore) owns
 * post-processing gating and hands over kept slides in capture order; the sink
 * writes them in that order (Obsidian may hold them in its queue first).
 */
export interface WatchNotesSink<E extends WatchNoteEntry> {
  /** Resolve the lecture's target (may leave an Obsidian entry `awaiting`). */
  open(entry: E): Promise<void>
  /** Take kept slides, in capture order. */
  deliver(entry: E, slides: KeptSlide[]): void
  /** The gallery was cleared: forget slides not yet written. */
  discardQueued(entry: E): void
  /** The tab closed: release timers/targets. The note itself is left intact. */
  dispose(tabId: string): void
}
