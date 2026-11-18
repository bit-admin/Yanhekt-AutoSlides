import { watch } from 'vue'
import { isFinalDownloadState, type CliControlRequest, type CliQueueChange } from '@common/cliControl'
import { tokenManager, whenStartupAuthSettled } from '@shared/services/authService'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'
import { isCliItem, listed, snapshot, type CliItem } from './cliQueueItems'
import { countOutputFolderWork } from './outputFolderWork'
import { queueSessionDownload } from './queueSessionDownload'

const log = createLogger('CliControl')

const findItem = (itemId: string): DownloadItem | undefined =>
  DownloadService.downloadItems.find((item) => item.id === itemId)

// Only the rows the command line may see (`isCliItem`).
const findCliItem = (itemId: string): CliItem | undefined => {
  const item = findItem(itemId)
  return item && isCliItem(item) ? item : undefined
}

// The panel's per-row buttons, applied to one item.
function change(action: 'cancel' | 'retry', itemId: string): CliQueueChange {
  const before = findCliItem(itemId)
  if (!before) return { itemId, changed: false, state: 'removed' }
  const wasFinal = isFinalDownloadState(before.status)
  if (action === 'cancel' && !wasFinal) DownloadService.removeFromQueue(itemId)
  else if (action === 'retry' && before.status === 'error') DownloadService.retryDownload(itemId)
  else return { itemId, changed: false, state: before.status }
  return { itemId, changed: true, state: snapshot(itemId, findItem(itemId)).state }
}

/**
 * The renderer's side of `autoslides` commands (`@common/cliControl`): answer
 * main's questions, and report every item queued for a command until it ends.
 * Installed once by App.vue; returns an uninstall.
 */
export function installCliControlHandler(): () => void {
  // One watcher per item, however many commands follow it.
  const stopFollowing = new Map<string, () => void>()

  const follow = (itemId: string): void => {
    if (stopFollowing.has(itemId)) return
    let last = ''
    const stop = watch(
      () => snapshot(itemId, findItem(itemId)),
      (update) => {
        const key = `${update.state}:${update.progress}:${update.error ?? ''}`
        if (key === last) return
        last = key
        window.electronAPI.cli.controlDownloadUpdate(update)
        if (isFinalDownloadState(update.state)) {
          stop()
          stopFollowing.delete(itemId)
        }
      },
    )
    stopFollowing.set(itemId, stop)
  }

  const handle = async (request: CliControlRequest): Promise<unknown> => {
    switch (request.method) {
      case 'signInState': {
        await whenStartupAuthSettled()
        return { signedIn: tokenManager.hasToken() }
      }
      case 'queueDownload': {
        const { lecture, stream } = request.params as CliControlRequest<'queueDownload'>['params']
        const result = queueSessionDownload(lecture, lecture.course.title, stream)
        const queued = result.added ? result.item : result.existingItem
        // The panel dedupes by lecture and stream, so the row already there may
        // be a Yanhe 2.0 recording of the same lecture: not the command line's to follow.
        if (!isCliItem(queued)) return { blocked: true }
        const current = snapshot(queued.id, findItem(queued.id) ?? queued)
        if (!isFinalDownloadState(current.state)) follow(queued.id)
        return { ...current, added: result.added }
      }
      case 'outputFolderWork':
        return countOutputFolderWork()
      case 'listDownloads':
        return { items: DownloadService.downloadItems.filter(isCliItem).map(listed) }
      case 'followDownloads': {
        const { itemIds } = request.params as CliControlRequest<'followDownloads'>['params']
        return itemIds.map((itemId) => {
          // The caller only follows unfinished items; this answer is their state now.
          const current = snapshot(itemId, findCliItem(itemId))
          if (!isFinalDownloadState(current.state)) follow(itemId)
          return current
        })
      }
      case 'changeDownloads': {
        const { action, itemIds } = request.params as CliControlRequest<'changeDownloads'>['params']
        return itemIds.map((itemId) => change(action, itemId))
      }
      case 'clearDownloads': {
        const before = DownloadService.downloadItems.length
        DownloadService.clearCompleted()
        return { removed: before - DownloadService.downloadItems.length }
      }
      default:
        throw new Error(`unknown request: ${String(request.method)}`)
    }
  }

  const unsubscribe = window.electronAPI.cli.onControlRequest((request) => {
    handle(request).then(
      (result) => window.electronAPI.cli.controlRespond({ id: request.id, ok: true, result }),
      (error: unknown) => {
        log.warn(`Command-line request ${request.method} failed:`, error)
        const message = error instanceof Error ? error.message : String(error)
        window.electronAPI.cli.controlRespond({ id: request.id, ok: false, message })
      },
    )
  })
  window.electronAPI.cli.controlReady()

  return () => {
    unsubscribe()
    for (const stop of stopFollowing.values()) stop()
    stopFollowing.clear()
  }
}
