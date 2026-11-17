import type { CliDownloadState, CliDownloadUpdate, CliQueueItem } from '@common/cliControl'
import type { DownloadItem } from '@shared/services/downloadService'

// Which Download panel rows the command line sees, and what it is told about
// them. Pure (types only), so it is tested without the queue.

// Read off the queue's reactive item into a fresh object of primitives: it
// crosses IPC (Recurring #1).
export function snapshot(itemId: string, item: DownloadItem | undefined): CliDownloadUpdate {
  if (!item) return { itemId, state: 'removed', progress: 0 }
  const state: CliDownloadState = item.status
  return item.error ? { itemId, state, progress: item.progress, error: item.error } : { itemId, state, progress: item.progress }
}

export type CliItem = DownloadItem & { videoType: CliQueueItem['kind'] }

/**
 * The command line covers Yanhekt only (Yanhe 2.0 is in beta), so a row counts
 * by where its media comes from: never a Yanhe 2.0 recording (`yanhe2`, even
 * when the lecture has a Yanhekt session id) and never a transcript. Such rows
 * are not listed, followed or changed from there. Clear Completed is the
 * panel's own button and clears every finished row.
 */
export const isCliItem = (item: DownloadItem): item is CliItem => !item.yanhe2 && item.videoType !== 'subtitles'

// A whole row, again as primitives only.
export function listed(item: CliItem): CliQueueItem {
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
