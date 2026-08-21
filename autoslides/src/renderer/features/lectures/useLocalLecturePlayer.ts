// Local lecture player: asmedia:// for on-disk files, recorded HLS for any
// stream that is not local (hybrid dual, fully online dual, or a single
// online stream). No extraction.
// Clock updates come from the video `timeupdate` event (same as Playback dual).

import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import Hls, { Events } from 'hls.js'
import { toAsmediaUrl } from '@common/asmediaUrl'
import { tokenManager } from '@shared/services/authService'
import { getHlsConfig } from '@features/video/hlsConfig'
import { setupDualHlsErrorHandler } from '@features/video/useVideoErrorRecovery'
import type { LibraryFileRef, LibrarySession, LocalStreamMode } from './libraryModel'
import {
  canPlayCamera,
  canPlayScreen,
  canShowDual,
  defaultStreamMode,
  hybridOnlineKind,
  sessionHasDual,
} from './libraryModel'
import { overrides } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LocalLecturePlayer')

const DRIFT_THRESHOLD_S = 0.75
const SYNC_INTERVAL_MS = 1500
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export type DualAudioSource = 'screen' | 'camera'

function findStreamUrl(
  streams: { [key: string]: { type: string; url: string } },
  type: 'camera' | 'screen',
): string | null {
  const match = Object.values(streams).find((stream) => stream.type === type)
  return match?.url || null
}

export function useLocalLecturePlayer() {
  const screenVideoEl = shallowRef<HTMLVideoElement | null>(null)
  const cameraVideoEl = shallowRef<HTMLVideoElement | null>(null)
  const singleVideoEl = shallowRef<HTMLVideoElement | null>(null)

  const session = ref<LibrarySession | null>(null)
  const streamMode = ref<LocalStreamMode>('screen')
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isMuted = ref(false)
  const playbackRate = ref(1)
  const dualAudioSource = ref<DualAudioSource>('screen')
  const isOrderSwapped = ref(false)
  const errorMessage = ref('')
  /** Paths that failed to decode (for Open Externally). */
  const failedPaths = ref<string[]>([])
  const screenError = ref('')
  const cameraError = ref('')

  let syncTimer: ReturnType<typeof setInterval> | null = null
  const onlineHls = new Map<string, Hls>()
  let proxyClientId: string | null = null
  let demoClockTimer: ReturnType<typeof setInterval> | null = null
  const DEMO_DURATION_S = 5400

  const onlineKind = computed(() => (session.value ? hybridOnlineKind(session.value) : null))
  const hasLocalDual = computed(() => Boolean(session.value && sessionHasDual(session.value)))
  const hasDual = computed(() => Boolean(session.value && canShowDual(session.value)))
  const isDualMode = computed(() => streamMode.value === 'dual' && hasDual.value)
  const isHybridDual = computed(() => isDualMode.value && onlineKind.value != null)
  const canSeek = computed(() => Number.isFinite(duration.value) && duration.value > 0)
  const playbackRateOptions = PLAYBACK_RATES

  /** CSS fill for .dual-seek track — same formula as PlaybackPage dualSeekProgress. */
  const seekProgress = computed(() => {
    if (!canSeek.value || duration.value <= 0) return '0%'
    const progress = (currentTime.value / duration.value) * 100
    return `${Math.min(100, Math.max(0, progress))}%`
  })

  const volumeProgress = computed(() => {
    const v = isMuted.value ? 0 : volume.value
    return `${Math.min(100, Math.max(0, v * 100))}%`
  })

  const effectiveVolume = computed(() => (isMuted.value ? 0 : volume.value))

  const activeSingleFile = computed<LibraryFileRef | null>(() => {
    if (!session.value) return null
    if (streamMode.value === 'camera') return session.value.camera || null
    if (streamMode.value === 'screen') return session.value.screen || null
    return session.value.screen || session.value.camera || null
  })

  const bindScreenEl = (el: HTMLVideoElement | null) => {
    screenVideoEl.value = el
  }
  const bindCameraEl = (el: HTMLVideoElement | null) => {
    cameraVideoEl.value = el
  }
  const bindSingleEl = (el: HTMLVideoElement | null) => {
    singleVideoEl.value = el
  }

  const stopSync = () => {
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
  }

  const stopDemoClock = () => {
    if (demoClockTimer) {
      clearInterval(demoClockTimer)
      demoClockTimer = null
    }
  }

  const startDemoClock = () => {
    stopDemoClock()
    demoClockTimer = setInterval(() => {
      const next = currentTime.value + 0.25 * playbackRate.value
      if (next >= duration.value) {
        currentTime.value = duration.value
        isPlaying.value = false
        stopDemoClock()
        return
      }
      currentTime.value = next
    }, 250)
  }

  const applyDemoPosters = () => {
    const demo = overrides.playbackDemo
    if (!demo) return
    const screenPoster = demo.poster('screen')
    const cameraPoster = demo.poster('camera')
    if (screenVideoEl.value) screenVideoEl.value.poster = screenPoster
    if (cameraVideoEl.value) cameraVideoEl.value.poster = cameraPoster
    if (singleVideoEl.value) {
      singleVideoEl.value.poster = streamMode.value === 'camera' ? cameraPoster : screenPoster
    }
  }

  const attachDemo = (autoplay: boolean, seekTo?: number) => {
    applyDemoPosters()
    duration.value = DEMO_DURATION_S
    const start =
      seekTo != null && Number.isFinite(seekTo) && seekTo > 0
        ? Math.min(seekTo, DEMO_DURATION_S)
        : currentTime.value || 0
    currentTime.value = start
    isLoading.value = false
    errorMessage.value = ''
    failedPaths.value = []
    screenError.value = ''
    cameraError.value = ''
    if (autoplay) {
      isPlaying.value = true
      startDemoClock()
    } else {
      isPlaying.value = false
      stopDemoClock()
    }
  }

  const clearVideo = (video: HTMLVideoElement | null) => {
    if (!video) return
    try {
      video.pause()
      video.removeAttribute('src')
      video.load()
    } catch {
      /* ignore */
    }
  }

  const destroyOnlineHls = (slot?: string) => {
    const keys = slot ? [slot] : [...onlineHls.keys()]
    for (const key of keys) {
      const inst = onlineHls.get(key)
      if (!inst) continue
      try {
        inst.destroy()
      } catch (error) {
        log.warn('HLS destroy failed', error)
      }
      onlineHls.delete(key)
    }
  }

  const releaseProxyClient = async () => {
    if (!proxyClientId) return
    const id = proxyClientId
    proxyClientId = null
    try {
      await window.electronAPI.video.unregisterClient(id)
    } catch (error) {
      log.warn('unregisterClient failed', error)
    }
  }

  const ensureProxyClient = async () => {
    if (proxyClientId) return
    proxyClientId = await window.electronAPI.video.registerClient()
  }

  const destroy = () => {
    stopDemoClock()
    stopSync()
    destroyOnlineHls()
    void releaseProxyClient()
    clearVideo(screenVideoEl.value)
    clearVideo(cameraVideoEl.value)
    clearVideo(singleVideoEl.value)
    isPlaying.value = false
    isLoading.value = false
    currentTime.value = 0
    duration.value = 0
    errorMessage.value = ''
    failedPaths.value = []
    screenError.value = ''
    cameraError.value = ''
    session.value = null
  }

  /** Local file is the clock master in hybrid dual; screen is master for local dual. */
  const masterVideo = (): HTMLVideoElement | null => {
    if (isDualMode.value) {
      if (onlineKind.value === 'camera') return screenVideoEl.value
      if (onlineKind.value === 'screen') return cameraVideoEl.value
      return screenVideoEl.value || cameraVideoEl.value
    }
    return singleVideoEl.value
  }

  const slaveVideo = (): HTMLVideoElement | null => {
    if (!isDualMode.value) return null
    if (onlineKind.value === 'camera') return cameraVideoEl.value
    if (onlineKind.value === 'screen') return screenVideoEl.value
    return cameraVideoEl.value
  }

  const applyAudio = () => {
    const screen = screenVideoEl.value
    const camera = cameraVideoEl.value
    const single = singleVideoEl.value
    const vol = isMuted.value ? 0 : Math.min(1, Math.max(0, volume.value))

    if (isDualMode.value) {
      if (screen) {
        screen.muted = false
        screen.volume = dualAudioSource.value === 'screen' ? vol : 0
      }
      if (camera) {
        camera.muted = false
        camera.volume = dualAudioSource.value === 'camera' ? vol : 0
      }
    } else if (single) {
      single.muted = false
      single.volume = vol
    }
  }

  const applyRate = () => {
    const rate = playbackRate.value
    for (const v of [screenVideoEl.value, cameraVideoEl.value, singleVideoEl.value]) {
      if (v) v.playbackRate = rate
    }
  }

  /** Mirror Playback dual clock: driven by @timeupdate on the video elements. */
  const updateClock = () => {
    const master = masterVideo()
    if (!master) return
    currentTime.value = master.currentTime || 0
    if (Number.isFinite(master.duration) && master.duration > 0) {
      duration.value = master.duration
    }
    isPlaying.value = !master.paused && !master.ended
  }

  const onTimeUpdate = () => {
    updateClock()
  }

  const onPlayStateChanged = () => {
    updateClock()
    if (isPlaying.value && isDualMode.value) {
      startDualSync()
    }
  }

  const syncDual = () => {
    const master = masterVideo()
    const slave = slaveVideo()
    if (!master || !slave) return

    applyRate()
    const drift = Math.abs((master.currentTime || 0) - (slave.currentTime || 0))
    if (drift > DRIFT_THRESHOLD_S) {
      try {
        slave.currentTime = master.currentTime
      } catch (error) {
        log.warn('Dual drift seek failed', error)
      }
    }
    if (!master.paused && slave.paused) {
      void slave.play().catch(() => undefined)
    }
    if (master.paused && !slave.paused) {
      slave.pause()
    }
    applyAudio()
  }

  const startDualSync = () => {
    stopSync()
    syncTimer = setInterval(syncDual, SYNC_INTERVAL_MS)
  }

  const onVideoError = (kind: 'screen' | 'camera' | 'single', file?: LibraryFileRef) => {
    const msg = 'Failed to decode this video in-app (codec may be unsupported).'
    if (kind === 'screen') screenError.value = msg
    if (kind === 'camera') cameraError.value = msg
    if (file?.path && !failedPaths.value.includes(file.path)) {
      failedPaths.value = [...failedPaths.value, file.path]
    }
    if (
      kind === 'single'
      || isDualMode.value
      || (screenError.value && cameraError.value)
    ) {
      errorMessage.value = msg
    }
    log.warn('Local video error', kind, file?.path)
  }

  const wireElement = (
    video: HTMLVideoElement,
    file: LibraryFileRef,
    kind: 'screen' | 'camera' | 'single',
  ) => {
    video.src = toAsmediaUrl(file.path)
    video.preload = 'metadata'
    video.playsInline = true

    const onLoaded = () => {
      applyRate()
      applyAudio()
      updateClock()
      isLoading.value = false
    }
    const onErr = () => onVideoError(kind, file)

    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onErr, { once: true })
  }

  const attachOnlineHls = (
    video: HTMLVideoElement,
    url: string,
    label: 'screen' | 'camera',
    seekToTime?: number,
    shouldAutoPlay?: boolean,
    slot?: string,
  ) => {
    const key = slot || label
    destroyOnlineHls(key)
    if (!Hls.isSupported()) {
      throw new Error('HLS is not supported in this browser')
    }

    const hlsInstance = new Hls(getHlsConfig('recorded'))
    onlineHls.set(key, hlsInstance)
    hlsInstance.loadSource(url)
    hlsInstance.attachMedia(video)

    hlsInstance.on(Events.MANIFEST_PARSED, () => {
      setTimeout(() => {
        video.playbackRate = playbackRate.value
        if (seekToTime !== undefined && seekToTime > 0 && Number.isFinite(seekToTime)) {
          try {
            video.currentTime = seekToTime
          } catch (seekError) {
            log.warn(`Could not seek ${label} stream during online load:`, seekError)
          }
        }
        applyAudio()
        updateClock()
        isLoading.value = false
        if (shouldAutoPlay !== false) {
          video.play().catch(() => undefined)
        }
      }, 100)
    })

    setupDualHlsErrorHandler(hlsInstance, video, label, {
      mode: 'recorded',
      onFatal: (message) => {
        if (label === 'screen') screenError.value = message
        if (label === 'camera') cameraError.value = message
        errorMessage.value = message
        log.warn('Online HLS fatal', label, message)
      },
    })
  }

  const waitForElements = async (dual: boolean, attempts = 12): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      if (dual) {
        if (screenVideoEl.value && cameraVideoEl.value) return true
      } else if (singleVideoEl.value) {
        return true
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    return dual
      ? Boolean(screenVideoEl.value && cameraVideoEl.value)
      : Boolean(singleVideoEl.value)
  }

  const resolvePlaybackStreams = async (
    sess: LibrarySession,
  ): Promise<{ camera: string | null; screen: string | null }> => {
    const token = tokenManager.getToken()
    if (!token) {
      errorMessage.value = 'Sign in to play the online stream.'
      return { camera: null, screen: null }
    }

    const payload = JSON.parse(JSON.stringify({
      session_id: sess.sessionId,
      video_id: sess.videoId,
      title: sess.title,
      duration: sess.duration,
      main_url: sess.mainUrl,
      vga_url: sess.vgaUrl,
    }))

    await ensureProxyClient()
    const result = await window.electronAPI.video.getVideoPlaybackUrls(payload, token)
    return {
      camera: findStreamUrl(result.streams, 'camera'),
      screen: findStreamUrl(result.streams, 'screen'),
    }
  }

  const attachSingle = async (autoplay: boolean, seekTo?: number) => {
    const sess = session.value
    const video = singleVideoEl.value
    if (!sess || !video) {
      isLoading.value = false
      return
    }
    const kind: 'screen' | 'camera' = streamMode.value === 'camera' ? 'camera' : 'screen'
    const file = kind === 'camera' ? sess.camera : sess.screen
    clearVideo(video)
    if (file) {
      wireElement(video, file, 'single')
      applyAudio()
      applyRate()
      if (seekTo && seekTo > 0) {
        try {
          if (video.readyState >= 1) video.currentTime = seekTo
        } catch {
          /* seek after metadata */
        }
      }
      if (autoplay) {
        await video.play().catch(() => undefined)
        isPlaying.value = !video.paused
      }
      return
    }

    const streams = await resolvePlaybackStreams(sess)
    const url = kind === 'camera' ? streams.camera : streams.screen
    if (!url) {
      if (!errorMessage.value) {
        errorMessage.value = 'Online stream is not available for this lecture.'
      }
      isLoading.value = false
      await releaseProxyClient()
      return
    }
    attachOnlineHls(video, url, kind, seekTo, autoplay, 'single')
    applyAudio()
    applyRate()
  }

  const attachSources = async (autoplay: boolean, seekTo?: number, keepError = false) => {
    isLoading.value = true
    if (!keepError) errorMessage.value = ''
    failedPaths.value = []
    screenError.value = ''
    cameraError.value = ''
    stopSync()
    destroyOnlineHls()

    const sess = session.value
    if (!sess) {
      isLoading.value = false
      await releaseProxyClient()
      return
    }

    const wantDual = streamMode.value === 'dual' && canPlayScreen(sess) && canPlayCamera(sess)
    if (streamMode.value === 'dual' && !wantDual) {
      streamMode.value = defaultStreamMode(sess)
    }
    const playDual = streamMode.value === 'dual' && canPlayScreen(sess) && canPlayCamera(sess)
    const needsOnline = playDual
      ? !sess.screen || !sess.camera
      : streamMode.value === 'camera'
        ? !sess.camera
        : !sess.screen

    if (!needsOnline) {
      await releaseProxyClient()
    }

    const ready = await waitForElements(playDual)
    if (!ready) {
      isLoading.value = false
      log.warn('Video elements not ready for attach')
      return
    }

    if (overrides.playbackDemo) {
      attachDemo(autoplay, seekTo)
      return
    }

    const fallbackSingle = (): LocalStreamMode | null => {
      if (sess.screen || sess.vgaUrl) return 'screen'
      if (sess.camera || sess.mainUrl) return 'camera'
      return null
    }

    try {
      if (playDual) {
        const screen = screenVideoEl.value
        const camera = cameraVideoEl.value
        if (!screen || !camera) {
          isLoading.value = false
          return
        }

        let streams: { camera: string | null; screen: string | null } | null = null
        if (!sess.screen || !sess.camera) {
          streams = await resolvePlaybackStreams(sess)
          if ((!sess.screen && !streams.screen) || (!sess.camera && !streams.camera)) {
            const fallback = fallbackSingle()
            if (fallback && !keepError) {
              streamMode.value = fallback
              await releaseProxyClient()
              await attachSources(autoplay, seekTo, true)
              return
            }
            if (!errorMessage.value) {
              errorMessage.value = 'Online stream is not available for this lecture.'
            }
            isLoading.value = false
            return
          }
        }

        clearVideo(screen)
        clearVideo(camera)
        if (sess.screen) {
          wireElement(screen, sess.screen, 'screen')
        } else {
          attachOnlineHls(screen, streams!.screen!, 'screen', seekTo, autoplay)
        }
        if (sess.camera) {
          wireElement(camera, sess.camera, 'camera')
        } else {
          attachOnlineHls(camera, streams!.camera!, 'camera', seekTo, autoplay)
        }
        applyAudio()
        applyRate()
        startDualSync()
        if (autoplay) {
          const master = masterVideo()
          if (master) {
            await master.play().catch(() => undefined)
            isPlaying.value = !master.paused
          }
        }
      } else {
        await attachSingle(autoplay, seekTo)
      }
    } catch (error) {
      log.error('attachSources failed', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
      isLoading.value = false
      if (needsOnline && !keepError) {
        const fallback = fallbackSingle()
        if (fallback && fallback !== streamMode.value) {
          streamMode.value = fallback
          await releaseProxyClient()
          await attachSources(autoplay, seekTo, true)
        }
      }
    }
  }

  const open = async (next: LibrarySession, mode?: LocalStreamMode, autoplay = true) => {
    session.value = next
    streamMode.value = mode || defaultStreamMode(next)
    setDualAudioForMode(streamMode.value, next)
    currentTime.value = 0
    duration.value = 0
    await attachSources(autoplay)
  }

  const syncSession = (next: LibrarySession) => {
    if (!session.value || session.value.sessionId !== next.sessionId) return
    const prev = session.value
    session.value = next
    const gainedBothUrls =
      !prev.mainUrl
      && !prev.vgaUrl
      && Boolean(next.mainUrl && next.vgaUrl)
      && !next.screen
      && !next.camera
    if (gainedBothUrls && !overrides.playbackDemo) {
      streamMode.value = 'dual'
      setDualAudioForMode('dual', next)
      void attachSources(true, currentTime.value)
      return
    }
    const gainedUrl =
      (!prev.mainUrl && Boolean(next.mainUrl)) || (!prev.vgaUrl && Boolean(next.vgaUrl))
    if (gainedUrl && !next.screen && !next.camera && !overrides.playbackDemo) {
      void attachSources(isPlaying.value, currentTime.value)
    }
  }

  const setDualAudioForMode = (mode: LocalStreamMode, sess: LibrarySession) => {
    if (mode === 'camera') {
      dualAudioSource.value = 'camera'
      return
    }
    if (mode === 'screen') {
      dualAudioSource.value = 'screen'
      return
    }
    const kind = hybridOnlineKind(sess)
    if (kind === 'camera') dualAudioSource.value = 'screen'
    else if (kind === 'screen') dualAudioSource.value = 'camera'
    else dualAudioSource.value = sess.screen || sess.vgaUrl ? 'screen' : 'camera'
  }

  const setStreamMode = async (mode: LocalStreamMode) => {
    if (streamMode.value === mode) return
    const t = currentTime.value
    const wasPlaying = isPlaying.value
    streamMode.value = mode
    if (session.value) setDualAudioForMode(mode, session.value)
    await attachSources(wasPlaying, t)
    if (t > 0) seek(t)
  }

  const play = async () => {
    if (overrides.playbackDemo) {
      if (!(duration.value > 0)) duration.value = DEMO_DURATION_S
      isPlaying.value = true
      startDemoClock()
      return
    }
    applyAudio()
    if (isDualMode.value) {
      await Promise.allSettled([
        screenVideoEl.value?.play() ?? Promise.resolve(),
        cameraVideoEl.value?.play() ?? Promise.resolve(),
      ])
      startDualSync()
    } else {
      await singleVideoEl.value?.play().catch(() => undefined)
    }
    updateClock()
  }

  const pause = () => {
    stopDemoClock()
    stopSync()
    screenVideoEl.value?.pause()
    cameraVideoEl.value?.pause()
    singleVideoEl.value?.pause()
    isPlaying.value = false
  }

  const togglePlay = async () => {
    if (isPlaying.value) pause()
    else await play()
  }

  const seek = (time: number) => {
    if (!Number.isFinite(time)) return

    if (overrides.playbackDemo) {
      if (!(duration.value > 0)) duration.value = DEMO_DURATION_S
      currentTime.value = Math.min(Math.max(time, 0), Math.max(0, duration.value - 0.05))
      return
    }

    // Prefer the live media duration (more accurate than our last clock sample).
    const master = masterVideo()
    const mediaDuration =
      master && Number.isFinite(master.duration) && master.duration > 0
        ? master.duration
        : duration.value

    if (!(mediaDuration > 0)) {
      // Not seekable yet — ignore rather than clamp to 0 and snap the UI.
      return
    }

    const bounded = Math.min(Math.max(time, 0), Math.max(0, mediaDuration - 0.05))

    // Pause dual drift correction while both elements catch the new position;
    // otherwise a lagging slave can yank the master back via sync.
    stopSync()

    const applySeek = (video: HTMLVideoElement | null) => {
      if (!video) return
      // HAVE_METADATA is enough — do NOT clamp to video.seekable.
      // Progressive download often reports seekable as only the buffered prefix
      // until Range responses expand it; clamping there snaps seeks back near 0.
      if (!(video.readyState >= 1)) return
      try {
        video.currentTime = bounded
      } catch (error) {
        log.warn('seek failed on element', error)
      }
    }

    if (isDualMode.value) {
      applySeek(masterVideo())
      applySeek(slaveVideo())
      if (isPlaying.value) {
        setTimeout(() => {
          if (isPlaying.value && isDualMode.value) startDualSync()
        }, 250)
      }
    } else {
      applySeek(singleVideoEl.value)
    }

    // Optimistic UI — timeupdate will correct once the Range body arrives.
    currentTime.value = bounded
    if (mediaDuration > 0) duration.value = mediaDuration
  }

  const setVolume = (value: number) => {
    volume.value = Math.min(1, Math.max(0, value))
    if (volume.value > 0) isMuted.value = false
    applyAudio()
  }

  const toggleMute = () => {
    isMuted.value = !isMuted.value
    applyAudio()
  }

  const setPlaybackRate = (rate: number) => {
    playbackRate.value = rate
    applyRate()
  }

  const setDualAudioSource = (source: DualAudioSource) => {
    dualAudioSource.value = source
    applyAudio()
  }

  const toggleOrder = () => {
    isOrderSwapped.value = !isOrderSwapped.value
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    session: session as Ref<LibrarySession | null>,
    streamMode,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    effectiveVolume,
    playbackRate,
    playbackRateOptions,
    dualAudioSource,
    isOrderSwapped,
    errorMessage,
    failedPaths,
    screenError,
    cameraError,
    hasDual,
    hasLocalDual,
    isDualMode,
    isHybridDual,
    onlineKind,
    canSeek,
    seekProgress,
    volumeProgress,
    activeSingleFile,
    bindScreenEl,
    bindCameraEl,
    bindSingleEl,
    open,
    syncSession,
    setStreamMode,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    setDualAudioSource,
    toggleOrder,
    destroy,
    applyAudio,
    onTimeUpdate,
    onPlayStateChanged,
  }
}
