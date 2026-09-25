// Notion watch-notes sink: appends kept slide images to a Notion page as image
// blocks. Pick mode only — every lecture starts `awaiting` and the student picks
// the page in the Notes tab. The main process (NotionNotesService) holds the
// token and each tab's page; this side passes a tab id, PNG bytes and the
// slide's file name.
//
// Kept slides go through the shared visible queue (externalQueueSink).
import { createLogger } from '@shared/utils/logger'
import { createExternalQueue } from './externalQueueSink'
import type { NotionWatchNoteEntry, WatchNotesSink } from './watchNotesTypes'

const log = createLogger('WatchNotesNotion')

function bridge() {
  return window.electronAPI.notionNotes
}

const queue = createExternalQueue<NotionWatchNoteEntry>({
  async write(entry, bytes, pngFilename) {
    const res = await bridge().append(entry.tabId, bytes, pngFilename)
    if (res.ok) return null
    log.warn('Notion append failed', res.error, res.message)
    // Main forgot this tab's page (Notion was disconnected and reconnected):
    // send the lecture back to Choose Page… rather than retrying a dead target.
    if (res.error === 'no_target') {
      entry.target = null
      entry.status = 'awaiting'
    }
    return res.error
  },
  thrownError: 'network',
  close(tabId) {
    void bridge().close(tabId).catch(() => undefined)
  },
})

/** Notes tab → picked a page for this lecture. Resolves false when refused. */
export async function choosePage(entry: NotionWatchNoteEntry, pageId: string): Promise<boolean> {
  try {
    const res = await bridge().choosePage(entry.tabId, pageId)
    if (!res.ok) {
      entry.lastError = res.error
      return false
    }
    // A queue paused only because its page was lost resumes on the new page.
    if (entry.lastError === 'no_target') entry.paused = false
    entry.target = res.data
    entry.status = 'ready'
    entry.lastError = null
    void queue.drain(entry)
    return true
  } catch (err) {
    log.warn('choosePage failed', err)
    entry.lastError = 'network'
    return false
  }
}

export const setNotionPaused = queue.setPaused

export const notionWatchSink: WatchNotesSink<NotionWatchNoteEntry> = {
  async open(entry) {
    entry.status = 'awaiting'
  },
  deliver: queue.deliver,
  discardQueued: queue.discardQueued,
  dispose: queue.dispose,
}
