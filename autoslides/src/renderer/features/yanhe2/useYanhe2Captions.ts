/**
 * Captions for one Yanhe 2.0 recording, from the transcript aita makes after
 * class. Asked for once the recording has loaded (a live lecture has none);
 * a lecture without a transcript simply has no captions to offer.
 *
 * The transcript's times are off by a constant that differs per lecture
 * (measured from 23 s late to 45 s early), aita's own player shows the same
 * miss, and nothing in its data gives the number. So by default
 * (`yanhe2CaptionMode: 'auto'`) main measures it against the recording's
 * audio (`yanhe2:captionSync`) and captions are offered where that gives an
 * answer. The measurement downloads minutes of video, so it waits until
 * somebody turns captions on or opens the transcript; main keeps the answer,
 * so a lecture is measured once. The other mode (`'offset'`) offers captions
 * on every lecture, delayed by the user's fixed guess.
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { Yanhe2Playback } from '@common/yanhe2Playback'
import { transcriptLineAt, type Yanhe2TranscriptLine } from '@common/yanhe2Transcript'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Captions')

// One switch for every Yanhe 2.0 tab: turned on once, it stays on for the
// lectures opened after it. Not saved across launches.
const captionsOn = ref(false)

/**
 * The section under the player: its slides (false) or its transcript (true).
 * One switch for every Yanhe 2.0 tab, like the captions', and not saved either.
 */
export const yanhe2TranscriptView = ref(false)

/** The fixed delay of `offset` mode, or null in `auto` mode, where each lecture has its own. */
export function yanhe2FixedCaptionDelay(): number | null {
  return configStore.yanhe2CaptionMode === 'offset' ? (configStore.yanhe2CaptionOffsetSeconds ?? 0) : null
}

export function useYanhe2Captions(options: {
  account: string
  courseId: string
  subId: string
  playback: Ref<Yanhe2Playback | null>
  currentTime: Ref<number>
}) {
  const { account, courseId, subId, playback, currentTime } = options

  const lines = ref<Yanhe2TranscriptLine[]>([])
  /** This lecture's measurement: not asked for yet, under way, an answer (`measured`), or none to be had. */
  const sync = ref<'idle' | 'measuring' | 'synced' | 'unknown'>('idle')
  const measured = ref(0)
  let ticket = 0

  const load = async () => {
    const mine = ++ticket
    lines.value = []
    sync.value = 'idle'
    if (playback.value?.mode !== 'recorded') return
    try {
      const result = await window.electronAPI.yanhe2.transcript(account, subId)
      if (mine !== ticket) return
      // Anything but a transcript means no captions; the player is unaffected.
      if (result.kind === 'ok') lines.value = result.data
    } catch (error) {
      if (mine === ticket) log.error('Yanhe 2.0 transcript load failed:', error)
    }
  }

  watch(playback, load, { immediate: true })

  /** The lecture has a transcript at all. */
  const hasTranscript = computed(() => lines.value.length > 0)
  const fixedDelay = computed(yanhe2FixedCaptionDelay)

  // Measure once the timing is needed: captions on, or the transcript on show.
  const measure = async () => {
    const mine = ticket
    sync.value = 'measuring'
    let state: 'synced' | 'unknown' = 'unknown'
    try {
      const result = await window.electronAPI.yanhe2.captionSync(account, { courseId, subId })
      if (mine !== ticket) return
      if (result.kind === 'ok') {
        measured.value = result.delay
        state = 'synced'
      }
    } catch (error) {
      if (mine !== ticket) return
      log.error('Yanhe 2.0 caption sync failed:', error)
    }
    // A failed measurement is not retried by this tab; main does not keep it, so reopening the lecture asks again.
    sync.value = state
  }
  watch(
    () => hasTranscript.value && fixedDelay.value === null && sync.value === 'idle'
      && (captionsOn.value || yanhe2TranscriptView.value),
    (wanted) => { if (wanted) void measure() },
    { immediate: true },
  )

  /** Seconds to hold each line back by; null while that is not known. */
  const delay = computed<number | null>(() => {
    if (!hasTranscript.value) return null
    if (fixedDelay.value !== null) return fixedDelay.value
    return sync.value === 'synced' ? measured.value : null
  })

  /** Whether to offer captions: not on a lecture whose measurement gave no answer. */
  const available = computed(() => hasTranscript.value && (fixedDelay.value !== null || sync.value !== 'unknown'))
  /** Captions are on and waiting for the measurement. */
  const syncing = computed(() => captionsOn.value && available.value && sync.value === 'measuring' && delay.value === null)
  const caption = computed(() => {
    if (!captionsOn.value || delay.value === null) return ''
    return transcriptLineAt(lines.value, currentTime.value - delay.value)?.text ?? ''
  })
  const toggle = () => { captionsOn.value = !captionsOn.value }

  // `lines` and `delay` are also what the page's transcript view reads.
  return { lines, delay, hasTranscript, available, syncing, captionsOn, caption, toggle }
}
