import { computed, ref } from 'vue'
import type { EditorJsBlock } from '@common/notesTypes'
import { EDITORJS_DOC_VERSION, buildManagedNoteTitle } from '@common/notesTypes'
import { formatToolFolderName, compareToolImages } from '@shared/utils/toolWindowFolders'
import type { useCloudNotes } from './useCloudNotes'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

export type ImportStatus = 'pending' | 'uploading' | 'building' | 'done' | 'conflict' | 'error'

/** One queued folder → note import. */
export interface ImportItem {
  folderName: string
  displayName: string
  path: string
  status: ImportStatus
  /** Images uploaded so far. */
  uploaded: number
  /** Total images in the folder. */
  total: number
  /** Note created for this folder (on success). */
  noteId?: number
  /** Existing managed note that blocks this import (on conflict). */
  conflictNoteId?: number
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
    const done = queue.value.filter(
      (i) => i.status === 'done' || i.status === 'conflict' || i.status === 'error',
    ).length
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

  /** Build the stringified Editor.js document for a folder's uploaded slides. */
  function buildContent(folderName: string, urls: string[]): string {
    // Full display name carries course + session (e.g. "<course> 第N周 星期X 第N大节"
    // or "<course> - Lecture N"), so the header includes the session.
    const heading = formatToolFolderName(folderName)
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
    const contentRes = await window.electronAPI.cloudNotes.updateContent(noteId, buildContent(item.folderName, urls))
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

      // Pre-flag folders that already have a managed note (conflict, not overwrite).
      for (const item of queue.value) {
        const title = buildManagedNoteTitle(item.displayName)
        const existing = cn.allNotes.value.find((n) => n.title === title)
        if (existing) {
          item.status = 'conflict'
          item.conflictNoteId = existing.id
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

  return { queue, importing, overall, cancelRequested, startImport, cancel, reset }
}
