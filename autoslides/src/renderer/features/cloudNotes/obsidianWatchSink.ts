// Obsidian watch-notes sink: appends kept slide images to a Markdown note. The
// main process (ObsidianNotesService) owns every path; this side passes a tab id,
// PNG bytes and the slide's file name.
//
// Kept slides go through the shared visible queue (externalQueueSink): they wait
// while the lecture has no note yet or the student paused appending.
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import { buildManagedNoteTitle } from '@common/notesTypes'
import type { ObsidianTargetInfo } from '@common/obsidianNotesTypes'
import { createExternalQueue } from './externalQueueSink'
import type { ObsidianWatchNoteEntry, WatchNotesSink } from './watchNotesTypes'

const log = createLogger('WatchNotesObsidian')

function bridge() {
  return window.electronAPI.obsidianNotes
}

const queue = createExternalQueue<ObsidianWatchNoteEntry>({
  async write(entry, bytes, pngFilename) {
    const res = await bridge().append(entry.tabId, bytes, pngFilename)
    if (res.ok) return null
    log.warn('Obsidian append failed', res.error, res.message)
    return res.error
  },
  thrownError: 'io',
  close(tabId) {
    void bridge().close(tabId).catch(() => undefined)
  },
})

function applyTarget(entry: ObsidianWatchNoteEntry, target: ObsidianTargetInfo): void {
  entry.target = target
  entry.status = 'ready'
  entry.lastError = null
  void queue.drain(entry)
}

/**
 * Create (or reuse) the lecture's note in the configured vault. On failure the
 * entry goes back to `awaiting` with the reason, so Choose Note… still works.
 */
export async function createLectureNote(entry: ObsidianWatchNoteEntry): Promise<boolean> {
  entry.status = 'creating'
  const title = buildManagedNoteTitle(entry.displayName, entry.identity)
  try {
    const res = await bridge().openAuto(entry.tabId, title, entry.slidesFolderName)
    if (res.ok) {
      applyTarget(entry, res.data)
      return true
    }
    entry.lastError = res.error
  } catch (err) {
    log.warn('openAuto failed', err)
    entry.lastError = 'io'
  }
  entry.status = entry.target ? 'ready' : 'awaiting'
  return false
}

/** Main-side file dialog; resolves false when cancelled or refused. */
export async function chooseNote(entry: ObsidianWatchNoteEntry): Promise<boolean> {
  try {
    const res = await bridge().chooseNote(entry.tabId, entry.slidesFolderName)
    if (!res.ok) {
      entry.lastError = res.error
      return false
    }
    if (!res.data) return false
    applyTarget(entry, res.data)
    return true
  } catch (err) {
    log.warn('chooseNote failed', err)
    entry.lastError = 'io'
    return false
  }
}

export const setObsidianPaused = queue.setPaused

export const obsidianWatchSink: WatchNotesSink<ObsidianWatchNoteEntry> = {
  async open(entry) {
    if (configStore.obsidianAutoCreateNote && configStore.obsidianVaultPath) {
      await createLectureNote(entry)
    } else {
      entry.status = 'awaiting'
    }
  },
  deliver: queue.deliver,
  discardQueued: queue.discardQueued,
  dispose: queue.dispose,
}
