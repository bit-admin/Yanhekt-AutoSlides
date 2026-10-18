import { watch } from 'vue'
import {
  isFinalDownloadState,
  type CliControlRequest,
  type CliDownloadState,
  type CliDownloadUpdate,
  type CliQueueChange,
  type CliQueueItem,
} from '@common/cliControl'
import { tokenManager, whenStartupAuthSettled } from '@shared/services/authService'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'
import { queueSessionDownload } from './queueSessionDownload'

const log = createLogger('CliControl')

// Read off the queue's reactive item into a fresh object of primitives: it
// crosses IPC (Recurring #1).
function snapshot(itemId: string, item: DownloadItem | undefined): CliDownloadUpdate {
  if (!item) return { itemId, state: 'removed', progress: 0 }
  const state: CliDownloadState = item.status
  return item.error ? { itemId, state, progress: item.progress, error: item.error } : { itemId, state, progress: item.progress }
}

const findItem = (itemId: string): DownloadItem | undefined =>
  DownloadService.downloadItems.find((item) => item.id === itemId)

// The command line covers Yanhekt only (Yanhe 2.0 is in beta): its transcript
// rows are never listed or changed from there. Clear Completed is the panel's
// own button and clears every finished row.
type CliItem = DownloadItem & { videoType: CliQueueItem['kind'] }
const isCliItem = (item: DownloadItem): item is CliItem => item.videoType !== 'subtitles'
const findCliItem = (itemId: string): CliItem | undefined => {
  const item = findItem(itemId)
  return item && isCliItem(item) ? item : undefined
}

// A whole row, again as primitives only.
function listed(item: CliItem): CliQueueItem {
  const extraction =
    item.extractionStatus && item.extractionStatus !== 'none'
      ? {
          state: item.extractionStatus,
          progress: item.extractionProgress ?? 0,
          ...(item.extractionError ? { error: item.extractionError } : {}),
        }
      : null
  return {
    ...snapshot(item.id, item),
    kind: item.videoType,
    name: item.name,
    sessionId: String(item.sessionId),
    courseId: item.courseId != null ? String(item.courseId) : null,
    courseTitle: item.courseTitle,
    sessionTitle: item.sessionTitle,
    addedAt: item.addedAt,
    completedAt: item.completedAt ?? null,
    extraction,
  }
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
        const current = snapshot(queued.id, findItem(queued.id) ?? queued)
        if (!isFinalDownloadState(current.state)) follow(queued.id)
        return { ...current, added: result.added }
      }
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
