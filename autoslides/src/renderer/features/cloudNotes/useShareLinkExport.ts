import { computed, ref } from 'vue'
import { shareImportDisplayName } from '@common/notesTypes'
import type { ShareImportResult } from '@common/notesTypes'
import type { LectureIdentity } from '@common/lectureNaming'
import type { SlideTimeline } from '@common/sidecars'

export type ShareExportStatus = 'pending' | 'downloading' | 'done' | 'conflict' | 'error'

/** The single in-flight share-link → local folder export. */
export interface ShareExportItem {
  title: string
  /** Folder stem (`操作系统_第1周_星期二_第5大节`), never the id token. */
  displayName: string
  identity: LectureIdentity
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
  /** Reconstructed timeline.json from a v3 share payload. */
  timeline?: SlideTimeline | null
  error?: string
}

/**
 * Export a resolved share link (already-fetched title + public image URLs, from
 * `cloudNotes.resolveShareLink`) into a local `slides_<title>/Slide_NNN.png`
 * folder — the single-item analogue of `useNoteExport`. A v3 link's timeline
 * is written as `timeline.json` (best-effort).
 *
 * Re-export is a *conflict*, not a silent overwrite: if the folder already
 * exists, the row is flagged `conflict` and the caller decides — replace (a
 * full Results-View folder delete via trash.removeFolders), create alongside,
 * or skip. Only one export can be in flight at a time.
 */
export function useShareLinkExport() {
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

  /**
   * The lecture identity, rebuilt as a PLAIN object. `row` lives inside a ref,
   * so handing `row.identity` straight to ipcRenderer.invoke would send a Vue
   * proxy and throw an opaque DataCloneError (see CLAUDE.md).
   */
  function identityOf(row: ShareExportItem): LectureIdentity {
    return {
      courseId: row.identity.courseId,
      sessionId: row.identity.sessionId,
      liveId: row.identity.liveId,
    }
  }

  /** Resolve the destination folder, then download every image in order. */
  async function processItem(row: ShareExportItem, mode: 'fresh' | 'create' = 'fresh'): Promise<void> {
    const prep = await window.electronAPI.cloudNotes.prepareExportFolder(row.displayName, mode, identityOf(row))
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
    // JSON-clone: `row` is inside a ref (DataCloneError otherwise, CLAUDE.md).
    if (row.timeline) {
      try {
        await window.electronAPI.slideTimeline.write(prep.data.dir, JSON.parse(JSON.stringify(row.timeline)))
      } catch { /* best-effort */ }
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
      const identity: LectureIdentity = {
        courseId: result.identity?.courseId,
        sessionId: result.identity?.sessionId,
        liveId: result.identity?.liveId,
      }
      const row: ShareExportItem = {
        title: result.title,
        displayName: shareImportDisplayName(result),
        identity,
        urls: result.urls,
        status: 'pending',
        downloaded: 0,
        total: result.urls.length,
        timeline: result.timeline ?? null,
      }
      item.value = row

      if (row.urls.length === 0) { row.status = 'error'; row.error = 'empty'; return }

      const statusRes = await window.electronAPI.cloudNotes.exportFolderStatus(row.displayName, identityOf(row))
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
