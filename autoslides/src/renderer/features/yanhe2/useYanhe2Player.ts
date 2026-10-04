/**
 * Yanhe 2.0 playback for one session: ask main what there is to play, then
 * attach one stream to one `<video>`.
 *
 * Playback only. No slide extraction, no notes, no watch-position report
 * (aita's own `learn-record` is a write and is never called).
 *
 * One stream at a time. A recording's camera is HLS while its screen and room
 * camera are MP4s on a different clock, so a synced "Both Streams" view needs
 * the offset between them, which is not known yet.
 */
import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import Hls, { Events } from 'hls.js'
import type { Yanhe2SessionStatus } from '@common/yanhe2Calendar'
import type { Yanhe2Playback, Yanhe2PlaybackStream, Yanhe2StreamType } from '@common/yanhe2Playback'
import { getHlsConfig } from '@features/video/hlsConfig'
import { createSingleStreamHlsErrorHandler } from '@features/video/useVideoErrorRecovery'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Player')

export type Yanhe2PlayerProblem = 'signed_out' | 'network' | 'failed' | 'not_playable' | 'player'

export interface UseYanhe2PlayerOptions {
  /** The account the tab was opened under. Fixed for the tab's life. */
  account: string
  courseId: string
  subId: string
  videoPlayer: Ref<HTMLVideoElement | null>
  /** The room camera is offered only while this is true. */
  developerMode: Ref<boolean>
}

export function useYanhe2Player(options: UseYanhe2PlayerOptions) {
  const { account, courseId, subId, videoPlayer, developerMode } = options

  const loading = ref(false)
  const problem = ref<Yanhe2PlayerProblem | null>(null)
  /** Why there is nothing to play, when `problem` is `not_playable`. */
  const sessionStatus = ref<Yanhe2SessionStatus>('unknown')
  const playback = shallowRef<Yanhe2Playback | null>(null)
  const selectedType = ref<Yanhe2StreamType | ''>('')
  const playbackRate = ref(1)

  const hls = shallowRef<Hls | null>(null)
  let proxyClientId: string | null = null
  let loadTicket = 0
  // Carried across a stream switch.
  let resumeAt = 0
  let resumePlaying = true
  let pendingMetadata: (() => void) | null = null

  const mode = computed(() => playback.value?.mode ?? 'recorded')

  /** What the selector offers. Both Streams is not one of them; see the file header. */
  const streams = computed<Yanhe2PlaybackStream[]>(() =>
    (playback.value?.streams ?? []).filter((s) => developerMode.value || s.type !== 'room'),
  )

  const currentStream = computed(() => streams.value.find((s) => s.type === selectedType.value) ?? null)

  // Screen first, like the Yanhekt player; the room camera is never the default.
  const pickDefault = (): Yanhe2StreamType | '' =>
    (['screen', 'camera', 'room'] as const).find((type) => streams.value.some((s) => s.type === type)) ?? ''

  const teardown = () => {
    const video = videoPlayer.value
    if (video && pendingMetadata) video.removeEventListener('loadedmetadata', pendingMetadata)
    pendingMetadata = null
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }

  const reportFatal = (message: string) => {
    log.error('Yanhe 2.0 playback stopped:', message)
    teardown()
    problem.value = 'player'
  }

  const attach = () => {
    const video = videoPlayer.value
    const stream = currentStream.value
    teardown()
    if (!video || !stream) return

    const recorded = mode.value === 'recorded'
    const startAt = recorded ? resumeAt : 0
    const autoplay = resumePlaying
    resumeAt = 0

    const begin = () => {
      video.playbackRate = recorded ? playbackRate.value : 1
      if (autoplay) video.play().catch(() => { /* Autoplay refused: the Play button still works. */ })
    }

    if (stream.format === 'mp4') {
      pendingMetadata = () => {
        pendingMetadata = null
        if (startAt > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(startAt, video.duration)
        begin()
      }
      video.addEventListener('loadedmetadata', pendingMetadata, { once: true })
      video.src = stream.url
      video.load()
      return
    }

    if (!Hls.isSupported()) {
      reportFatal('HLS is not supported')
      return
    }
    // `startPosition`, not `currentTime` after the manifest: MSE has no duration
    // then and the element clamps the seek back to 0.
    const instance = new Hls(
      startAt > 0 ? { ...getHlsConfig(mode.value), startPosition: startAt } : getHlsConfig(mode.value),
    )
    hls.value = instance
    instance.loadSource(stream.url)
    instance.attachMedia(video)
    instance.on(Events.MANIFEST_PARSED, begin)
    instance.on(Events.ERROR, createSingleStreamHlsErrorHandler({
      hls,
      reportFatal,
      logLabel: 'Yanhe 2.0 HLS error:',
      defaultErrorLabel: 'Yanhe 2.0 HLS fatal error:',
      recoverMediaError: () => hls.value?.recoverMediaError(),
    }))
  }

  /** `<video @error>`. hls.js reports its own failures; this is for the MP4 streams. */
  const onVideoError = () => {
    if (hls.value || !videoPlayer.value?.error) return
    reportFatal(`media error ${videoPlayer.value.error.code}`)
  }

  const selectStream = (type: Yanhe2StreamType) => {
    if (type === selectedType.value || !streams.value.some((s) => s.type === type)) return
    const video = videoPlayer.value
    resumeAt = video && Number.isFinite(video.currentTime) ? video.currentTime : 0
    resumePlaying = video ? !video.paused : true
    selectedType.value = type
  }

  const setPlaybackRate = (rate: number) => {
    playbackRate.value = rate
    if (videoPlayer.value && mode.value === 'recorded') videoPlayer.value.playbackRate = rate
  }

  const load = async () => {
    const ticket = ++loadTicket
    teardown()
    loading.value = true
    problem.value = null
    playback.value = null
    selectedType.value = ''
    resumeAt = 0
    resumePlaying = true
    try {
      // Recorded streams are served by the local proxy, which stops once its
      // last client leaves. Hold one for as long as this tab is open.
      if (!proxyClientId) proxyClientId = await window.electronAPI.video.registerClient()
      const result = await window.electronAPI.yanhe2.playback(account, { courseId, subId })
      if (ticket !== loadTicket) return
      if (result.kind === 'ok') {
        playback.value = result.data
        selectedType.value = pickDefault()
        if (!selectedType.value) {
          sessionStatus.value = result.data.mode === 'live' ? 'live' : 'playable'
          problem.value = 'not_playable'
        }
      } else {
        if (result.kind === 'not_playable') sessionStatus.value = result.status
        problem.value = result.kind
      }
    } catch (error) {
      if (ticket !== loadTicket) return
      log.error('Yanhe 2.0 playback load failed:', error)
      problem.value = 'failed'
    } finally {
      if (ticket === loadTicket) loading.value = false
    }
  }

  // The element exists only once there is something to play, and it is
  // replaced when the page swaps to an error state and back.
  watch([videoPlayer, () => currentStream.value?.url], attach)

  // Turning developer mode off must not leave the room camera playing with its
  // option gone from the selector: fall back to screen, then camera.
  watch(streams, (available) => {
    if (!selectedType.value || available.some((s) => s.type === selectedType.value)) return
    const video = videoPlayer.value
    resumeAt = video && Number.isFinite(video.currentTime) ? video.currentTime : 0
    resumePlaying = video ? !video.paused : true
    selectedType.value = pickDefault()
  })

  const dispose = () => {
    loadTicket++
    teardown()
    if (proxyClientId) {
      const id = proxyClientId
      proxyClientId = null
      void window.electronAPI.video.unregisterClient(id).catch(() => undefined)
    }
  }

  onScopeDispose(dispose)

  return {
    loading,
    problem,
    sessionStatus,
    playback,
    mode,
    streams,
    selectedType,
    currentStream,
    playbackRate,
    load,
    selectStream,
    setPlaybackRate,
    onVideoError,
  }
}
