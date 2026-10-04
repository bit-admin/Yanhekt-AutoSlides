/**
 * Yanhe 2.0 playback for one session: ask main what there is to play, then
 * attach either one stream to one `<video>`, or camera + screen to a pair.
 *
 * Playback only. No slide extraction, no notes, no watch-position report
 * (aita's own `learn-record` is a write and is never called).
 *
 * Both Streams works like the Yanhekt player's: the screen is the master
 * clock and the camera follows it. A recording's camera is HLS and its screen
 * an MP4, but they are the same recordings Yanhekt serves, so the two are
 * synced on `currentTime` with no offset.
 */
import { computed, onScopeDispose, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import Hls, { Events } from 'hls.js'
import type { Yanhe2SessionStatus } from '@common/yanhe2Calendar'
import type { Yanhe2Playback, Yanhe2PlaybackStream, Yanhe2StreamType } from '@common/yanhe2Playback'
import { getHlsConfig } from '@features/video/hlsConfig'
import { createMediaSyncLoop, syncFollower } from '@features/video/mediaSync'
import { createSingleStreamHlsErrorHandler } from '@features/video/useVideoErrorRecovery'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('Yanhe2Player')

export type Yanhe2PlayerProblem = 'signed_out' | 'network' | 'failed' | 'not_playable' | 'player'

/** The selector's value for camera + screen side by side. */
export const YANHE2_BOTH_STREAMS = 'both'
export type Yanhe2StreamChoice = Yanhe2StreamType | typeof YANHE2_BOTH_STREAMS

export interface UseYanhe2PlayerOptions {
  /** The account the tab was opened under. Fixed for the tab's life. */
  account: string
  courseId: string
  subId: string
  /** The single-stream element. */
  videoPlayer: Ref<HTMLVideoElement | null>
  /** The Both Streams pair. */
  cameraVideoPlayer: Ref<HTMLVideoElement | null>
  screenVideoPlayer: Ref<HTMLVideoElement | null>
  /** The room camera is offered only while this is true. */
  developerMode: Ref<boolean>
}

export function useYanhe2Player(options: UseYanhe2PlayerOptions) {
  const { account, courseId, subId, videoPlayer, cameraVideoPlayer, screenVideoPlayer, developerMode } = options

  const loading = ref(false)
  const problem = ref<Yanhe2PlayerProblem | null>(null)
  /** Why there is nothing to play, when `problem` is `not_playable`. */
  const sessionStatus = ref<Yanhe2SessionStatus>('unknown')
  const playback = shallowRef<Yanhe2Playback | null>(null)
  const selected = ref<Yanhe2StreamChoice | ''>('')
  const playbackRate = ref(1)

  // What is attached right now: each element, its hls.js instance if it has
  // one, and its pending first-metadata listener if it is an MP4.
  interface Attachment {
    video: HTMLVideoElement
    hls: ShallowRef<Hls | null>
    onMetadata: (() => void) | null
  }
  let attachments: Attachment[] = []

  let proxyClientId: string | null = null
  let loadTicket = 0
  // Carried across a stream switch.
  let resumeAt = 0
  let resumePlaying = true

  const mode = computed(() => playback.value?.mode ?? 'recorded')

  /** The single streams the selector offers. */
  const streams = computed<Yanhe2PlaybackStream[]>(() =>
    (playback.value?.streams ?? []).filter((s) => developerMode.value || s.type !== 'room'),
  )

  const streamOf = (type: Yanhe2StreamType) => streams.value.find((s) => s.type === type) ?? null

  /** Both Streams is camera plus screen; the room camera is never half of it. */
  const hasDualStreams = computed(() => !!streamOf('camera') && !!streamOf('screen'))
  const isDualSelected = computed(() => selected.value === YANHE2_BOTH_STREAMS && hasDualStreams.value)
  const currentStream = computed(() =>
    selected.value && selected.value !== YANHE2_BOTH_STREAMS ? streamOf(selected.value) : null,
  )

  /** The element that owns the clock: the screen in Both Streams, as in the Yanhekt player. */
  const masterVideo = computed(() => (isDualSelected.value ? screenVideoPlayer.value : videoPlayer.value))

  const isOffered = (choice: Yanhe2StreamChoice | '') =>
    choice === YANHE2_BOTH_STREAMS ? hasDualStreams.value : !!choice && !!streamOf(choice)

  // Screen first, like the Yanhekt player; the room camera is never the default.
  const pickDefault = (): Yanhe2StreamType | '' =>
    (['screen', 'camera', 'room'] as const).find((type) => !!streamOf(type)) ?? ''

  const syncLoop = createMediaSyncLoop(() => {
    const screen = screenVideoPlayer.value
    const camera = cameraVideoPlayer.value
    if (!isDualSelected.value || !screen || !camera) return
    const rate = mode.value === 'recorded' ? playbackRate.value : 1
    screen.playbackRate = rate
    camera.playbackRate = rate
    syncFollower(screen, camera)
  })

  const teardown = () => {
    syncLoop.stop()
    for (const { video, hls, onMetadata } of attachments) {
      if (onMetadata) video.removeEventListener('loadedmetadata', onMetadata)
      hls.value?.destroy()
      hls.value = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    attachments = []
  }

  const reportFatal = (message: string) => {
    log.error('Yanhe 2.0 playback stopped:', message)
    teardown()
    problem.value = 'player'
  }

  const attachOne = (video: HTMLVideoElement, stream: Yanhe2PlaybackStream, startAt: number, autoplay: boolean) => {
    const attachment: Attachment = { video, hls: shallowRef(null), onMetadata: null }
    attachments.push(attachment)

    const begin = () => {
      video.playbackRate = mode.value === 'recorded' ? playbackRate.value : 1
      if (autoplay) video.play().catch(() => { /* Autoplay refused: the Play button still works. */ })
    }

    if (stream.format === 'mp4') {
      attachment.onMetadata = () => {
        attachment.onMetadata = null
        if (startAt > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(startAt, video.duration)
        begin()
      }
      video.addEventListener('loadedmetadata', attachment.onMetadata, { once: true })
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
    attachment.hls.value = instance
    instance.loadSource(stream.url)
    instance.attachMedia(video)
    instance.on(Events.MANIFEST_PARSED, begin)
    instance.on(Events.ERROR, createSingleStreamHlsErrorHandler({
      hls: attachment.hls,
      reportFatal,
      logLabel: `Yanhe 2.0 HLS error (${stream.type}):`,
      defaultErrorLabel: `Yanhe 2.0 HLS fatal error (${stream.type}):`,
      recoverMediaError: () => attachment.hls.value?.recoverMediaError(),
    }))
  }

  const attach = () => {
    teardown()
    const startAt = mode.value === 'recorded' ? resumeAt : 0
    const autoplay = resumePlaying

    if (isDualSelected.value) {
      const camera = cameraVideoPlayer.value
      const screen = screenVideoPlayer.value
      const cameraStream = streamOf('camera')
      const screenStream = streamOf('screen')
      if (!camera || !screen || !cameraStream || !screenStream) return
      resumeAt = 0
      attachOne(screen, screenStream, startAt, autoplay)
      attachOne(camera, cameraStream, startAt, autoplay)
      if (attachments.length) syncLoop.start()
      return
    }

    const video = videoPlayer.value
    const stream = currentStream.value
    if (!video || !stream) return
    resumeAt = 0
    attachOne(video, stream, startAt, autoplay)
  }

  /** `<video @error>`. hls.js reports its own failures; this is for the MP4 streams. */
  const onVideoError = (event: Event) => {
    const video = event.target as HTMLVideoElement
    const attachment = attachments.find((a) => a.video === video)
    if (!attachment || attachment.hls.value || !video.error) return
    reportFatal(`media error ${video.error.code}`)
  }

  const rememberPosition = () => {
    const video = masterVideo.value
    resumeAt = video && Number.isFinite(video.currentTime) ? video.currentTime : 0
    resumePlaying = video ? !video.paused : true
  }

  const selectStream = (choice: Yanhe2StreamChoice) => {
    if (choice === selected.value || !isOffered(choice)) return
    rememberPosition()
    selected.value = choice
  }

  const activeVideos = (): HTMLVideoElement[] => attachments.map((a) => a.video)

  const setPlaybackRate = (rate: number) => {
    playbackRate.value = rate
    if (mode.value !== 'recorded') return
    for (const video of activeVideos()) video.playbackRate = rate
  }

  const togglePlayback = () => {
    const master = masterVideo.value
    if (!master) return
    if (master.paused) {
      for (const video of activeVideos()) video.play().catch(() => { /* Ignore play rejection (autoplay/buffer) */ })
    } else {
      for (const video of activeVideos()) video.pause()
    }
  }

  const seekTo = (time: number) => {
    const master = masterVideo.value
    if (!master || !Number.isFinite(master.duration) || !Number.isFinite(time)) return
    const bounded = Math.min(Math.max(time, 0), master.duration)
    for (const video of activeVideos()) video.currentTime = bounded
  }

  const load = async () => {
    const ticket = ++loadTicket
    teardown()
    loading.value = true
    problem.value = null
    playback.value = null
    selected.value = ''
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
        selected.value = pickDefault()
        if (!selected.value) {
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

  // The elements exist only once there is something to play, and the page
  // swaps between the single element and the pair with the selection.
  watch(
    [
      videoPlayer,
      cameraVideoPlayer,
      screenVideoPlayer,
      isDualSelected,
      () => currentStream.value?.url,
    ],
    attach,
  )

  // Turning developer mode off must not leave the room camera playing with its
  // option gone from the selector: fall back to screen, then camera.
  watch(streams, () => {
    if (!selected.value || isOffered(selected.value)) return
    rememberPosition()
    selected.value = pickDefault()
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
    selected,
    currentStream,
    hasDualStreams,
    isDualSelected,
    masterVideo,
    playbackRate,
    load,
    selectStream,
    setPlaybackRate,
    togglePlayback,
    seekTo,
    onVideoError,
  }
}
