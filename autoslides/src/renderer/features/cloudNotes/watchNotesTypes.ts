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

export interface ObsidianWatchNoteEntry extends WatchNoteEntryBase {
  provider: 'obsidian'
  target: ObsidianTargetInfo | null
  /** Slides appended to the note this session. */
  appended: number
  /** Kept slides waiting for a target note. */
  waiting: number
  /** Last failure (auto-create, append), shown in the panel; cleared on success. */
  lastError: ObsidianErrorCode | null
}

export type WatchNoteEntry = YanhektWatchNoteEntry | ObsidianWatchNoteEntry

/**
 * One provider's write side. The slide stream (watchNotesStore) owns buffering,
 * post-processing gating and ordering; a sink only opens a target and appends.
 */
export interface WatchNotesSink<E extends WatchNoteEntry> {
  /** Resolve the lecture's target (may leave an Obsidian entry `awaiting`). */
  open(entry: E): Promise<void>
  /** Append one kept slide. `pngFilename` includes `.png`. */
  append(entry: E, dataUrl: string, pngFilename: string): Promise<void>
  /** The tab closed: release timers/targets. The note itself is left intact. */
  dispose(tabId: string): void
}
