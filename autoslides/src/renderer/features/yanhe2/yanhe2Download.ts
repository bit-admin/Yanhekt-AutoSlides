/**
 * Downloading Yanhe 2.0 recordings through the download list.
 *
 * Main finds the same lecture on Yanhekt first (`yanhe2:prepareDownload`), and
 * each stream becomes an ordinary download row carrying that lecture's ids and
 * titles plus where the stream really comes from (`DownloadItem.yanhe2`). So
 * the file is the one a Yanhekt download of the lecture would write, a lecture
 * already queued from either site is not queued twice, and a screen download
 * is auto-extracted like any other. What Yanhekt does not have drops out of
 * the name (no session id; no ids at all and Yanhe 2.0's titles when the
 * course is missing too) and the download goes ahead (owner ruling 2026-10-21).
 */
import { reactive, ref } from 'vue'
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2DownloadKind, Yanhe2DownloadRefusal } from '@common/yanhe2Download'
import { i18n } from '@shared/i18n'
import { DownloadService } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Download')

export interface Yanhe2DownloadRequest {
  account: string
  /** aita course id. */
  courseId: string
  /** aita session id. */
  subId: string
}

type Asked =
  | { kind: 'added'; itemId: string }
  /** Every stream asked for is already in the download list. */
  | { kind: 'already_queued' }
  /** Already being asked about. */
  | { kind: 'busy' }
  | { kind: Yanhe2DownloadRefusal }

/** aita session ids being asked about right now, with the streams asked for. */
const asking = reactive(new Map<string, Yanhe2DownloadKind[]>())
/** The stream a whole course is being asked about for, if any. */
const addingAll = ref<Yanhe2DownloadKind | null>(null)

/** True while that lecture is being asked about; with `kind`, only when that stream was asked for. */
export function isPreparingYanhe2Download(subId: string, kind?: Yanhe2DownloadKind): boolean {
  const kinds = asking.get(subId)
  return !!kinds && (!kind || kinds.includes(kind))
}

export function yanhe2DownloadAllKind(): Yanhe2DownloadKind | null {
  return addingAll.value
}

const t = (key: string, named?: Record<string, unknown>): string =>
  named ? i18n.global.t(key, named) : i18n.global.t(key)

/** Said in a message box, like the session lists' other queue notices. */
function notify(message: string): void {
  void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
}

/** Open Download, on that row when one is named. */
function showDownload(itemId?: string): void {
  window.dispatchEvent(new CustomEvent('switchToDownload', { detail: itemId }))
}

/** The Recorded sessions page's "already in the download queue" line for these streams. */
function alreadyQueuedText(kinds: Yanhe2DownloadKind[]): string {
  if (kinds.length > 1) return t('sessions.allInDownloadQueue')
  if (kinds[0] === 'screen') return t('sessions.alreadyInDownloadQueueScreen')
  if (kinds[0] === 'audio') return t('sessions.alreadyInDownloadQueueAudio')
  return t('sessions.alreadyInDownloadQueue')
}

/**
 * Check one lecture and add a download row for each stream asked for that it
 * has. A stream it lacks is skipped; none at all is `no_recording`.
 */
async function ask(request: Yanhe2DownloadRequest, kinds: Yanhe2DownloadKind[]): Promise<Asked> {
  const { account, subId } = request
  if (asking.has(subId)) return { kind: 'busy' }
  asking.set(subId, [...kinds])
  try {
    // Plain strings only: nothing reactive crosses the bridge.
    const prepared = await window.electronAPI.yanhe2.prepareDownload(account, { courseId: request.courseId, subId })
    if (prepared.kind !== 'ok') return { kind: prepared.kind }
    const wanted = kinds.filter((kind) => prepared.streams.includes(kind))
    if (wanted.length === 0) return { kind: 'no_recording' }

    const { target } = prepared
    let firstAdded: string | undefined
    for (const kind of wanted) {
      const added = DownloadService.addToQueue({
        name: `${kind}_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
        courseTitle: target.courseTitle,
        sessionTitle: target.sessionTitle,
        sessionId: target.sessionId,
        courseId: target.courseId,
        courseNumber: prepared.courseNumber || undefined,
        videoType: kind,
        yanhe2: { account, courseId: request.courseId, subId },
      })
      if (added.added && !firstAdded) firstAdded = added.item.id
    }
    return firstAdded ? { kind: 'added', itemId: firstAdded } : { kind: 'already_queued' }
  } catch (error) {
    log.error('Yanhe 2.0 download could not be prepared:', error)
    return { kind: 'failed' }
  } finally {
    asking.delete(subId)
  }
}

/**
 * One lecture, one or more streams (Both Streams is camera + screen): rows in
 * Download, or a message box saying why not.
 */
export async function downloadYanhe2Recording(request: Yanhe2DownloadRequest, kinds: Yanhe2DownloadKind[]): Promise<void> {
  if (kinds.length === 0) return
  const asked = await ask(request, kinds)
  if (asked.kind === 'added') showDownload(asked.itemId)
  else if (asked.kind === 'already_queued') notify(alreadyQueuedText(kinds))
  else if (asked.kind !== 'busy') notify(t(`yanhe2Playback.downloadRefused.${asked.kind}`))
}

/**
 * One stream of every lecture of a list: each is checked in turn, and one
 * message box says how many were added.
 */
export async function downloadAllYanhe2Recordings(requests: Yanhe2DownloadRequest[], kind: Yanhe2DownloadKind): Promise<void> {
  if (addingAll.value || requests.length === 0) return
  addingAll.value = kind
  let added = 0
  let queued = 0
  let stopped: Yanhe2DownloadRefusal | null = null
  try {
    for (const request of requests) {
      const asked = await ask(request, [kind])
      if (asked.kind === 'added') {
        if (added === 0) showDownload()
        added++
      } else if (asked.kind === 'already_queued') {
        queued++
      } else if (asked.kind === 'signed_out' || asked.kind === 'network') {
        // Not about this lecture: every later one would be turned down the same way.
        stopped = asked.kind
        break
      }
    }
  } finally {
    addingAll.value = null
  }

  const addedKey = kind === 'screen' ? 'addedToDownloadQueueScreen' : kind === 'audio' ? 'addedToDownloadQueueAudio' : 'addedToDownloadQueue'
  if (added === 0) {
    if (stopped) notify(t(`yanhe2Playback.downloadRefused.${stopped}`))
    else if (queued === requests.length) {
      notify(t(kind === 'screen' ? 'sessions.allInDownloadQueueScreen' : kind === 'audio' ? 'sessions.allInDownloadQueueAudio' : 'sessions.allInDownloadQueue'))
    }
    else notify(t('yanhe2Curriculum.downloadsAllNone'))
  } else if (added < requests.length) {
    notify(t('yanhe2Curriculum.downloadsAllSome', { count: added, skipped: requests.length - added }))
  } else {
    notify(t(`sessions.${addedKey}`, { count: added }))
  }
}
