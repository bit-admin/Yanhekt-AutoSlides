// Yanhekt Notes watch-notes sink: the ASuser note with a live Editor.js editor.
// Moved out of watchNotesStore unchanged when watch notes became pluggable.
import type { OutputData } from '@editorjs/editorjs'
import { overrides } from '@shared/overrideRegistry'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger'
import { buildManagedNoteTitle, EDITORJS_DOC_VERSION } from '@common/notesTypes'
import { NOTE_COPYRIGHT } from '@common/notesContent'
import type { LectureIdentity } from '@common/lectureNaming'
import { tabStore } from '@features/course/tabStore'
import { cloudStorageStore } from './cloudStorageStore'
import { notesRefreshStore } from './noteOpenRequest'
import type { WatchNotesSink, YanhektWatchNoteEntry } from './watchNotesTypes'

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

function api(): CloudNotesProvider {
  return overrides.cloudNotesProvider ?? window.electronAPI.cloudNotes
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

  // Create a fresh note in the ASuser group, titled + seeded with a heading and notice.
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
    blocks: [
      { type: 'header', data: { text: displayName, level: 2 } },
      { type: 'paragraph', data: { text: NOTE_COPYRIGHT } },
    ],
    version: EDITORJS_DOC_VERSION,
  } as OutputData
  await api().updateContent(id, JSON.stringify(content))
  return { id, content, created: true }
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
      void api()
        .updateContent(entry.noteId, JSON.stringify(entry.content))
        .catch((err) => log.warn('watch note save failed', err))
    }, SAVE_DEBOUNCE_MS),
  )
}

export const yanhektWatchSink: WatchNotesSink<YanhektWatchNoteEntry> = {
  async open(entry) {
    const result = await findOrCreateNote(entry.displayName, entry.identity)
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

  /** Upload a slide image and append it to the entry's note. */
  async append(entry, dataUrl, pngFilename) {
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
  },

  dispose(tabId) {
    const timer = saveTimers.get(tabId)
    if (timer) clearTimeout(timer)
    saveTimers.delete(tabId)
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
    void api()
      .updateContent(entry.noteId, JSON.stringify(content))
      .catch((err) => log.warn('watch note flush failed', err))
  }
}
