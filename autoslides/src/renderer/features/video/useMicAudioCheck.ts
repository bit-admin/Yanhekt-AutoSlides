/**
 * Whether a lecture's classroom-mic track should be offered.
 *
 * Both Yanhekt and Yanhe 2.0 list the mic file for recordings whose microphone
 * was never switched on, so with `checkMicAudioBeforeOffering` (Settings →
 * Download & Playback) the track is listened to first (`micAudioProbe`) and
 * offered only once speech is found on it. With the setting off it is offered
 * as soon as the lecture has one, as it always was.
 *
 * The verdict belongs to one URL: a new lecture starts unknown again. Turning
 * the setting on while a lecture is open checks that lecture then.
 */
import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { configStore } from '@shared/services/configStore'
import { isMicAudioAudible } from './micAudioProbe'

export function useMicAudioCheck(micAudioUrl: Ref<string | null>) {
  const verdict = ref<'unknown' | 'audible' | 'silent'>('unknown')
  const checkFirst = computed(() => configStore.checkMicAudioBeforeOffering ?? true)
  let probe: AbortController | null = null

  watch([micAudioUrl, checkFirst], async ([url, check], previous) => {
    if (url !== previous?.[0]) {
      probe?.abort()
      probe = null
      verdict.value = 'unknown'
    }
    if (!url || !check || verdict.value !== 'unknown' || probe) return
    const mine = new AbortController()
    probe = mine
    const audible = await isMicAudioAudible(url, mine.signal)
    if (mine.signal.aborted) return
    probe = null
    verdict.value = audible ? 'audible' : 'silent'
  }, { immediate: true })

  onScopeDispose(() => probe?.abort())

  /** True when the lecture has a mic track and nothing says it is dead. */
  const available = computed(() => !!micAudioUrl.value && (!checkFirst.value || verdict.value === 'audible'))

  return { available }
}
