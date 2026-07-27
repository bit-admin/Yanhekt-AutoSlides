// Progressive local dual/single player for Lectures Library.
// Uses asmedia:// URLs — no hls.js, no video proxy, no extraction.
// Clock updates come from the video `timeupdate` event (same as Playback dual).

import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import { toAsmediaUrl } from '@common/asmediaUrl'
import type { LibraryFileRef, LibrarySession, LocalStreamMode } from './libraryModel'
import { defaultStreamMode } from './libraryModel'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LocalLecturePlayer')

const DRIFT_THRESHOLD_S = 0.75
const SYNC_INTERVAL_MS = 1500
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export type DualAudioSource = 'screen' | 'camera'

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

  const hasDual = computed(() => Boolean(session.value?.screen && session.value?.camera))
  const isDualMode = computed(() => streamMode.value === 'dual' && hasDual.value)
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
    if (streamMode.value === 'camera') return session.value.camera || session.value.screen || null
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

  const destroy = () => {
    stopSync()
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

  const masterVideo = (): HTMLVideoElement | null => {
    if (isDualMode.value) {
      return screenVideoEl.value || cameraVideoEl.value
    }
    return singleVideoEl.value
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
    const screen = screenVideoEl.value
    const camera = cameraVideoEl.value
    if (!screen || !camera) return

    applyRate()
    const drift = Math.abs((screen.currentTime || 0) - (camera.currentTime || 0))
    if (drift > DRIFT_THRESHOLD_S) {
      try {
        camera.currentTime = screen.currentTime
      } catch (error) {
        log.warn('Dual drift seek failed', error)
      }
    }
    if (!screen.paused && camera.paused) {
      void camera.play().catch(() => undefined)
    }
    if (screen.paused && !camera.paused) {
      camera.pause()
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

  const attachSources = async (autoplay: boolean) => {
    isLoading.value = true
    errorMessage.value = ''
    failedPaths.value = []
    screenError.value = ''
    cameraError.value = ''
    stopSync()

    const sess = session.value
    if (!sess) {
      isLoading.value = false
      return
    }

    const wantDual = streamMode.value === 'dual' && Boolean(sess.screen && sess.camera)
    const ready = await waitForElements(wantDual)
    if (!ready) {
      isLoading.value = false
      log.warn('Video elements not ready for attach')
      return
    }

    if (wantDual) {
      clearVideo(screenVideoEl.value)
      clearVideo(cameraVideoEl.value)
    } else {
      clearVideo(singleVideoEl.value)
    }

    try {
      if (wantDual && sess.screen && sess.camera) {
        const screen = screenVideoEl.value
        const camera = cameraVideoEl.value
        if (!screen || !camera) {
          isLoading.value = false
          return
        }
        wireElement(screen, sess.screen, 'screen')
        wireElement(camera, sess.camera, 'camera')
        applyAudio()
        applyRate()
        startDualSync()
        if (autoplay) {
          await Promise.allSettled([screen.play(), camera.play()])
          isPlaying.value = !screen.paused
        }
      } else {
        const file = activeSingleFile.value
        const video = singleVideoEl.value
        if (!file || !video) {
          isLoading.value = false
          return
        }
        wireElement(video, file, 'single')
        applyAudio()
        applyRate()
        if (autoplay) {
          await video.play().catch(() => undefined)
          isPlaying.value = !video.paused
        }
      }
    } catch (error) {
      log.error('attachSources failed', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
      isLoading.value = false
    }
  }

  const open = async (next: LibrarySession, mode?: LocalStreamMode, autoplay = true) => {
    session.value = next
    streamMode.value = mode || defaultStreamMode(next)
    dualAudioSource.value = next.screen ? 'screen' : 'camera'
    currentTime.value = 0
    duration.value = 0
    await attachSources(autoplay)
  }

  const setStreamMode = async (mode: LocalStreamMode) => {
    if (streamMode.value === mode) return
    const t = currentTime.value
    const wasPlaying = isPlaying.value
    streamMode.value = mode
    await attachSources(wasPlaying)
    if (t > 0) seek(t)
  }

  const play = async () => {
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

    // Master first (screen when dual), then the other stream.
    if (isDualMode.value) {
      applySeek(screenVideoEl.value)
      applySeek(cameraVideoEl.value)
      // Restart sync after both have accepted the seek target.
      if (isPlaying.value) {
        // Delay slightly so both elements fire seeked before drift checks.
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
    isDualMode,
    canSeek,
    seekProgress,
    volumeProgress,
    activeSingleFile,
    bindScreenEl,
    bindCameraEl,
    bindSingleEl,
    open,
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
