import { computed, ref } from 'vue'
import type { EditorJsBlock } from '@common/notesTypes'
import { EDITORJS_DOC_VERSION, buildManagedNoteTitle } from '@common/notesTypes'
import { buildNoteMetadataBlock, NOTE_METADATA_VERSION } from '@common/notesContent'
import type { SlideMetadata } from '@common/slideMetadataTypes'
import { formatToolFolderName, compareToolImages } from '@shared/utils/toolWindowFolders'
import type { useCloudNotes } from './useCloudNotes'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

export type ImportStatus =
  | 'pending' | 'uploading' | 'building' | 'done' | 'conflict' | 'error'

/** One queued import row — a local slide folder uploaded as a managed note. */
export interface ImportItem {
  /** Unique row key: the slide folder name. */
  folderName: string
  displayName: string
  path: string
  status: ImportStatus
  /** Images uploaded so far. */
  uploaded: number
  /** Total images in the folder. */
  total: number
  /** Note created for this row (on success). */
  noteId?: number
  /** Existing managed note(s) with the same title (on conflict). */
  conflictNoteIds?: number[]
  error?: string
}

/** Localized strings for the generated note content (the component owns i18n). */
export interface ImportTexts {
  meta: (count: number, date: string) => string
  warning: string
  slideCaption: (n: number) => string
}

interface PdfFolder { name: string; path: string; imageCount: number }
interface PdfImage { name: string; path: string }

/**
 * Background queue that pushes locally-extracted slide folders into the managed
 * Yanhekt group as image notes — one note per folder. Runs sequentially (one
 * folder, then images within it in slide order) so the note's blocks stay
 * ordered and uploads don't hammer the server.
 *
 * Re-import is a *conflict*, not an overwrite: if a managed note already exists
 * for a folder (matched by exact built title), that row is flagged `conflict`
 * with the existing note id so the UI can offer "open note"; the user deletes it
 * manually to re-import. State lives here (not in the modal) so closing the modal
 * mid-import keeps the queue running.
 */
export function useNoteImport(cn: CloudNotesApi, texts: ImportTexts) {
  const queue = ref<ImportItem[]>([])
  const cancelRequested = ref(false)
  const running = ref(false)

  const importing = computed(() => running.value)
  const overall = computed(() => {
    const total = queue.value.length
    // Conflicts are not counted as resolved — they await a user decision.
    const done = queue.value.filter((i) => i.status === 'done' || i.status === 'error').length
    return { done, total }
  })

  function reset(): void {
    if (running.value) return
    queue.value = []
    cancelRequested.value = false
  }

  function cancel(): void {
    cancelRequested.value = true
  }

  /**
   * Build the stringified Editor.js document for a note's slides (uploaded or
   * shared). Appends a managed metadata code block at the end carrying the
   * originating folder's metadata.json (`slides`, null for share imports) plus
   * cloud-note metadata (`note`).
   */
  function buildContent(heading: string, urls: string[], slides: SlideMetadata | null): string {
    // `heading` is the full display name (course + session, e.g.
    // "<course> 第N周 星期X 第N大节" or "<course> - Lecture N").
    const blocks: EditorJsBlock[] = [
      { type: 'header', data: { text: heading, level: 2 } },
      { type: 'paragraph', data: { text: texts.meta(urls.length, new Date().toLocaleDateString()) } },
      { type: 'paragraph', data: { text: texts.warning } },
      ...urls.map((url, idx): EditorJsBlock => ({
        type: 'image',
        data: {
          file: { url },
          caption: texts.slideCaption(idx + 1),
          withBorder: false,
          stretched: false,
          withBackground: false,
        },
      })),
      buildNoteMetadataBlock({
        v: NOTE_METADATA_VERSION,
        slides,
        note: {
          displayName: heading,
          imageCount: urls.length,
          importedAt: new Date().toISOString(),
        },
      }),
    ]
    return JSON.stringify({ time: Date.now(), blocks, version: EDITORJS_DOC_VERSION })
  }

  /** Create the note, upload every slide in order, then save the content. */
  async function processItem(item: ImportItem): Promise<void> {
    const images = (await window.electronAPI.pdfmaker.getImages(item.path)) as PdfImage[]
    const sorted = [...images].sort((a, b) => compareToolImages(a.name, b.name))
    item.total = sorted.length
    if (sorted.length === 0) {
      item.status = 'error'
      item.error = 'empty'
      return
    }

    const createRes = await window.electronAPI.cloudNotes.create()
    if (!createRes.ok) { item.status = 'error'; item.error = createRes.error; return }
    const noteId = createRes.data
    item.noteId = noteId

    const title = buildManagedNoteTitle(item.displayName)
    const groupId = cn.managedGroups.value[0]?.id
    const titleRes = await window.electronAPI.cloudNotes.updateTitle(noteId, title, groupId)
    if (!titleRes.ok) { item.status = 'error'; item.error = titleRes.error; return }

    item.status = 'uploading'
    const urls: string[] = []
    for (const img of sorted) {
      if (cancelRequested.value) { item.status = 'error'; item.error = 'cancelled'; return }
      const up = await window.electronAPI.cloudNotes.uploadImageFromPath(img.path)
      if (!up.ok) { item.status = 'error'; item.error = up.error; return }
      urls.push(up.data.url)
      item.uploaded += 1
    }

    item.status = 'building'
    // Carry the originating folder's metadata.json into the note (null if absent).
    const slidesMeta = await window.electronAPI.slideMetadata.get(item.path)
    const contentRes = await window.electronAPI.cloudNotes.updateContent(noteId, buildContent(item.displayName, urls, slidesMeta))
    if (!contentRes.ok) { item.status = 'error'; item.error = contentRes.error; return }
    item.status = 'done'
  }

  /**
   * Start importing the given folders. Refreshes the full note set for an
   * accurate conflict check, pre-flags conflicting folders, then processes the
   * rest sequentially. Reloads notes + groups afterwards so new notes appear.
   */
  async function startImport(folderNames: string[]): Promise<void> {
    if (running.value) return
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const byName = new Map(folders.map((f) => [f.name, f]))

      queue.value = folderNames.map((folderName) => {
        const f = byName.get(folderName)
        return {
          folderName,
          displayName: formatToolFolderName(folderName),
          path: f?.path ?? '',
          status: 'pending' as ImportStatus,
          uploaded: 0,
          total: f?.imageCount ?? 0,
        }
      })

      // Pre-flag folders that already have a managed note. These are not
      // auto-processed — the user decides per row (replace / create / skip).
      for (const item of queue.value) {
        const ids = sameTitleNoteIds(item.displayName)
        if (ids.length > 0) {
          item.status = 'conflict'
          item.conflictNoteIds = ids
        }
      }

      for (const item of queue.value) {
        if (cancelRequested.value) break
        if (item.status !== 'pending') continue
        await processItem(item)
      }

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
    } finally {
      running.value = false
    }
  }

  /** Current ids of all managed notes whose title matches this folder. */
  function sameTitleNoteIds(displayName: string): number[] {
    const title = buildManagedNoteTitle(displayName)
    return cn.allNotes.value.filter((n) => n.title === title).map((n) => n.id)
  }

  /**
   * Resolve a conflicting row. `replace` deletes *all* same-titled managed notes
   * first (the user may have more than one), then imports fresh; `create` imports
   * a new note alongside the existing one(s) — harmless, since identical images
   * dedup to the same server URL. Runs the same single-folder pipeline.
   */
  async function resolveConflict(item: ImportItem, mode: 'replace' | 'create'): Promise<void> {
    if (running.value) return
    running.value = true
    try {
      if (mode === 'replace') {
        for (const id of sameTitleNoteIds(item.displayName)) {
          const del = await window.electronAPI.cloudNotes.delete(id)
          if (!del.ok) { item.status = 'error'; item.error = del.error; return }
        }
      }
      item.status = 'pending'
      item.uploaded = 0
      item.conflictNoteIds = undefined
      await processItem(item)
      await Promise.all([cn.loadAll(), cn.refreshGroups()])
    } finally {
      running.value = false
    }
  }

  /** Drop a conflicting row from the queue without importing it. */
  function skipConflict(item: ImportItem): void {
    queue.value = queue.value.filter((i) => i !== item)
  }

  return {
    queue, importing, overall, cancelRequested,
    startImport, cancel, reset, resolveConflict, skipConflict,
  }
}
