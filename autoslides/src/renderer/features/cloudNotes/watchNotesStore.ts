import { reactive, computed, watch } from 'vue'
import type { OutputData } from '@editorjs/editorjs'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { rightPanelStore, setRightPanelTab } from '@shared/services/rightPanelStore'
import { createLogger } from '@shared/utils/logger'
import { buildSlideFolderName, SLIDE_FOLDER_PREFIX, type LectureIdentity } from '@common/lectureNaming'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { tabStore } from '@features/course/tabStore'
import { cloudStorageStore } from './cloudStorageStore'
import {
  yanhektWatchSink,
  emptyDoc,
  registerActiveEditor,
  unregisterActiveEditor,
  commitEditorContent as commitYanhektContent,
} from './yanhektWatchSink'
import { obsidianWatchSink, createLectureNote, chooseNote, setPaused } from './obsidianWatchSink'
import type {
  KeptSlide,
  ObsidianWatchNoteEntry,
  WatchNoteEntry,
  WatchNotesSink,
  YanhektWatchNoteEntry,
} from './watchNotesTypes'

// Watch notes: the provider-neutral slide stream. A manual watch tab that starts
// extraction gets an entry; captured slides wait here until post-processing
// keeps them, then go to the entry's provider sink in capture order.
//   Yanhekt  → yanhektWatchSink (ASuser note + live editor)
//   Obsidian → obsidianWatchSink (visible queue → images appended to a Markdown note)

const log = createLogger('WatchNotes')

const state = reactive<{ entries: Record<string, WatchNoteEntry> }>({ entries: {} })

// Slides captured while watch-mode auto post-processing is on are held here
// (per tabId, `Slide_*.png` filename → dataUrl, insertion order = capture order)
// until a completed pass reports them kept; trashed ones never reach the note.
// Kept outside the reactive state on purpose — nothing renders from it.
const pendingSlides = new Map<string, Map<string, string>>()

function sinkFor(entry: WatchNoteEntry): WatchNotesSink<WatchNoteEntry> {
  return (entry.provider === 'obsidian' ? obsidianWatchSink : yanhektWatchSink) as WatchNotesSink<WatchNoteEntry>
}

function getPending(tabId: string): Map<string, string> {
  let pending = pendingSlides.get(tabId)
  if (!pending) {
    pending = new Map()
    pendingSlides.set(tabId, pending)
  }
  return pending
}

function findEntryByInstance(instanceId: string): WatchNoteEntry | undefined {
  return Object.values(state.entries).find((e) => e.instanceId === instanceId)
}

/** Hand kept slides to the entry's sink, in capture order. */
function deliver(entry: WatchNoteEntry, slides: KeptSlide[]): void {
  if (slides.length > 0) sinkFor(entry).deliver(entry, slides)
}

/**
 * Name for the note, derived from the same builder that names the extraction
 * folder, then stripped for display: the `slides_` prefix and the id block
 * removed from an underscore-joined, sanitized "<course>_<session>" — e.g.
 * "泛函分析_第1周_星期三_第2大节". `sanitizeFileName` turns the session title's
 * spaces into underscores, mirroring the folder on disk.
 *
 * This used to re-implement the folder template by hand and had already drifted
 * (it applied the `section_group_title` fallback in recorded mode too, where
 * the folder builder gates it on live). Going through the shared builder keeps
 * note and folder in lockstep by construction.
 */
function deriveNoteNaming(tabId: string): {
  displayName: string
  identity: LectureIdentity
  slidesFolderName: string
} {
  const tab = tabStore.state.tabs.find((t) => t.id === tabId)
  if (!tab) return { displayName: 'AutoSlides', identity: {}, slidesFolderName: `${SLIDE_FOLDER_PREFIX}AutoSlides` }
  const session = tab.session as { title?: string; session_id?: string | number } | null
  // Live: `course.id` is a broadcast id and `course.courseId` the real course —
  // same split as useSlideExtraction, so the note title matches the folder.
  const isLive = tab.mode === 'live'
  const identity: LectureIdentity = isLive
    ? { courseId: tab.course?.courseId, liveId: tab.course?.id }
    : { courseId: tab.course?.id, sessionId: session?.session_id }
  const folderName = buildSlideFolderName(
    {
      courseTitle: tab.course?.title,
      sessionTitle: session?.title,
      sectionGroupTitle: isLive ? tab.course?.session?.section_group_title : undefined,
    },
    identity,
  )
  const name = formatToolFolderName(folderName)
  return {
    displayName: name && name !== 'slides' ? name : tab.title || 'AutoSlides',
    identity,
    // A lecture with neither titles nor ids yields bare `slides`; file providers
    // need a `slides_…` name.
    slidesFolderName: folderName.startsWith(SLIDE_FOLDER_PREFIX) ? folderName : `${SLIDE_FOLDER_PREFIX}AutoSlides`,
  }
}

/**
 * Whether the watch-notes auto flow may run right now: Settings → Add-ons →
 * Watch Notes is on, and the chosen provider can take notes (Yanhekt needs the
 * ASuser group; Obsidian always can, since a note may be chosen per lecture).
 */
export function watchSyncActive(): boolean {
  if (!configStore.watchNotesEnabled) return false
  if (configStore.watchNotesProvider === 'obsidian') return true
  return cloudStorageStore.canUse.value && cloudStorageStore.userGroupId.value != null
}

function newEntry(tabId: string, instanceId: string): WatchNoteEntry {
  const { displayName, identity, slidesFolderName } = deriveNoteNaming(tabId)
  const base = { tabId, instanceId, displayName, identity, slidesFolderName }
  if (configStore.watchNotesProvider === 'obsidian') {
    return { ...base, provider: 'obsidian', status: 'awaiting', target: null, items: [], paused: false, lastError: null }
  }
  return { ...base, provider: 'yanhekt', status: 'creating', noteId: null, content: emptyDoc() }
}

/**
 * Called by PlaybackPage the moment slide extraction actually starts. Creates (or
 * reuses) this tab's watch note and switches the right panel to the Notes tab.
 * No-op unless the tab is a manual watch tab and watch notes are enabled.
 */
export async function onExtractionStarted(tabId: string, instanceId: string): Promise<void> {
  const tab = tabStore.state.tabs.find((t) => t.id === tabId)
  if (!tab || tab.origin !== 'manual') return
  if (!watchSyncActive()) return

  const existing = state.entries[tabId]
  if (existing) {
    // New extraction run on the same tab: stale un-cleared slides from the
    // previous run will never get a pass event — drop them.
    if (existing.instanceId !== instanceId) pendingSlides.delete(tabId)
    existing.instanceId = instanceId
    return
  }

  state.entries[tabId] = newEntry(tabId, instanceId)
  // Mutate through the reactive proxy, not the raw object — writes to the raw
  // target bypass the proxy's set trap and the panel never sees the status flip.
  const stored = state.entries[tabId]

  // Reveal the Notes tab immediately; the note fills in when opening resolves.
  layoutStore.rightCollapsed = false
  setRightPanelTab('notes')

  await sinkFor(stored).open(stored)
}

function onSlideExtracted(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { slide, instanceId } = event.detail ?? {}
  if (!slide?.dataUrl || typeof instanceId !== 'string') return
  const entry = findEntryByInstance(instanceId)
  if (!entry || entry.status === 'error') return
  const pngFilename = `${String(slide.title ?? `Slide_${Date.now()}`)}.png`
  // With watch-mode auto post-processing on, hold the slide until a completed
  // pass clears it (same `!== false` default-true predicate as the PlaybackPage
  // trigger gate). Toggle off ⇒ deliver immediately, as before.
  if (configStore.autoPostProcessingLive !== false) {
    getPending(entry.tabId).set(pngFilename, slide.dataUrl)
    return
  }
  deliver(entry, [{ pngFilename, dataUrl: slide.dataUrl }])
}

/** Release buffered slides a completed post-processing pass kept; drop trashed ones. */
function onSlidesPostProcessed(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { instanceId, kept, removed } = event.detail ?? {}
  if (typeof instanceId !== 'string') return
  const entry = findEntryByInstance(instanceId)
  if (!entry) return
  const pending = pendingSlides.get(entry.tabId)
  if (!pending || pending.size === 0) return

  if (Array.isArray(removed)) {
    for (const filename of removed) pending.delete(String(filename))
  }
  if (!Array.isArray(kept)) return
  // `kept` arrives in extraction order; take only slides still awaiting clearance.
  const cleared: KeptSlide[] = []
  for (const filename of kept) {
    const pngFilename = String(filename)
    const dataUrl = pending.get(pngFilename)
    if (dataUrl !== undefined) {
      pending.delete(pngFilename)
      cleared.push({ pngFilename, dataUrl })
    }
  }
  deliver(entry, cleared)
}

/**
 * Replace a still-pending slide's dataUrl after post-processing auto-crop
 * succeeds, so the note gets cropped pixels. Dispatched as `slideAutoCropped`
 * from usePostProcessing (avoids download→cloudNotes import).
 */
function onSlideAutoCropped(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { instanceId, filename, dataUrl } = event.detail ?? {}
  if (typeof instanceId !== 'string' || typeof filename !== 'string' || typeof dataUrl !== 'string') {
    return
  }
  const entry = findEntryByInstance(instanceId)
  if (!entry) return
  const pending = pendingSlides.get(entry.tabId)
  if (!pending?.has(filename)) return
  pending.set(filename, dataUrl)
}

/** A cleared gallery means those captures are gone — nothing left to release. */
function onSlidesClearedEvent(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { instanceId } = event.detail ?? {}
  if (typeof instanceId !== 'string') return
  const entry = findEntryByInstance(instanceId)
  if (!entry) return
  pendingSlides.delete(entry.tabId)
  sinkFor(entry).discardQueued(entry)
}

/**
 * Called by PlaybackPage when extraction stops (after any in-flight pass has
 * finished flushing). Remaining buffered slides never got a completed pass —
 * drop them rather than send unverified captures. Kept slides in an Obsidian
 * queue stay: they are verified, visible, and wait for a note or Resume.
 */
export function onExtractionStopped(tabId: string): void {
  const pending = pendingSlides.get(tabId)
  if (pending && pending.size > 0) {
    log.debug(`dropping ${pending.size} un-cleared slide(s) for stopped tab ${tabId}`)
  }
  pendingSlides.delete(tabId)
}

// ── Panel-facing API ────────────────────────────────────────────────────────

/** The note entry for the currently-active playback tab (drives the panel view). */
export const activeEntry = computed<WatchNoteEntry | null>(() => {
  const id = tabStore.state.activeTabId
  return id ? state.entries[id] ?? null : null
})

/** Whether the right panel should offer the Notes tab (watch notes on + a playback tab). */
export const notesTabAvailable = computed<boolean>(
  () => watchSyncActive() && tabStore.state.activeTabId != null,
)

/** Sync a Yanhekt entry's working content back from the live editor. */
export function commitEditorContent(tabId: string, content: OutputData): void {
  const entry = state.entries[tabId]
  if (entry?.provider === 'yanhekt') commitYanhektContent(entry, content)
}

function obsidianEntry(tabId: string): ObsidianWatchNoteEntry | null {
  const entry = state.entries[tabId]
  return entry?.provider === 'obsidian' ? entry : null
}

/** Notes tab → Create Lecture Note (configured vault). */
export async function createObsidianNote(tabId: string): Promise<void> {
  const entry = obsidianEntry(tabId)
  if (entry) await createLectureNote(entry)
}

/** Notes tab → Choose Note…: any `.md`, this lecture only. */
export async function chooseObsidianNote(tabId: string): Promise<void> {
  const entry = obsidianEntry(tabId)
  if (entry) await chooseNote(entry)
}

/** Notes tab footer → Pause / Resume appending. */
export function setObsidianPaused(tabId: string, paused: boolean): void {
  const entry = obsidianEntry(tabId)
  if (entry) setPaused(entry, paused)
}

// Prune entries whose tab was closed (leave the note itself intact).
watch(
  () => tabStore.state.tabs.map((t) => t.id).join(','),
  () => {
    const live = new Set(tabStore.state.tabs.map((t) => t.id))
    for (const [id, entry] of Object.entries(state.entries)) {
      if (!live.has(id)) {
        sinkFor(entry).dispose(id)
        pendingSlides.delete(id)
        delete state.entries[id]
      }
    }
  },
)

// When watch notes are turned off or the provider can't take notes, fall back off Notes.
watch(
  () => notesTabAvailable.value,
  (available) => {
    if (!available && rightPanelStore.currentTab === 'notes') setRightPanelTab('task')
  },
)

// Module-level subscriptions: the pipeline's per-slide event, the playback
// page's per-pass post-processing outcome, gallery clears, and auto-crop
// success refreshes for still-pending slides.
window.addEventListener('slideExtracted', onSlideExtracted)
window.addEventListener('slidesPostProcessed', onSlidesPostProcessed)
window.addEventListener('slidesCleared', onSlidesClearedEvent)
window.addEventListener('slideAutoCropped', onSlideAutoCropped)

/**
 * Inject a ready Yanhekt watch-note entry without going through extraction.
 * Used by demo mode (and tests) so the Notes tab can render offline.
 */
export function seedWatchNoteEntry(entry: {
  tabId: string
  instanceId?: string
  noteId?: number | null
  displayName: string
  content: OutputData
}): void {
  const seeded: YanhektWatchNoteEntry = {
    tabId: entry.tabId,
    instanceId: entry.instanceId ?? 'seeded',
    provider: 'yanhekt',
    noteId: entry.noteId ?? null,
    displayName: entry.displayName,
    identity: {},
    slidesFolderName: `${SLIDE_FOLDER_PREFIX}AutoSlides`,
    status: 'ready',
    content: entry.content,
  }
  state.entries[entry.tabId] = seeded
}

export const watchNotesStore = {
  onExtractionStarted,
  onExtractionStopped,
  activeEntry,
  notesTabAvailable,
  registerActiveEditor,
  unregisterActiveEditor,
  commitEditorContent,
  createObsidianNote,
  chooseObsidianNote,
  setObsidianPaused,
  watchSyncActive,
  seedWatchNoteEntry,
}
