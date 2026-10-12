/**
 * Captions for one Yanhe 2.0 recording, from the transcript aita makes after
 * class. Asked for once the recording has loaded (a live lecture has none);
 * a lecture without a transcript simply has no captions to offer.
 *
 * The transcript's times are only right on lectures recorded with a working
 * classroom mic. On the others the lines are off by a constant that differs
 * per lecture (24 s early on the one measured, about 1 s and over a minute on
 * others), aita's own player shows the same miss, and nothing in its data
 * gives the number. So by default captions are offered only where the mic was
 * live; the other mode (`yanhe2CaptionMode: 'offset'`) offers them everywhere
 * and delays them on the rest by the user's fixed guess.
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

export function useYanhe2Captions(options: {
  account: string
  subId: string
  playback: Ref<Yanhe2Playback | null>
  currentTime: Ref<number>
  /** Whether this recording's classroom mic was on (the player's `micState`). */
  micState: Ref<'live' | 'dead' | 'checking' | 'unknown'>
}) {
  const { account, subId, playback, currentTime, micState } = options

  const lines = ref<Yanhe2TranscriptLine[]>([])
  let ticket = 0

  const load = async () => {
    const mine = ++ticket
    lines.value = []
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

  /** The lecture has a transcript at all. The mic check is only worth running then. */
  const hasTranscript = computed(() => lines.value.length > 0)

  /** Seconds to hold each line back by; null when captions should not be offered. */
  const delay = computed<number | null>(() => {
    if (!hasTranscript.value) return null
    if (micState.value === 'live') return 0
    // Until the mic has been judged there is no telling which kind this is.
    if (micState.value !== 'dead') return null
    return configStore.yanhe2CaptionMode === 'offset' ? (configStore.yanhe2CaptionOffsetSeconds ?? 0) : null
  })

  const available = computed(() => delay.value !== null)
  const caption = computed(() => {
    if (!captionsOn.value || delay.value === null) return ''
    return transcriptLineAt(lines.value, currentTime.value - delay.value)?.text ?? ''
  })
  const toggle = () => { captionsOn.value = !captionsOn.value }

  return { hasTranscript, available, captionsOn, caption, toggle }
}
