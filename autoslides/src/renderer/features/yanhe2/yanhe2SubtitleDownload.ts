/**
 * Downloading a Yanhe 2.0 recording's transcript as subtitles, wired into the
 * download list the way saved slides are wired into Tasks.
 *
 * Main finds the same lecture on Yanhekt and names the file for it; the work
 * is a download row, so it queues, shows its outcome and can be retried like
 * a video. A lecture without a transcript adds no row and writes nothing; one
 * Yanhekt does not have is named with Yanhe 2.0's titles and no ids.
 *
 * Subtitles get the captions' timing: the fixed delay in that mode, otherwise
 * the delay main measures for the lecture (`yanhe2:captionSync`, kept once
 * measured, so a lecture the player has had captions on answers at once). A
 * lecture whose delay cannot be measured gets no file.
 */
import { reactive, ref } from 'vue'
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2SubtitleRefusal } from '@common/yanhe2Subtitles'
import { i18n } from '@shared/i18n'
import { DownloadService } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'
import { yanhe2FixedCaptionDelay } from './useYanhe2Captions'

const log = createLogger('Yanhe2SubtitleDownload')

export interface Yanhe2SubtitleRequest {
  account: string
  /** aita course id. */
  courseId: string
  /** aita session id. */
  subId: string
}

type Asked =
  | { kind: 'added'; itemId: string }
  /** The download list already has these subtitles. */
  | { kind: 'already_queued' }
  /** The lecture's caption delay could not be measured, so there is no file either. */
  | { kind: 'timing_unknown' }
  /** Already being asked about. */
  | { kind: 'busy' }
  | { kind: Yanhe2SubtitleRefusal }

/** aita session ids being asked about right now. */
const asking = reactive(new Set<string>())
/** True while a whole course is being asked about. */
const addingAll = ref(false)

export function isPreparingYanhe2Subtitles(subId: string): boolean {
  return asking.has(subId)
}

export function isAddingAllYanhe2Subtitles(): boolean {
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

/**
 * The delay the captions use on that lecture. Null when it could not be
 * measured; a refusal when the lecture itself could not be read.
 */
async function captionDelayOf(request: Yanhe2SubtitleRequest): Promise<number | null | Yanhe2SubtitleRefusal> {
  const fixed = yanhe2FixedCaptionDelay()
  if (fixed !== null) return fixed
  const { account, courseId, subId } = request
  const result = await window.electronAPI.yanhe2.captionSync(account, { courseId, subId })
  if (result.kind === 'ok') return result.delay
  return result.kind === 'unknown' ? null : result.kind
}

/**
 * Check one lecture and, if its subtitles can be had, add the download row.
 */
async function ask(request: Yanhe2SubtitleRequest): Promise<Asked> {
  const { account, subId } = request
  if (asking.has(subId)) return { kind: 'busy' }
  asking.add(subId)
  // Plain strings only: nothing reactive crosses the bridge.
  const query = { courseId: request.courseId, subId }
  try {
    // Cheapest first: most refusals on a session list are a lecture with no transcript.
    const prepared = await window.electronAPI.yanhe2.prepareSubtitles(account, query)
    if (prepared.kind !== 'ok') return { kind: prepared.kind }

    const shift = await captionDelayOf(request)
    if (shift === null) return { kind: 'timing_unknown' }
    if (typeof shift === 'string') return { kind: shift }

    const { target } = prepared
    const added = DownloadService.addToQueue(
      {
        // Shown in the list. The file itself takes the screen download's stem (main names it).
        name: `subtitles_${lectureLabel(target.courseTitle, target.sessionTitle)}`,
        courseTitle: target.courseTitle,
        sessionTitle: target.sessionTitle,
        sessionId: target.sessionId,
        courseId: target.courseId,
        videoType: 'subtitles',
      },
      async () => {
        const result = await window.electronAPI.yanhe2.saveSubtitles(account, query, shift)
        if (result.kind !== 'ok') throw new Error(t(`yanhe2Playback.subtitlesRefused.${result.kind}`))
      },
    )
    return added.added ? { kind: 'added', itemId: added.item.id } : { kind: 'already_queued' }
  } catch (error) {
    log.error('Yanhe 2.0 subtitle download could not be prepared:', error)
    return { kind: 'failed' }
  } finally {
    asking.delete(subId)
  }
}

/**
 * One lecture: a row in Download, or a message box saying why not.
 */
export async function downloadYanhe2Subtitles(request: Yanhe2SubtitleRequest): Promise<void> {
  const asked = await ask(request)
  if (asked.kind === 'added') showDownload(asked.itemId)
  else if (asked.kind === 'already_queued') notify(t('yanhe2Playback.subtitlesAlreadyQueued'))
  else if (asked.kind !== 'busy') notify(t(`yanhe2Playback.subtitlesRefused.${asked.kind}`))
}

/**
 * Every lecture of a list: each is checked in turn, the ones whose subtitles
 * can be had become download rows, and one message box says how many.
 */
export async function downloadAllYanhe2Subtitles(requests: Yanhe2SubtitleRequest[]): Promise<void> {
  if (addingAll.value || requests.length === 0) return
  addingAll.value = true
  let added = 0
  let stopped: Yanhe2SubtitleRefusal | null = null
  try {
    for (const request of requests) {
      const asked = await ask(request)
      if (asked.kind === 'added') {
        if (added === 0) showDownload()
        added++
      } else if (asked.kind === 'signed_out' || asked.kind === 'network') {
        // Not about this lecture: every later one would be turned down the same way.
        stopped = asked.kind
        break
      }
    }
  } finally {
    addingAll.value = false
  }

  if (added === 0) {
    notify(stopped ? t(`yanhe2Playback.subtitlesRefused.${stopped}`) : t('yanhe2Curriculum.subtitlesAllNone'))
  } else if (added < requests.length) {
    notify(t('yanhe2Curriculum.subtitlesAllSome', { count: added, skipped: requests.length - added }))
  } else {
    notify(t('yanhe2Curriculum.subtitlesAllAdded', { count: added }))
  }
}
