import { reactive, computed, watch } from 'vue'
import type { OutputData } from '@editorjs/editorjs'
import { overrides } from '@shared/overrideRegistry'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { rightPanelStore, setRightPanelTab } from '@shared/services/rightPanelStore'
import { createLogger } from '@shared/utils/logger'
import { buildManagedNoteTitle, EDITORJS_DOC_VERSION } from '@common/notesTypes'
import { sanitizeFileName } from '@common/sanitizeFileName'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { tabStore } from '@features/course/tabStore'
import { cloudStorageStore } from './cloudStorageStore'
import { notesRefreshStore } from './noteOpenRequest'

const log = createLogger('WatchNotes')

/** Page size / cap mirroring cloudStorageStore's full-set paging. */
const FETCH_PAGE_SIZE = 500
const MAX_FETCH_PAGES = 20
const SAVE_DEBOUNCE_MS = 1000

type EntryStatus = 'creating' | 'ready' | 'error'

interface WatchNoteEntry {
  tabId: string
  /** Extraction pipeline instance whose `slideExtracted` events feed this note. */
  instanceId: string
  noteId: number | null
  displayName: string
  status: EntryStatus
  /** Working copy of the note's Editor.js document (source of truth for background tabs). */
  content: OutputData
}

/**
 * Live editor bound to the *active* tab's note, registered by WatchNotesPanel.
 * When present, slide appends for the active tab go through it (so an in-progress
 * user edit isn't clobbered by an external content overwrite); background tabs
 * append via the API instead.
 */
interface ActiveEditorBinding {
  tabId: string
  /** Insert an image block at the end of the live editor. */
  insertImage: (url: string) => void
}

const state = reactive<{ entries: Record<string, WatchNoteEntry> }>({ entries: {} })
let activeEditor: ActiveEditorBinding | null = null
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Slides captured while watch-mode auto post-processing is on are held here
// (per tabId, `Slide_*.png` filename → dataUrl, insertion order = capture order)
// until a completed pass reports them kept; trashed ones never reach the note.
// Kept outside the reactive state on purpose — nothing renders from it.
const pendingSlides = new Map<string, Map<string, string>>()
// Per-tab promise chain serializing note appends so overlapping pass events
// can't interleave image blocks out of order.
const flushChains = new Map<string, Promise<void>>()

function getPending(tabId: string): Map<string, string> {
  let pending = pendingSlides.get(tabId)
  if (!pending) {
    pending = new Map()
    pendingSlides.set(tabId, pending)
  }
  return pending
}

function chainFlush(tabId: string, task: () => Promise<void>): void {
  const prev = flushChains.get(tabId) ?? Promise.resolve()
  flushChains.set(
    tabId,
    prev.then(task).catch((err) => log.warn('watch note flush failed', err)),
  )
}

function findEntryByInstance(instanceId: string): WatchNoteEntry | undefined {
  return Object.values(state.entries).find((e) => e.instanceId === instanceId)
}

function api(): CloudNotesProvider {
  return overrides.cloudNotesProvider ?? window.electronAPI.cloudNotes
}

function emptyDoc(): OutputData {
  return { time: Date.now(), blocks: [], version: EDITORJS_DOC_VERSION } as OutputData
}

function imageBlock(url: string) {
  return {
    type: 'image',
    data: { file: { url }, caption: '', withBorder: false, stretched: false, withBackground: false },
  }
}

/**
 * Name for the note, matching the extraction folder name that
 * `useSlideExtraction.buildExtractionInput` produces (and therefore reading
 * exactly like an ASnote title): the `slides_` prefix stripped from an
 * underscore-joined, sanitized "<course>_<session>" — e.g.
 * "泛函分析_第1周_星期三_第2大节". `sanitizeFileName` turns the session title's
 * spaces into underscores, mirroring the folder on disk.
 */
function deriveDisplayName(tabId: string): string {
  const tab = tabStore.state.tabs.find((t) => t.id === tabId)
  if (!tab) return 'AutoSlides'
  let folderName = 'slides'
  if (tab.course?.title) folderName += `_${sanitizeFileName(tab.course.title)}`
  const session = tab.session as { title?: string } | null
  const sectionTitle = tab.course?.session?.section_group_title
  if (session?.title) folderName += `_${sanitizeFileName(session.title)}`
  else if (sectionTitle) folderName += `_${sanitizeFileName(sectionTitle)}`
  const name = formatToolFolderName(folderName)
  return name && name !== 'slides' ? name : tab.title || 'AutoSlides'
}

/** Whether the watch-notes auto flow may run right now (gated by the Sync setting). */
export function watchSyncActive(): boolean {
  return (
    !!configStore.cloudWatchSyncEnabled &&
    cloudStorageStore.canUse.value &&
    cloudStorageStore.userGroupId.value != null
  )
}

/** Find an existing ASuser watch note by title, else create one. */
async function findOrCreateNote(
  displayName: string,
): Promise<{ id: number; content: OutputData; created: boolean } | null> {
  const groupId = cloudStorageStore.userGroupId.value
  if (groupId == null) return null
  const title = buildManagedNoteTitle(displayName)

  // Scan the full note list for an existing managed note with this title in ASuser.
  let page = 1
  let lastPage = 1
  let existingId: number | null = null
  do {
    const res = await api().list({ page, pageSize: FETCH_PAGE_SIZE })
    if (!res.ok) {
      log.warn('note list failed while resolving watch note', res.error)
      return null
    }
    const hit = res.data.data.find(
      (n) => n.title === title && Number(n.note_group_id) === Number(groupId),
    )
    if (hit) {
      existingId = hit.id
      break
    }
    lastPage = Math.max(1, res.data.last_page)
    page += 1
  } while (page <= lastPage && page <= MAX_FETCH_PAGES)

  if (existingId != null) {
    const detail = await api().get(existingId)
    if (!detail.ok) return null
    let content = emptyDoc()
    try {
      const parsed = JSON.parse(detail.data.content)
      if (parsed && Array.isArray(parsed.blocks)) content = parsed as OutputData
    } catch {
      /* malformed — start blank */
    }
    return { id: existingId, content, created: false }
  }

  // Create a fresh note in the ASuser group, titled + seeded with a heading.
  const created = await api().create()
  if (!created.ok) {
    log.warn('failed to create watch note', created.error)
    return null
  }
  const id = created.data
  const titleRes = await api().updateTitle(id, title, groupId)
  if (!titleRes.ok) log.warn('failed to title watch note', titleRes.error)
  const content: OutputData = {
    time: Date.now(),
    blocks: [{ type: 'header', data: { text: displayName, level: 2 } }],
    version: EDITORJS_DOC_VERSION,
  } as OutputData
  await api().updateContent(id, JSON.stringify(content))
  return { id, content, created: true }
}

/** Debounced persist of an entry's working content (background-tab path). */
function scheduleSave(entry: WatchNoteEntry): void {
  const existing = saveTimers.get(entry.tabId)
  if (existing) clearTimeout(existing)
  saveTimers.set(
    entry.tabId,
    setTimeout(() => {
      saveTimers.delete(entry.tabId)
      if (entry.noteId == null) return
      void api()
        .updateContent(entry.noteId, JSON.stringify(entry.content))
        .catch((err) => log.warn('watch note save failed', err))
    }, SAVE_DEBOUNCE_MS),
  )
}

/**
 * Called by PlaybackPage the moment slide extraction actually starts. Creates (or
 * reuses) this tab's ASuser note and switches the right panel to the Notes tab.
 * No-op unless the tab is a manual watch tab and watch-sync is enabled.
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

  const displayName = deriveDisplayName(tabId)
  const entry: WatchNoteEntry = {
    tabId,
    instanceId,
    noteId: null,
    displayName,
    status: 'creating',
    content: emptyDoc(),
  }
  state.entries[tabId] = entry
  // Mutate through the reactive proxy, not the raw `entry` local — writes to the
  // raw target bypass the proxy's set trap and the panel never sees 'ready'.
  const stored = state.entries[tabId]

  // Reveal the Notes tab immediately; the note fills in when creation resolves.
  layoutStore.rightCollapsed = false
  setRightPanelTab('notes')

  const result = await findOrCreateNote(displayName)
  if (!result) {
    stored.status = 'error'
    return
  }
  stored.noteId = result.id
  stored.content = result.content
  stored.status = 'ready'
  // Surface the new note on the Drive page (which uses a separate useCloudNotes
  // instance) on its next load — same signal the Slides-page import uses.
  if (result.created) notesRefreshStore.requestNotesRefresh()
}

/** Upload a slide image and append it to the entry's note. `pngFilename` includes `.png`. */
async function appendSlide(entry: WatchNoteEntry, dataUrl: string, pngFilename: string): Promise<void> {
  if (entry.status === 'error') return

  let url: string
  try {
    const bytes = await (await fetch(dataUrl)).arrayBuffer()
    const up = await api().uploadImage(bytes, pngFilename, 'image/png')
    if (!up.ok) {
      log.warn('watch slide upload failed', up.error)
      return
    }
    url = up.data.url
  } catch (err) {
    log.warn('watch slide upload threw', err)
    return
  }

  // Active tab with a live editor: insert through it so user edits aren't lost.
  if (activeEditor && activeEditor.tabId === entry.tabId && tabStore.state.activeTabId === entry.tabId) {
    activeEditor.insertImage(url)
    return
  }
  // Background tab: mutate the working copy + debounced API save.
  entry.content.blocks.push(imageBlock(url))
  if (entry.noteId != null) scheduleSave(entry)
}

function onSlideExtracted(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { slide, instanceId } = event.detail ?? {}
  if (!slide?.dataUrl || typeof instanceId !== 'string') return
  const entry = findEntryByInstance(instanceId)
  if (!entry || entry.status === 'error') return
  const pngFilename = `${String(slide.title ?? `Slide_${Date.now()}`)}.png`
  // With watch-mode auto post-processing on, hold the upload until a completed
  // pass clears this slide (same `!== false` default-true predicate as the
  // PlaybackPage trigger gate). Toggle off ⇒ immediate upload, as before.
  if (configStore.autoPostProcessingLive !== false) {
    getPending(entry.tabId).set(pngFilename, slide.dataUrl)
    return
  }
  chainFlush(entry.tabId, () => appendSlide(entry, slide.dataUrl, pngFilename))
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
  const cleared: Array<{ pngFilename: string; dataUrl: string }> = []
  for (const filename of kept) {
    const pngFilename = String(filename)
    const dataUrl = pending.get(pngFilename)
    if (dataUrl !== undefined) {
      pending.delete(pngFilename)
      cleared.push({ pngFilename, dataUrl })
    }
  }
  if (cleared.length === 0) return
  chainFlush(entry.tabId, async () => {
    for (const item of cleared) {
      await appendSlide(entry, item.dataUrl, item.pngFilename)
    }
  })
}

/** A cleared gallery means those captures are gone — nothing left to release. */
function onSlidesClearedEvent(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const { instanceId } = event.detail ?? {}
  if (typeof instanceId !== 'string') return
  const entry = findEntryByInstance(instanceId)
  if (entry) pendingSlides.delete(entry.tabId)
}

/**
 * Called by PlaybackPage when extraction stops (after any in-flight pass has
 * finished flushing). Remaining buffered slides never got a completed pass —
 * drop them rather than upload unverified captures.
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

/** Whether the right panel should offer the Notes tab (watch-sync + a playback tab). */
export const notesTabAvailable = computed<boolean>(
  () => watchSyncActive() && tabStore.state.activeTabId != null,
)

/** WatchNotesPanel registers its live editor for the active tab. */
export function registerActiveEditor(binding: ActiveEditorBinding): void {
  activeEditor = binding
}

export function unregisterActiveEditor(tabId: string): void {
  if (activeEditor?.tabId === tabId) activeEditor = null
}

/** Sync an entry's working content back from the live editor (called on flush/leave). */
export function commitEditorContent(tabId: string, content: OutputData): void {
  const entry = state.entries[tabId]
  if (!entry) return
  entry.content = content
  if (entry.noteId != null) {
    const existing = saveTimers.get(tabId)
    if (existing) clearTimeout(existing)
    saveTimers.delete(tabId)
    void api()
      .updateContent(entry.noteId, JSON.stringify(content))
      .catch((err) => log.warn('watch note flush failed', err))
  }
}

// Prune entries whose tab was closed (leave the cloud note intact).
watch(
  () => tabStore.state.tabs.map((t) => t.id).join(','),
  () => {
    const live = new Set(tabStore.state.tabs.map((t) => t.id))
    for (const id of Object.keys(state.entries)) {
      if (!live.has(id)) {
        const timer = saveTimers.get(id)
        if (timer) clearTimeout(timer)
        saveTimers.delete(id)
        pendingSlides.delete(id)
        flushChains.delete(id)
        delete state.entries[id]
      }
    }
  },
)

// When watch-sync is turned off or storage becomes unusable, fall back off Notes.
watch(
  () => notesTabAvailable.value,
  (available) => {
    if (!available && rightPanelStore.currentTab === 'notes') setRightPanelTab('task')
  },
)

// Module-level subscriptions: the pipeline's per-slide event, the playback
// page's per-pass post-processing outcome, and gallery clears.
window.addEventListener('slideExtracted', onSlideExtracted)
window.addEventListener('slidesPostProcessed', onSlidesPostProcessed)
window.addEventListener('slidesCleared', onSlidesClearedEvent)

export const watchNotesStore = {
  onExtractionStarted,
  onExtractionStopped,
  activeEntry,
  notesTabAvailable,
  registerActiveEditor,
  unregisterActiveEditor,
  commitEditorContent,
  watchSyncActive,
}
