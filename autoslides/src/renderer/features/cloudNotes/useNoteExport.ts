import { computed } from 'vue'
import { managedNoteDisplayName } from '@common/notesTypes'
import { noteImageUrls, readNoteMetadata } from '@common/notesContent'
import { useBackgroundQueue } from './useBackgroundQueue'
import type { useCloudNotes } from './useCloudNotes'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

export type ExportStatus = 'pending' | 'fetching' | 'downloading' | 'done' | 'conflict' | 'error'

/** One queued note → local `slides_<name>` folder export. */
export interface ExportItem {
  noteId: number
  title: string
  displayName: string
  status: ExportStatus
  /** Images written so far. */
  downloaded: number
  /** Total images in the note. */
  total: number
  /** Destination folder (resolved on conflict-check / prepare). */
  dir?: string
  /** Basename of the existing/destination folder (used for replace cleanup). */
  folderName?: string
  error?: string
}

/**
 * Background queue that reconstitutes managed cloud notes back into local
 * `slides_<displayName>/Slide_NNN.png` folders so they re-enter the normal
 * pipeline (Results View / PDF Maker / re-import). Runs sequentially (one note,
 * then its images in document order) so files land in slide order.
 *
 * Re-export is a *conflict*, not a silent overwrite: if a folder already exists,
 * that row is flagged `conflict` and the user decides per row — open the folder,
 * create a new ` (N)` folder alongside, replace it (a full Results-View folder
 * delete incl. mirrored trash/crop + manifests via trash.removeFolders), or skip.
 * State lives here (not in the modal) so closing the modal keeps the queue alive.
 */
export function useNoteExport(cn: CloudNotesApi) {
  const { queue, cancelRequested, running, overall, reset, cancel, removeItem } =
    useBackgroundQueue<ExportItem>()

  const exporting = computed(() => running.value)

  /** Fetch the note, resolve its folder, then download every image in order. */
  async function processItem(item: ExportItem, mode: 'fresh' | 'create' = 'fresh'): Promise<void> {
    item.status = 'fetching'
    const detailRes = await window.electronAPI.cloudNotes.get(item.noteId)
    if (!detailRes.ok) { item.status = 'error'; item.error = detailRes.error; return }

    const urls = noteImageUrls(detailRes.data.content)
    // Restore the folder's metadata.json from the note's managed metadata block
    // (the `slides` group), if the note carried one.
    const slidesMeta = readNoteMetadata(detailRes.data.content)?.slides ?? null
    item.total = urls.length
    if (urls.length === 0) { item.status = 'error'; item.error = 'empty'; return }

    const prep = await window.electronAPI.cloudNotes.prepareExportFolder(item.displayName, mode)
    if (!prep.ok) { item.status = 'error'; item.error = prep.error; return }
    item.dir = prep.data.dir
    item.folderName = prep.data.folderName

    item.status = 'downloading'
    item.downloaded = 0
    const width = Math.max(3, String(urls.length).length)
    for (let i = 0; i < urls.length; i += 1) {
      if (cancelRequested.value) { item.status = 'error'; item.error = 'cancelled'; return }
      const name = `Slide_${String(i + 1).padStart(width, '0')}.png`
      const dl = await window.electronAPI.cloudNotes.downloadImageToFolder(urls[i], prep.data.dir, name)
      if (!dl.ok) { item.status = 'error'; item.error = dl.error; return }
      item.downloaded += 1
    }
    // Best-effort: re-create metadata.json so the exported folder re-enters the
    // pipeline with its original identity/provenance/review state.
    if (slidesMeta) {
      try { await window.electronAPI.slideMetadata.write(prep.data.dir, slidesMeta) } catch { /* best-effort */ }
    }
    item.status = 'done'
  }

  /**
   * Start exporting the given note ids. Refreshes the full note set, pre-flags
   * notes whose `slides_<name>` folder already exists (conflict), then processes
   * the rest sequentially. Note rows are keyed by note id.
   */
  async function startExport(noteIds: number[]): Promise<void> {
    if (running.value) return
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const byId = new Map(cn.allNotes.value.map((n) => [n.id, n]))

      queue.value = noteIds.map((noteId) => {
        const note = byId.get(noteId)
        const title = note?.title ?? ''
        return {
          noteId,
          title,
          displayName: managedNoteDisplayName(title),
          status: 'pending' as ExportStatus,
          downloaded: 0,
          total: 0,
        }
      })

      // Pre-flag notes whose destination folder already exists. These are not
      // auto-processed — the user decides per row (replace / create / skip).
      for (const item of queue.value) {
        const statusRes = await window.electronAPI.cloudNotes.exportFolderStatus(item.displayName)
        if (statusRes.ok && statusRes.data.exists) {
          item.status = 'conflict'
          item.dir = statusRes.data.dir
          item.folderName = statusRes.data.folderName
        }
      }

      for (const item of queue.value) {
        if (cancelRequested.value) break
        if (item.status !== 'pending') continue
        await processItem(item)
      }
    } finally {
      running.value = false
    }
  }

  /**
   * Resolve a conflicting row. `replace` deletes the existing folder the
   * Results-View way (active folder + mirrored trash/crop subfolders + their
   * manifest entries) via trash.removeFolders, then exports fresh into the base
   * path; `create` exports into a new ` (N)` folder, preserving the existing one.
   */
  async function resolveConflict(item: ExportItem, mode: 'replace' | 'create'): Promise<void> {
    if (running.value) return
    running.value = true
    try {
      if (mode === 'replace' && item.folderName) {
        const rm = await window.electronAPI.trash.removeFolders([item.folderName])
        // removeFolders resolves with { removed, failed } — a hard throw is caught below.
        void rm
      }
      item.status = 'pending'
      item.downloaded = 0
      await processItem(item, mode === 'replace' ? 'fresh' : 'create')
    } finally {
      running.value = false
    }
  }

  /** Drop a conflicting row from the queue without exporting it. */
  const skipConflict = removeItem

  /** Reveal a row's destination/existing folder in the OS file manager. */
  function openFolder(item: ExportItem): void {
    if (item.dir) void window.electronAPI.shell.openPath(item.dir)
  }

  return {
    queue, exporting, overall, cancelRequested,
    startExport, cancel, reset, resolveConflict, skipConflict, openFolder,
  }
}
