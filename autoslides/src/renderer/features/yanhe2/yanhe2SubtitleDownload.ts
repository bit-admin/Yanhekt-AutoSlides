/**
 * Downloading a Yanhe 2.0 recording's transcript as subtitles, wired into the
 * download list the way saved slides are wired into Tasks.
 *
 * Main finds the same lecture on Yanhekt and names the file for it; the work
 * is a download row, so it queues, shows its outcome and can be retried like
 * a video. A lecture without a transcript, or one that cannot be found on
 * Yanhekt (or Yanhekt is signed out), adds no row and writes nothing.
 *
 * Subtitles are offered on the captions' terms: only where the transcript's
 * timing can be trusted (`yanhe2CaptionDelay`). The player already knows that
 * for the lecture it has open and passes the delay. From a session list
 * nothing is open, so the classroom mic track is listened to here first, the
 * same check the player runs.
 */
import { reactive, ref } from 'vue'
import { lectureLabel } from '@common/lectureNaming'
import type { Yanhe2SubtitleRefusal } from '@common/yanhe2Subtitles'
import { isMicAudioAudible } from '@features/video/micAudioProbe'
import { i18n } from '@shared/i18n'
import { DownloadService } from '@shared/services/downloadService'
import { createLogger } from '@shared/utils/logger'
import { yanhe2CaptionDelay } from './useYanhe2Captions'

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
  /** The captions would not be offered on this lecture, so neither is the file. */
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
 * The caption delay of a lecture nobody has open: read its mic track's URL,
 * listen to it, apply the captions' rule. Null when subtitles should not be
 * offered; a refusal when the lecture itself could not be read.
 */
async function checkedDelay(request: Yanhe2SubtitleRequest): Promise<number | null | Yanhe2SubtitleRefusal> {
  const { account, courseId, subId } = request
  const playback = await window.electronAPI.yanhe2.playback(account, { courseId, subId })
  if (playback.kind === 'signed_out' || playback.kind === 'network') return playback.kind
  if (playback.kind !== 'ok' || playback.data.mode !== 'recorded') return 'failed'
  // No mic track at all counts as a dead one, as in the player.
  const audioUrl = playback.data.audioUrl
  if (!audioUrl) return yanhe2CaptionDelay(false)

  // The track is served by the local proxy, which runs only while someone holds it.
  const clientId = await window.electronAPI.video.registerClient()
  try {
    return yanhe2CaptionDelay(await isMicAudioAudible(audioUrl, new AbortController().signal))
  } finally {
    void window.electronAPI.video.unregisterClient(clientId).catch(() => undefined)
  }
}

/**
 * Check one lecture and, if its subtitles can be had, add the download row.
 * `shiftSeconds` is the caller's own verdict; without one the mic is checked here.
 */
async function ask(request: Yanhe2SubtitleRequest, shiftSeconds?: number): Promise<Asked> {
  const { account, subId } = request
  if (asking.has(subId)) return { kind: 'busy' }
  asking.add(subId)
  // Plain strings only: nothing reactive crosses the bridge.
  const query = { courseId: request.courseId, subId }
  try {
    // Cheapest first: most refusals on a session list are a lecture with no transcript.
    const prepared = await window.electronAPI.yanhe2.prepareSubtitles(account, query)
    if (prepared.kind !== 'ok') return { kind: prepared.kind }

    const shift = shiftSeconds ?? await checkedDelay(request)
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
 * One lecture: a row in Download, or a message box saying why not. The player
 * passes the delay its captions use; a session list passes none and the mic is
 * checked first.
 */
export async function downloadYanhe2Subtitles(request: Yanhe2SubtitleRequest, shiftSeconds?: number): Promise<void> {
  const asked = await ask(request, shiftSeconds)
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
      } else if (asked.kind === 'signed_out' || asked.kind === 'yanhekt_signed_out' || asked.kind === 'network') {
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
