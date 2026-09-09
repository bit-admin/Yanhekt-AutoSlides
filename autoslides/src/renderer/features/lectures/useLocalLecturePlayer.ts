// Local lecture player: asmedia:// for on-disk files, recorded HLS for any
// stream that is not local (hybrid dual, fully online dual, or a single
// online stream). No extraction.
// Clock updates come from the video `timeupdate` event (same as Playback dual).

import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import Hls, { Events } from 'hls.js'
import { toAsmediaUrl } from '@common/asmediaUrl'
import { tokenManager } from '@shared/services/authService'
import { createWatchProgressSync } from '@shared/services/watchProgressService'
import { configStore } from '@shared/services/configStore'
import { ApiClient } from '@shared/services/apiClient'
import { getHlsConfig } from '@features/video/hlsConfig'
import { setupDualHlsErrorHandler } from '@features/video/useVideoErrorRecovery'
import { createMediaSyncLoop, syncFollower } from '@features/video/mediaSync'
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

const apiClient = new ApiClient()

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

/** `mic` is a local `.aac` (or its online counterpart) synced to the video. */
export type DualAudioSource = 'screen' | 'camera' | 'mic'

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
  /** Classroom mic track — always a follower, never the clock master. */
  const micAudioEl = shallowRef<HTMLAudioElement | null>(null)

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
  /** Proxied mic URL for a session with no local `.aac`. Null when unresolved. */
  const onlineMicUrl = ref<string | null>(null)
  const isOrderSwapped = ref(false)
  const errorMessage = ref('')
  /** Paths that failed to decode (for Open Externally). */
  const failedPaths = ref<string[]>([])
  const screenError = ref('')
  const cameraError = ref('')

  // Arrow-wrapped so the loop can be declared before syncDual exists.
  const syncLoop = createMediaSyncLoop(() => syncDual())
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
  const bindMicEl = (el: HTMLAudioElement | null) => {
    micAudioEl.value = el
  }

  const stopSync = () => {
    syncLoop.stop()
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

  const clearVideo = (video: HTMLMediaElement | null) => {
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

  /**
   * Yanhekt's saved position for this session, for local files as much as online
   * streams: the lecture is the same one either way, so watching half of it on
   * disk should still move the position the website shows. Off by default and
   * inert without a login — the whole Lectures library works signed out.
   */
  const progressSync = createWatchProgressSync({
    sessionId: () => session.value?.sessionId,
    enabled: () => configStore.resumeFromServerProgressLectures === true,
    getCurrentTime: () => masterVideo()?.currentTime ?? currentTime.value,
    isPlaying: () => isPlaying.value,
  })

  const destroy = () => {
    // First: the reset below zeroes currentTime, and stop() reports one last position.
    progressSync.stop()
    stopDemoClock()
    stopSync()
    destroyOnlineHls()
    void releaseProxyClient()
    clearVideo(screenVideoEl.value)
    clearVideo(cameraVideoEl.value)
    clearVideo(singleVideoEl.value)
    clearVideo(micAudioEl.value)
    onlineMicUrl.value = null
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
    const mic = micAudioEl.value
    const vol = isMuted.value ? 0 : Math.min(1, Math.max(0, volume.value))
    const useMic = dualAudioSource.value === 'mic' && hasMicAudio.value

    if (isDualMode.value) {
      if (screen) {
        screen.muted = false
        screen.volume = !useMic && dualAudioSource.value === 'screen' ? vol : 0
      }
      if (camera) {
        camera.muted = false
        camera.volume = !useMic && dualAudioSource.value === 'camera' ? vol : 0
      }
    } else if (single) {
      single.muted = false
      // Single mode has no screen/camera choice, so anything but mic means the
      // video's own audio.
      single.volume = useMic ? 0 : vol
    }

    if (mic) {
      mic.muted = false
      mic.volume = useMic ? vol : 0
    }
  }

  const applyRate = () => {
    const rate = playbackRate.value
    for (const v of [screenVideoEl.value, cameraVideoEl.value, singleVideoEl.value, micAudioEl.value]) {
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
    if (isPlaying.value && (isDualMode.value || hasMicAudio.value)) {
      startDualSync()
    }
  }

  /**
   * One tick for both modes. In single mode there is no slave video, but the
   * mic still has to be dragged along — which is why this runs whenever a mic
   * track is attached, not only in dual mode.
   */
  const syncDual = () => {
    const master = masterVideo()
    if (!master) return

    const slave = slaveVideo()
    const mic = micAudioEl.value
    if (!slave && !mic) return

    applyRate()
    if (slave) syncFollower(master, slave)
    if (mic) syncFollower(master, mic)
    applyAudio()
  }

  const startDualSync = () => {
    syncLoop.start()
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
    seekTo?: number,
  ) => {
    video.src = toAsmediaUrl(file.path)
    video.preload = 'metadata'
    video.playsInline = true

    const onLoaded = () => {
      applyRate()
      applyAudio()
      // A fresh `src` is never seekable yet, so the position has to land here —
      // before updateClock, or the clock would publish 0 and flicker the bar.
      if (seekTo !== undefined && seekTo > 0 && Number.isFinite(seekTo)) {
        try {
          video.currentTime = seekTo
        } catch (seekError) {
          log.warn(`Could not seek ${kind} file to ${seekTo}s:`, seekError)
        }
      }
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

    // startPosition, not just the currentTime assignment below: at MANIFEST_PARSED
    // MSE has no duration yet, so the element can clamp that seek back to 0.
    const hlsInstance = new Hls(
      seekToTime !== undefined && seekToTime > 0 && Number.isFinite(seekToTime)
        ? { ...getHlsConfig('recorded'), startPosition: seekToTime }
        : getHlsConfig('recorded'),
    )
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

  /**
   * Where the mic track comes from: the local `.aac` when one is on disk,
   * otherwise the proxied online URL once resolved.
   */
  const micSrc = computed(() => {
    const local = session.value?.audio
    if (local) return toAsmediaUrl(local.path)
    return onlineMicUrl.value
  })

  const hasMicAudio = computed(() => Boolean(micSrc.value))

  /**
   * Resolve the online mic track for a session with no local `.aac`.
   *
   * Registers a proxy client even when both videos are local: the mic still
   * streams through the local proxy (for the intranet rewrite), and the proxy
   * shuts itself down as soon as its last client unregisters — so without this
   * the audio URL would 404 the moment a fully-local session released it.
   */
  const resolveOnlineMicUrl = async (sess: LibrarySession): Promise<void> => {
    onlineMicUrl.value = null
    if (sess.audio || !sess.videoId) return

    const token = tokenManager.getToken()
    if (!token) return

    try {
      const audioUrl = await apiClient.getMicAudioUrl(String(sess.videoId), token)
      if (!audioUrl) return

      await ensureProxyClient()
      const payload = JSON.parse(JSON.stringify({
        session_id: sess.sessionId,
        video_id: sess.videoId,
        title: sess.title,
        duration: sess.duration,
        audio_url: audioUrl,
      }))
      const result = await window.electronAPI.video.getVideoPlaybackUrls(payload, token)
      onlineMicUrl.value = result.audioUrl || null
    } catch (error) {
      // A missing mic track must never break video playback.
      log.warn('Failed to resolve online mic audio', error)
    }
  }

  const attachMicAudio = (seekTo?: number, autoplay?: boolean) => {
    const mic = micAudioEl.value
    const url = micSrc.value
    if (!mic || !url) return

    if (mic.src !== url) {
      mic.src = url
      mic.preload = 'auto'
    }
    if (seekTo && seekTo > 0) {
      try {
        mic.currentTime = seekTo
      } catch {
        /* seek after metadata */
      }
    }
    applyAudio()
    applyRate()
    if (autoplay) {
      void mic.play().catch(() => undefined)
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
      wireElement(video, file, 'single', seekTo)
      applyAudio()
      applyRate()
      // A file already carrying metadata (a re-attach) can seek right away; a
      // fresh one is handled by wireElement's loadedmetadata handler.
      if (seekTo && seekTo > 0 && video.readyState >= 1) {
        try {
          video.currentTime = seekTo
        } catch {
          /* seek after metadata */
        }
      }
      attachMicAudio(seekTo, autoplay)
      if (autoplay) {
        await video.play().catch(() => undefined)
        isPlaying.value = !video.paused
      }
      if (hasMicAudio.value) startDualSync()
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
    attachMicAudio(seekTo, autoplay)
    if (hasMicAudio.value) startDualSync()
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

    // Resolve before the release decision below, which reads onlineMicUrl.
    if (!overrides.playbackDemo) {
      await resolveOnlineMicUrl(sess)
    }

    // Keep the proxy alive when the mic streams online, even if both videos
    // are local — the mic rides the same proxy.
    if (!needsOnline && !onlineMicUrl.value) {
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
          wireElement(screen, sess.screen, 'screen', seekTo)
        } else {
          attachOnlineHls(screen, streams!.screen!, 'screen', seekTo, autoplay)
        }
        if (sess.camera) {
          wireElement(camera, sess.camera, 'camera', seekTo)
        } else {
          attachOnlineHls(camera, streams!.camera!, 'camera', seekTo, autoplay)
        }
        applyAudio()
        applyRate()
        attachMicAudio(seekTo, autoplay)
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
    const resumeAt = await progressSync.resume()
    await attachSources(autoplay, resumeAt ?? undefined)
    progressSync.start()
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
    // A mic file on disk was downloaded on purpose, so it wins by default —
    // deliberately NOT gated on the app-wide "mic by default" setting, which
    // governs online playback only. An online-only mic does not auto-select.
    if (sess.audio) {
      dualAudioSource.value = 'mic'
      return
    }
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
    const mic = micAudioEl.value
    if (isDualMode.value) {
      await Promise.allSettled([
        screenVideoEl.value?.play() ?? Promise.resolve(),
        cameraVideoEl.value?.play() ?? Promise.resolve(),
        mic?.play() ?? Promise.resolve(),
      ])
      startDualSync()
    } else {
      await singleVideoEl.value?.play().catch(() => undefined)
      if (mic) {
        void mic.play().catch(() => undefined)
        startDualSync()
      }
    }
    updateClock()
  }

  const pause = () => {
    stopDemoClock()
    stopSync()
    screenVideoEl.value?.pause()
    cameraVideoEl.value?.pause()
    singleVideoEl.value?.pause()
    micAudioEl.value?.pause()
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

    const applySeek = (video: HTMLMediaElement | null) => {
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
          if (isPlaying.value && (isDualMode.value || hasMicAudio.value)) startDualSync()
        }, 250)
      }
    } else {
      applySeek(singleVideoEl.value)
    }
    applySeek(micAudioEl.value)

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
    hasMicAudio,
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
    bindMicEl,
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
