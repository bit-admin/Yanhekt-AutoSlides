import { computed, ref } from 'vue'
import { shareImportDisplayName } from '@common/notesTypes'
import type { ShareImportResult, ShareLectureMeta } from '@common/notesTypes'
import type { LectureIdentity } from '@common/lectureNaming'
import type { SlideTimeline } from '@common/sidecars'
import { activeClones } from '@shared/services/cloneActivity'
import { createLogger } from '@shared/utils/logger'
const log = createLogger('ShareLinkExport')

export type ShareExportStatus = 'pending' | 'downloading' | 'done' | 'conflict' | 'error'
export type ShareExportMode = 'fresh' | 'replace' | 'create'
/**
 * What a failed clone left on disk:
 * `unchanged` / `cancelled` nothing, `old-kept` the old folder could not be
 * moved so it stays, `stage-kept` the old folder is in the bin and the finished
 * clone waits in `stagedDir`.
 */
export type ShareExportFailure = 'unchanged' | 'cancelled' | 'old-kept' | 'stage-kept'

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
  /** Referenced images that could not be resolved. */
  missing: number
  /** Destination folder (resolved on conflict-check / prepare). */
  dir?: string
  /** Basename of the existing/destination folder (used for replace cleanup). */
  folderName?: string
  /** Reconstructed timeline.json from a v3 share payload. */
  timeline?: SlideTimeline | null
  /** Lecture facts from the link, for the folder's metadata.json. */
  lectureMeta?: ShareLectureMeta | null
  error?: string
  failure?: ShareExportFailure
  /** How this clone was asked to land, for Retry. */
  mode?: ShareExportMode
  /** A complete clone that could not be put in place. */
  stagedDir?: string
}

/**
 * Export a resolved share link (already-fetched title + public image URLs, from
 * `cloudNotes.resolveShareLink`) into a local `slides_<title>/Slide_NNN.png`
 * folder. A complete v3 link's timeline is written as `timeline.json`.
 *
 * Re-export is a *conflict*, not a silent overwrite: if the folder already
 * exists, the row is flagged `conflict` and the caller decides — replace,
 * create alongside, or skip. Only one export can be in flight at a time.
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

  /** Plain lecture facts for `metadata.json`. */
  function sourceOf(row: ShareExportItem) {
    const meta = row.lectureMeta
    const identity = identityOf(row)
    return {
      courseId: identity.courseId != null ? String(identity.courseId) : undefined,
      sessionId: identity.sessionId != null ? String(identity.sessionId) : undefined,
      liveId: identity.liveId != null ? String(identity.liveId) : undefined,
      courseTitle: meta?.courseTitle || undefined,
      sessionTitle: meta?.sessionTitle || undefined,
      instructor: meta?.instructor || undefined,
      professors: meta?.professors ? [...meta.professors] : undefined,
      college: meta?.college || undefined,
      schoolYear: meta?.schoolYear || undefined,
      semester: meta?.semester || undefined,
    }
  }

  function fail(row: ShareExportItem, failure: ShareExportFailure, error?: string): void {
    row.status = 'error'
    row.failure = failure
    row.error = error ?? failure
  }

  /**
   * Build the whole clone in a hidden stage, then put it in place. The old
   * folder is only moved once the new one is complete; a failure before that
   * leaves it exactly as it was.
   */
  async function processItem(row: ShareExportItem, mode: ShareExportMode): Promise<void> {
    row.mode = mode
    row.failure = undefined
    row.error = undefined
    row.stagedDir = undefined
    const prep = await window.electronAPI.cloudNotes.prepareCloneStage()
    if (!prep.ok) { fail(row, 'unchanged', prep.error); return }
    const stage = prep.data.dir
    let keepStage = false
    try {
      row.status = 'downloading'
      row.downloaded = 0
      const width = Math.max(3, String(row.urls.length).length)
      const written: Array<{ filename: string; url: string }> = []
      for (let i = 0; i < row.urls.length; i += 1) {
        if (cancelRequested.value) { fail(row, 'cancelled'); return }
        const name = `Slide_${String(i + 1).padStart(width, '0')}.png`
        const dl = await window.electronAPI.cloudNotes.downloadImageToFolder(row.urls[i], stage, name)
        if (!dl.ok) { fail(row, 'unchanged', dl.error); return }
        written.push({ filename: name, url: String(row.urls[i]) })
        row.downloaded += 1
      }
      // metadata.json (`extractor: 'share'`) makes the folder a recognised
      // slides folder, and its slides count as uploaded already. Plain values only.
      const recorded = await window.electronAPI.drive.recordClone(stage, { source: sourceOf(row), slides: written }).catch(() => null)
      if (!recorded?.ok) { log.warn('Clone metadata was not written'); fail(row, 'unchanged', 'metadata'); return }
      // A partial clone compacts image numbers, so the original timeline would
      // point some timestamps at the wrong images: it is left out on purpose.
      if (row.timeline && row.missing === 0) {
        // JSON-clone: `row` is inside a ref (DataCloneError otherwise, CLAUDE.md).
        const saved = await window.electronAPI.slideTimeline.write(stage, JSON.parse(JSON.stringify(row.timeline))).catch(() => null)
        if (!saved?.success) { fail(row, 'unchanged', 'timeline'); return }
      }
      if (cancelRequested.value) { fail(row, 'cancelled'); return }

      if (mode === 'replace' && row.folderName) {
        const moved = await window.electronAPI.trash.removeFolders([row.folderName]).catch(() => null)
        if (!moved || moved.failed > 0) { fail(row, 'old-kept'); return }
      }
      const published = await window.electronAPI.cloudNotes.publishCloneStage(
        stage, row.displayName, mode === 'create' ? 'create' : 'fresh', identityOf(row),
      )
      if (!published.ok) {
        // After a replace the old folder is in the bin: this stage is the only copy.
        if (mode === 'replace') {
          keepStage = true
          row.stagedDir = stage
          row.dir = stage
          fail(row, 'stage-kept', published.error)
        } else {
          fail(row, 'unchanged', published.error)
        }
        return
      }
      row.dir = published.data.dir
      row.folderName = published.data.folderName
      row.status = 'done'
    } finally {
      if (!keepStage && row.status !== 'done') {
        await window.electronAPI.cloudNotes.discardCloneStage(stage).catch((error) => log.warn('Clone stage was not removed', error))
      }
    }
  }

  /** Run again after a failure that left nothing behind to protect. */
  async function retry(): Promise<void> {
    const row = item.value
    if (!row || running.value || row.status !== 'error' || !row.mode || row.failure === 'stage-kept') return
    cancelRequested.value = false
    await guarded(() => processItem(row, row.mode ?? 'fresh'))
  }

  async function guarded(work: () => Promise<void>): Promise<void> {
    running.value = true
    activeClones.value += 1
    try {
      await work()
    } finally {
      activeClones.value -= 1
      running.value = false
    }
  }

  /**
   * Start exporting an already-resolved share link. Pre-flags a conflict if the
   * destination `slides_<title>` folder already exists, otherwise exports fresh.
   */
  async function startExport(result: ShareImportResult): Promise<void> {
    if (running.value) return
    cancelRequested.value = false
    await guarded(async () => {
      const identity: LectureIdentity = {
        courseId: result.identity?.courseId,
        sessionId: result.identity?.sessionId,
        liveId: result.identity?.liveId,
      }
      item.value = {
        title: result.title,
        displayName: shareImportDisplayName(result),
        identity,
        urls: result.urls,
        status: 'pending',
        downloaded: 0,
        total: result.urls.length,
        missing: result.missing,
        timeline: result.timeline ?? null,
        lectureMeta: result.lectureMeta ? JSON.parse(JSON.stringify(result.lectureMeta)) : null,
      }
      const row = item.value

      if (row.urls.length === 0) { row.status = 'error'; row.error = 'empty'; return }

      const statusRes = await window.electronAPI.cloudNotes.exportFolderStatus(row.displayName, identityOf(row))
      if (statusRes.ok && statusRes.data.exists) {
        row.status = 'conflict'
        row.dir = statusRes.data.dir
        row.folderName = statusRes.data.folderName
        return
      }

      await processItem(row, 'fresh')
    })
  }

  /**
   * Resolve the conflicting item. `replace` moves the existing folder to the
   * system bin once the new one is complete; `create` publishes a new ` (N)`
   * folder, preserving the existing one.
   */
  async function resolveConflict(mode: 'replace' | 'create'): Promise<void> {
    const row = item.value
    if (!row || running.value) return
    cancelRequested.value = false
    await guarded(async () => {
      row.status = 'pending'
      row.downloaded = 0
      await processItem(row, mode)
    })
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
    startExport, cancel, reset, retry, resolveConflict, skipConflict, openFolder,
  }
}
