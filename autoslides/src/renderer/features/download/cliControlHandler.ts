import { watch } from 'vue'
import {
  isFinalDownloadState,
  type CliControlRequest,
  type CliDownloadState,
  type CliDownloadUpdate,
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

/**
 * The renderer's side of `autoslides` commands (`@common/cliControl`): answer
 * main's questions, and report every item queued for a command until it ends.
 * Installed once by App.vue; returns an uninstall.
 */
export function installCliControlHandler(): () => void {
  const stopFollowing = new Set<() => void>()

  const follow = (itemId: string): void => {
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
          stopFollowing.delete(stop)
        }
      },
    )
    stopFollowing.add(stop)
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
    for (const stop of stopFollowing) stop()
    stopFollowing.clear()
  }
}
