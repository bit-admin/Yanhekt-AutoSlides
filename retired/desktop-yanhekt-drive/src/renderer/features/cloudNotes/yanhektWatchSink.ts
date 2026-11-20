// Yanhekt Notes watch-notes sink: the ASuser note with a live Editor.js editor.
// Moved out of watchNotesStore unchanged when watch notes became pluggable.
import type { OutputData } from '@editorjs/editorjs'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger'
import { buildManagedNoteTitle, EDITORJS_DOC_VERSION } from '@common/notesTypes'
import { NOTE_COPYRIGHT } from '@common/notesContent'
import type { LectureIdentity } from '@common/lectureNaming'
import { tabStore } from '@features/course/tabStore'
import { cloudStorageStore } from './cloudStorageStore'
import { readNoteContent } from './noteContent'
import { ownedNotesApi } from './ownedNotesApi'
import { notesRefreshStore } from './noteOpenRequest'
import type { KeptSlide, WatchNotesSink, YanhektWatchNoteEntry } from './watchNotesTypes'

const log = createLogger('WatchNotes')

/** Page size / cap mirroring cloudStorageStore's full-set paging. */
const FETCH_PAGE_SIZE = 500
const MAX_FETCH_PAGES = 20
const SAVE_DEBOUNCE_MS = 1000

/**
 * Live editor bound to the *active* tab's note, registered by WatchNotesPanel.
 * When present, slide appends for the active tab go through it (so an in-progress
 * user edit isn't clobbered by an external content overwrite); background tabs
 * append via the API instead.
 */
export interface ActiveEditorBinding {
  tabId: string
  /** Insert an image block at the end of the live editor. */
  insertImage: (url: string) => void
}

let activeEditor: ActiveEditorBinding | null = null
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
// Per-tab promise chain serializing appends so overlapping pass events can't
// interleave image blocks out of order.
const appendChains = new Map<string, Promise<void>>()

// The note calls of the account each tab's note was opened under. Kept per
// tab so a note found for one account is never written with another's token:
// after a switch main refuses these calls (see `ownedNotesApi`).
const apis = new Map<string, CloudNotesProvider>()

/** The calls a tab's watch note is written with. */
export function watchNoteApi(tabId: string): CloudNotesProvider {
  let api = apis.get(tabId)
  if (!api) {
    api = ownedNotesApi(cloudStorageStore.boundBadge())
    apis.set(tabId, api)
  }
  return api
}

export function emptyDoc(): OutputData {
  return { time: Date.now(), blocks: [], version: EDITORJS_DOC_VERSION } as OutputData
}

function imageBlock(url: string) {
  return {
    type: 'image',
    data: { file: { url }, caption: '', withBorder: false, stretched: false, withBackground: false },
  }
}

/** Find an existing ASuser watch note by title, else create one. */
async function findOrCreateNote(
  api: CloudNotesProvider,
  displayName: string,
  identity: LectureIdentity,
): Promise<{ id: number; content: OutputData; created: boolean } | null> {
  const groupId = cloudStorageStore.userGroupId.value
  if (groupId == null) return null
  // Carries the id block, so two same-titled courses get two watch notes.
  const title = buildManagedNoteTitle(displayName, identity)

  // Scan the full note list for an existing managed note with this title in ASuser.
  let page = 1
  let lastPage = 1
  let existingId: number | null = null
  do {
    const res = await api.list({ page, pageSize: FETCH_PAGE_SIZE })
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
    const detail = await api.get(existingId)
    if (!detail.ok) return null
    const read = readNoteContent(detail.data.content)
    // Not an Editor.js document: appending would replace whatever it holds.
    if (read.kind === 'unreadable') {
      log.warn('watch note content is unreadable; leaving it untouched', existingId)
      return null
    }
    const content = read.kind === 'document' ? (read.data as OutputData) : emptyDoc()
    return { id: existingId, content, created: false }
  }

  // Create a fresh note in the ASuser group, titled + seeded with a heading and notice.
  const created = await api.create()
  if (!created.ok) {
    log.warn('failed to create watch note', created.error)
    return null
  }
  const id = created.data
  // An untitled note outside the group would never be found again, and the
  // next open would create another: remove it instead of keeping it.
  const abandon = async (step: string, error: string): Promise<null> => {
    log.warn(`failed to ${step} watch note`, error)
    const removed = await api.delete(id)
    if (!removed.ok) log.warn('could not remove the unfinished watch note', id, removed.error)
    return null
  }
  const titleRes = await api.updateTitle(id, title, groupId)
  if (!titleRes.ok) return abandon('title', titleRes.error)
  const content: OutputData = {
    time: Date.now(),
    blocks: [
      { type: 'header', data: { text: displayName, level: 2 } },
      { type: 'paragraph', data: { text: NOTE_COPYRIGHT } },
    ],
    version: EDITORJS_DOC_VERSION,
  } as OutputData
  const seeded = await api.updateContent(id, JSON.stringify(content))
  if (!seeded.ok) return abandon('seed', seeded.error)
  return { id, content, created: true }
}

/** One content write. A refused write is logged: the envelope resolves, it does not throw. */
async function save(tabId: string, noteId: number, content: string): Promise<void> {
  try {
    const res = await watchNoteApi(tabId).updateContent(noteId, content)
    if (!res.ok) log.warn('watch note save failed', res.error)
  } catch (err) {
    log.warn('watch note save failed', err)
  }
}

/** Debounced persist of an entry's working content (background-tab path). */
function scheduleSave(entry: YanhektWatchNoteEntry): void {
  const existing = saveTimers.get(entry.tabId)
  if (existing) clearTimeout(existing)
  saveTimers.set(
    entry.tabId,
    setTimeout(() => {
      saveTimers.delete(entry.tabId)
      if (entry.noteId == null) return
      void save(entry.tabId, entry.noteId, JSON.stringify(entry.content))
    }, SAVE_DEBOUNCE_MS),
  )
}

/** Upload a slide image and append it to the entry's note. */
async function appendSlide(entry: YanhektWatchNoteEntry, dataUrl: string, pngFilename: string): Promise<void> {
  if (entry.status === 'error') return

  let url: string
  try {
    const bytes = await (await fetch(dataUrl)).arrayBuffer()
    const up = await watchNoteApi(entry.tabId).uploadImage(bytes, pngFilename, 'image/png')
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

export const yanhektWatchSink: WatchNotesSink<YanhektWatchNoteEntry> = {
  async open(entry) {
    // A fresh open binds the tab to whoever is signed in now.
    apis.delete(entry.tabId)
    const result = await findOrCreateNote(watchNoteApi(entry.tabId), entry.displayName, entry.identity)
    if (!result) {
      entry.status = 'error'
      return
    }
    entry.noteId = result.id
    entry.content = result.content
    entry.status = 'ready'
    // Surface the new note on the Drive page (which uses a separate useCloudNotes
    // instance) on its next load — same signal the Slides-page import uses.
    if (result.created) notesRefreshStore.requestNotesRefresh()
  },

  deliver(entry, slides: KeptSlide[]) {
    const prev = appendChains.get(entry.tabId) ?? Promise.resolve()
    appendChains.set(
      entry.tabId,
      prev
        .then(async () => {
          for (const slide of slides) await appendSlide(entry, slide.dataUrl, slide.pngFilename)
        })
        .catch((err) => log.warn('watch note flush failed', err)),
    )
  },

  // Nothing is held: slides go straight to the upload chain.
  discardQueued() {},

  dispose(tabId) {
    const timer = saveTimers.get(tabId)
    if (timer) clearTimeout(timer)
    saveTimers.delete(tabId)
    appendChains.delete(tabId)
    apis.delete(tabId)
  },
}

/** WatchNotesPanel registers its live editor for the active tab. */
export function registerActiveEditor(binding: ActiveEditorBinding): void {
  activeEditor = binding
}

export function unregisterActiveEditor(tabId: string): void {
  if (activeEditor?.tabId === tabId) activeEditor = null
}

/** Sync an entry's working content back from the live editor (called on flush/leave). */
export function commitEditorContent(entry: YanhektWatchNoteEntry, content: OutputData): void {
  entry.content = content
  if (entry.noteId != null) {
    const existing = saveTimers.get(entry.tabId)
    if (existing) clearTimeout(existing)
    saveTimers.delete(entry.tabId)
    void save(entry.tabId, entry.noteId, JSON.stringify(content))
  }
}
