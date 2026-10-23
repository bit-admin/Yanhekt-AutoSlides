import { computed } from 'vue'
import type { EditorJsBlock } from '@common/notesTypes'
import { EDITORJS_DOC_VERSION, buildManagedNoteTitle } from '@common/notesTypes'
import { parseLectureIds } from '@common/lectureNaming'
import { buildNoteMetadataBlock, NOTE_COPYRIGHT, NOTE_METADATA_VERSION } from '@common/notesContent'
import type { SlideTimeline } from '@common/sidecars'
import type { SlideMetadata } from '@common/slideMetadataTypes'
import { isWatchExtraction } from '@common/slideMetadataTypes'
import { formatToolFolderName, compareToolImages } from '@shared/utils/toolWindowFolders'
import type { useCloudNotes } from './useCloudNotes'
import { cloudStorageStore } from './cloudStorageStore'
import { useBackgroundQueue } from './useBackgroundQueue'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

export type ImportStatus =
  | 'pending' | 'uploading' | 'building' | 'done' | 'conflict' | 'error'

/** One queued import row: a local slide folder. */
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
  const { queue, cancelRequested, running, overall, reset, cancel, removeItem } =
    useBackgroundQueue<ImportItem>()

  const importing = computed(() => running.value)
  /**
   * Image-level progress across the whole queue (for a continuous progress bar,
   * as opposed to `overall`'s per-folder done/total used for the modal's row
   * count). Each item contributes its `uploaded` count while actively uploading,
   * and its full `total` once past the upload phase (building/done/error) so the
   * bar keeps advancing through those near-instant steps instead of stalling.
   * Pending/conflict items contribute 0 until processed.
   */
  const imageProgress = computed(() => {
    let done = 0
    let total = 0
    for (const item of queue.value) {
      total += item.total
      switch (item.status) {
        case 'uploading':
          done += item.uploaded
          break
        case 'building':
        case 'done':
        case 'error':
          done += item.total
          break
        default:
          break
      }
    }
    return { done, total }
  })

  /**
   * Build the stringified Editor.js document for a note's uploaded slides.
   * Appends a managed metadata code block at the end carrying the originating
   * folder's metadata.json (`slides`) plus cloud-note metadata (`note`).
   */
  function buildContent(
    heading: string,
    urls: string[],
    slides: SlideMetadata | null,
    timeline?: SlideTimeline | null,
  ): string {
    // `heading` is the full display name (course + session, e.g.
    // "<course> 第N周 星期X 第N大节" or "<course> - Lecture N").
    const blocks: EditorJsBlock[] = [
      { type: 'header', data: { text: heading, level: 2 } },
      { type: 'paragraph', data: { text: texts.meta(urls.length, new Date().toLocaleDateString()) } },
      { type: 'paragraph', data: { text: NOTE_COPYRIGHT } },
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
        timeline: timeline ?? null,
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

    const title = buildManagedNoteTitle(item.displayName, parseLectureIds(item.folderName))
    const groupId = cloudStorageStore.managedGroupId.value ?? cn.managedGroups.value[0]?.id
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
    // Carry the originating folder's metadata.json + timeline.json into the note.
    const [slidesMeta, timeline] = await Promise.all([
      window.electronAPI.slideMetadata.get(item.path),
      window.electronAPI.slideTimeline.get(item.path),
    ])
    const contentRes = await window.electronAPI.cloudNotes.updateContent(
      noteId,
      buildContent(item.displayName, urls, slidesMeta, timeline),
    )
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

      // Pre-flag folders that already have a managed note; these await a user
      // decision (replace / create / skip).
      for (const item of queue.value) {
        const ids = sameLectureNoteIds(item)
        if (ids.length === 0) continue
        item.status = 'conflict'
        item.conflictNoteIds = ids
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

  /**
   * Current ids of all managed notes for this lecture. Matching on the full
   * built title (which carries the id block) is what keeps two same-titled
   * courses from being treated as one note — and it stays a single request,
   * since the note list returns titles but not content.
   */
  function sameLectureNoteIds(item: Pick<ImportItem, 'folderName' | 'displayName'>): number[] {
    const title = buildManagedNoteTitle(item.displayName, parseLectureIds(item.folderName))
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
        for (const id of sameLectureNoteIds(item)) {
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
  const skipConflict = removeItem

  /**
   * Auto-sync a single folder to the managed group in the background — the entry
   * point for the Settings → Cloud "Sync" feature (triggered when a folder becomes
   * reviewed/edited). Unlike startImport, this never touches the visible `queue`
   * (no modal/progress-bar surface) and never prompts: a folder that already has a
   * managed note is *skipped* (the user's chosen policy), not flagged as a conflict.
   * Returns the outcome so the caller can log/ignore.
   */
  async function syncFolder(folderName: string): Promise<'synced' | 'skipped' | 'error'> {
    if (running.value) return 'skipped'
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const displayName = formatToolFolderName(folderName)
      // Already imported → skip (no overwrite, no prompt).
      if (sameLectureNoteIds({ folderName, displayName }).length > 0) return 'skipped'

      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const folder = folders.find((f) => f.name === folderName)
      if (!folder) return 'error'

      // Watch-mode folders (captured while watching playback) are import-ineligible
      // — completeness is unverifiable. Skip silently so auto-sync never imports them.
      if (isWatchExtraction(await window.electronAPI.slideMetadata.get(folder.path))) return 'skipped'

      const item: ImportItem = {
        folderName,
        displayName,
        path: folder.path,
        status: 'pending',
        uploaded: 0,
        total: folder.imageCount,
      }
      await processItem(item)

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
      return item.status === 'done' ? 'synced' : 'error'
    } finally {
      running.value = false
    }
  }

  /**
   * Auto-resync a single folder that ALREADY has a managed note — the inverse of
   * `syncFolder`. Triggered when an imported folder is edited again. Replaces the
   * existing note by delete-then-create (matching the manual "Import Slides to
   * Notes" replace-on-conflict path), so the note reflects the freshly-edited
   * slides. A folder with no managed note is a no-op (`'skipped'`) — first import
   * is `syncFolder`'s job.
   */
  async function resyncFolder(folderName: string): Promise<'resynced' | 'skipped' | 'error'> {
    if (running.value) return 'skipped'
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const displayName = formatToolFolderName(folderName)
      const ids = sameLectureNoteIds({ folderName, displayName })
      // No existing note → nothing to resync (creating is syncFolder's job).
      if (ids.length === 0) return 'skipped'

      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const folder = folders.find((f) => f.name === folderName)
      if (!folder) return 'error'

      // Watch-mode folders are import-ineligible, so they never have a managed
      // note to resync (guarded here too in case one is created out-of-band).
      if (isWatchExtraction(await window.electronAPI.slideMetadata.get(folder.path))) return 'skipped'

      // Replace = delete existing managed note(s), then import fresh.
      for (const id of ids) {
        const del = await window.electronAPI.cloudNotes.delete(id)
        if (!del.ok) return 'error'
      }

      const item: ImportItem = {
        folderName,
        displayName,
        path: folder.path,
        status: 'pending',
        uploaded: 0,
        total: folder.imageCount,
      }
      await processItem(item)

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
      return item.status === 'done' ? 'resynced' : 'error'
    } finally {
      running.value = false
    }
  }

  return {
    queue, importing, overall, imageProgress, cancelRequested,
    startImport, cancel, reset, resolveConflict, skipConflict, syncFolder, resyncFolder,
  }
}
