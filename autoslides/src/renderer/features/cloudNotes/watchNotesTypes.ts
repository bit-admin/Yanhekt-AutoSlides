import type { OutputData } from '@editorjs/editorjs'
import type { LectureIdentity } from '@common/lectureNaming'
import type { ObsidianErrorCode, ObsidianTargetInfo } from '@common/obsidianNotesTypes'
import type { NotionErrorCode, NotionTargetInfo } from '@common/notionNotesTypes'

/**
 * `awaiting` is for external providers: the lecture has no target yet (Obsidian
 * auto-create off or failed; Notion always, until a page is picked) and kept
 * slides wait until the student picks one.
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
export type WatchQueueStatus = 'queued' | 'appending' | 'appended'

/** One kept slide in an external provider's queue, as the panel lists it. */
export interface WatchQueueItem {
  id: number
  /** 1-based capture order within this entry. */
  index: number
  pngFilename: string
  status: WatchQueueStatus
  /** Small JPEG data URL, or null until (or if) it could be made. */
  thumb: string | null
  queuedAt: number
}

/**
 * Providers that only receive slide images (Obsidian, Notion). Kept slides go
 * through the shared visible queue in externalQueueSink.
 */
interface ExternalWatchNoteEntryBase extends WatchNoteEntryBase {
  /** Kept slides in capture order: waiting, being written, or already in the note. */
  items: WatchQueueItem[]
  /** Student paused appending (or a write failed); queued slides wait until resumed. */
  paused: boolean
}

export interface ObsidianWatchNoteEntry extends ExternalWatchNoteEntryBase {
  provider: 'obsidian'
  target: ObsidianTargetInfo | null
  /** Last failure (auto-create, append), shown in the panel; cleared on success. */
  lastError: ObsidianErrorCode | null
}

export interface NotionWatchNoteEntry extends ExternalWatchNoteEntryBase {
  provider: 'notion'
  /** The page picked in the Notes tab for this lecture (pick mode only). */
  target: NotionTargetInfo | null
  lastError: NotionErrorCode | null
}

export type ExternalWatchNoteEntry = ObsidianWatchNoteEntry | NotionWatchNoteEntry

export type WatchNoteEntry = YanhektWatchNoteEntry | ExternalWatchNoteEntry

export interface KeptSlide {
  /** `Slide_*.png`. */
  pngFilename: string
  dataUrl: string
}

/**
 * One provider's write side. The slide stream (watchNotesStore) owns
 * post-processing gating and hands over kept slides in capture order; the sink
 * writes them in that order (external providers may hold them in a queue first).
 */
export interface WatchNotesSink<E extends WatchNoteEntry> {
  /** Resolve the lecture's target (may leave an external entry `awaiting`). */
  open(entry: E): Promise<void>
  /** Take kept slides, in capture order. */
  deliver(entry: E, slides: KeptSlide[]): void
  /** The gallery was cleared: forget slides not yet written. */
  discardQueued(entry: E): void
  /** The tab closed: release timers/targets. The note itself is left intact. */
  dispose(tabId: string): void
}
