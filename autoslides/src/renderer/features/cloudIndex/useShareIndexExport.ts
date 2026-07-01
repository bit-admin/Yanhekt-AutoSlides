import { computed, ref } from 'vue'
import type { ShareImportResult } from '@common/notesTypes'
import type { SlideMetadata } from '@common/slideMetadataTypes'

export type ShareExportStatus = 'pending' | 'downloading' | 'done' | 'conflict' | 'error'

/** The single in-flight share-link → local folder export. */
export interface ShareExportItem {
  title: string
  urls: string[]
  status: ShareExportStatus
  /** Images written so far. */
  downloaded: number
  /** Total images to write. */
  total: number
  /** Destination folder (resolved on conflict-check / prepare). */
  dir?: string
  /** Basename of the existing/destination folder (used for replace cleanup). */
  folderName?: string
  /** Slide metadata from AutoSlides Index, written as metadata.json (null if un-indexed). */
  metadata?: SlideMetadata | null
  error?: string
}

/**
 * Export a resolved share link (already-fetched title + public image URLs, from
 * `cloudNotes.resolveShareLink`) into a local `slides_<title>/Slide_NNN.png`
 * folder — the Cloud Index native detail view's single-item analogue of
 * `useNoteExport`. When the link is indexed on AutoSlides Index, the resolve
 * result also carries reconstructed `metadata`, which is written as the
 * folder's `metadata.json` (best-effort) so the export re-enters the pipeline
 * with its origin identity + review flags; an un-indexed link exports images
 * only.
 *
 * Re-export is a *conflict*, not a silent overwrite: if the folder already
 * exists, the row is flagged `conflict` and the caller decides — replace (a
 * full Results-View folder delete via trash.removeFolders), create alongside,
 * or skip. Only one export can be in flight at a time.
 */
export function useShareIndexExport() {
  const item = ref<ShareExportItem | null>(null)
  const cancelRequested = ref(false)
  const running = ref(false)

  const exporting = computed(() => running.value)

  function reset(): void {
    if (running.value) return
    item.value = null
    cancelRequested.value = false
  }

  function cancel(): void {
    cancelRequested.value = true
  }

  /** Resolve the destination folder, then download every image in order. */
  async function processItem(row: ShareExportItem, mode: 'fresh' | 'create' = 'fresh'): Promise<void> {
    const prep = await window.electronAPI.cloudNotes.prepareExportFolder(row.title, mode)
    if (!prep.ok) { row.status = 'error'; row.error = prep.error; return }
    row.dir = prep.data.dir
    row.folderName = prep.data.folderName

    row.status = 'downloading'
    row.downloaded = 0
    const width = Math.max(3, String(row.urls.length).length)
    for (let i = 0; i < row.urls.length; i += 1) {
      if (cancelRequested.value) { row.status = 'error'; row.error = 'cancelled'; return }
      const name = `Slide_${String(i + 1).padStart(width, '0')}.png`
      const dl = await window.electronAPI.cloudNotes.downloadImageToFolder(row.urls[i], prep.data.dir, name)
      if (!dl.ok) { row.status = 'error'; row.error = dl.error; return }
      row.downloaded += 1
    }
    // Best-effort: write the index-sourced metadata.json so the folder carries
    // its origin identity/review state (matches useNoteExport's restore step).
    if (row.metadata) {
      try { await window.electronAPI.slideMetadata.write(prep.data.dir, row.metadata) } catch { /* best-effort */ }
    }
    row.status = 'done'
  }

  /**
   * Start exporting an already-resolved share link. Pre-flags a conflict if the
   * destination `slides_<title>` folder already exists, otherwise exports fresh.
   */
  async function startExport(result: ShareImportResult): Promise<void> {
    if (running.value) return
    cancelRequested.value = false
    running.value = true
    try {
      const row: ShareExportItem = {
        title: result.title,
        urls: result.urls,
        status: 'pending',
        downloaded: 0,
        total: result.urls.length,
        metadata: result.metadata ?? null,
      }
      item.value = row

      if (row.urls.length === 0) { row.status = 'error'; row.error = 'empty'; return }

      const statusRes = await window.electronAPI.cloudNotes.exportFolderStatus(row.title)
      if (statusRes.ok && statusRes.data.exists) {
        row.status = 'conflict'
        row.dir = statusRes.data.dir
        row.folderName = statusRes.data.folderName
        return
      }

      await processItem(row)
    } finally {
      running.value = false
    }
  }

  /**
   * Resolve the conflicting item. `replace` deletes the existing folder the
   * Results-View way (via trash.removeFolders), then exports fresh into the base
   * path; `create` exports into a new ` (N)` folder, preserving the existing one.
   */
  async function resolveConflict(mode: 'replace' | 'create'): Promise<void> {
    const row = item.value
    if (!row || running.value) return
    running.value = true
    try {
      if (mode === 'replace' && row.folderName) {
        await window.electronAPI.trash.removeFolders([row.folderName])
      }
      row.status = 'pending'
      row.downloaded = 0
      await processItem(row, mode === 'replace' ? 'fresh' : 'create')
    } finally {
      running.value = false
    }
  }

  /** Drop the conflicting item without exporting it. */
  function skipConflict(): void {
    item.value = null
  }

  /** Reveal the destination/existing folder in the OS file manager. */
  function openFolder(): void {
    if (item.value?.dir) void window.electronAPI.shell.openPath(item.value.dir)
  }

  return {
    item, exporting, cancelRequested,
    startExport, cancel, reset, resolveConflict, skipConflict, openFolder,
  }
}
