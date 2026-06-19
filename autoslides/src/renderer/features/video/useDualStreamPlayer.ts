import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import Hls, { Events } from 'hls.js'
import { setupDualHlsErrorHandler } from './useVideoErrorRecovery'
import type { VideoStream, DualAudioSource } from './useVideoPlayer'
import { overrides } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('DualStreamPlayer');

/**
 * Dual-stream (camera + screen) playback subsystem extracted verbatim from
 * useVideoPlayer. Owns the two HLS instances, drift-correction sync loop, audio
 * routing, and the dual-specific event handlers. The single-stream player and
 * the cross-cutting refs (video element refs, playback rate, mute) stay in
 * useVideoPlayer and are threaded in via `deps`; behavior is unchanged.
 */
export interface DualStreamPlayerDeps {
  mode: 'live' | 'recorded'
  cameraVideoPlayer: Ref<HTMLVideoElement | null>
  screenVideoPlayer: Ref<HTMLVideoElement | null>
  currentPlaybackRate: Ref<number>
  shouldVideoMute: ComputedRef<boolean>
  isVideoMuted: Ref<boolean>
  isPlaying: Ref<boolean>
  isDualStreamSelected: ComputedRef<boolean>
  cameraStreamData: ComputedRef<VideoStream | null>
  screenStreamData: ComputedRef<VideoStream | null>
  error: Ref<string | null>
  getHlsConfig: (mode: 'live' | 'recorded') => any
  handleTaskError: (message: string) => void
  /** Tear down any single-stream HLS instance before dual sources load. */
  cleanupSingleVideoSource: () => void
  /** Shared playback-ended handler (stops the signature loop). */
  onEnded: () => Promise<void>
}

export interface UseDualStreamPlayerReturn {
  // State
  cameraHls: ShallowRef<Hls | null>
  screenHls: ShallowRef<Hls | null>
  dualAudioSource: Ref<DualAudioSource>
  dualCurrentTime: Ref<number>
  dualDuration: Ref<number>
  dualCanSeek: ComputedRef<boolean>

  // Lifecycle / control
  getDualMasterVideo: () => HTMLVideoElement | null
  cleanupDualVideoSources: () => void
  loadDualVideoSources: (seekToTime?: number, shouldAutoPlay?: boolean) => Promise<void>
  playDualStreams: () => Promise<void>
  pauseDualStreams: () => void
  toggleDualPlayback: () => Promise<void>
  seekDualStreams: (time: number) => void
  setDualAudioSource: (source: DualAudioSource) => void
  applyDualAudioState: () => void
  startDualSync: () => void

  // Event handlers
  onDualTimeUpdate: () => void
  onDualPlayStateChanged: () => void
  onDualEnded: () => Promise<void>
  preventDualUnmute: (event: Event) => void
}

export function useDualStreamPlayer(deps: DualStreamPlayerDeps): UseDualStreamPlayerReturn {
  const {
    mode,
    cameraVideoPlayer,
    screenVideoPlayer,
    currentPlaybackRate,
    shouldVideoMute,
    isVideoMuted,
    isPlaying,
    isDualStreamSelected,
    cameraStreamData,
    screenStreamData,
    error,
    getHlsConfig,
    handleTaskError,
    cleanupSingleVideoSource,
    onEnded
  } = deps

  const cameraHls = shallowRef<Hls | null>(null)
  const screenHls = shallowRef<Hls | null>(null)
  const dualAudioSource = ref<DualAudioSource>('screen')
  const dualCurrentTime = ref(0)
  const dualDuration = ref(0)

  let dualSyncInterval: ReturnType<typeof setInterval> | null = null
  let isApplyingDualAudioState = false

  const dualCanSeek = computed(() => {
    return Number.isFinite(dualDuration.value) && dualDuration.value > 0
  })

  const getDualMasterVideo = () => {
    return screenVideoPlayer.value || cameraVideoPlayer.value
  }

  const stopDualSync = () => {
    if (dualSyncInterval) {
      clearInterval(dualSyncInterval)
      dualSyncInterval = null
    }
  }

  const cleanupDualVideoSources = () => {
    stopDualSync()

    if (cameraHls.value) {
      cameraHls.value.destroy()
      cameraHls.value = null
    }

    if (screenHls.value) {
      screenHls.value.destroy()
      screenHls.value = null
    }
  }

  const applyDualAudioState = () => {
    if (isApplyingDualAudioState) return

    isApplyingDualAudioState = true
    try {
      const cameraVideo = cameraVideoPlayer.value
      const screenVideo = screenVideoPlayer.value

      if (shouldVideoMute.value) {
        if (cameraVideo) {
          cameraVideo.volume = 0
          cameraVideo.muted = false
          cameraVideo.setAttribute('data-muted-by-app', 'true')
        }
        if (screenVideo) {
          screenVideo.volume = 0
          screenVideo.muted = false
          screenVideo.setAttribute('data-muted-by-app', 'true')
        }
        isVideoMuted.value = true
        return
      }

      if (cameraVideo) {
        cameraVideo.volume = dualAudioSource.value === 'camera' ? 1 : 0
        cameraVideo.muted = false
        cameraVideo.removeAttribute('data-muted-by-app')
      }

      if (screenVideo) {
        screenVideo.volume = dualAudioSource.value === 'screen' ? 1 : 0
        screenVideo.muted = false
        screenVideo.removeAttribute('data-muted-by-app')
      }

      isVideoMuted.value = false
    } finally {
      isApplyingDualAudioState = false
    }
  }

  const setDualAudioSource = (source: DualAudioSource) => {
    dualAudioSource.value = source
    applyDualAudioState()
  }

  const updateDualPlaybackState = () => {
    const masterVideo = getDualMasterVideo()
    if (!masterVideo) {
      dualCurrentTime.value = 0
      dualDuration.value = 0
      isPlaying.value = false
      return
    }

    dualCurrentTime.value = masterVideo.currentTime || 0
    dualDuration.value = Number.isFinite(masterVideo.duration) ? masterVideo.duration : 0
    isPlaying.value = !masterVideo.paused && !masterVideo.ended
  }

  const syncDualStreams = () => {
    if (!isDualStreamSelected.value) return

    const cameraVideo = cameraVideoPlayer.value
    const screenVideo = screenVideoPlayer.value
    if (!cameraVideo || !screenVideo) return
    if (cameraVideo.readyState < 2 || screenVideo.readyState < 2) return

    if (mode === 'recorded') {
      const playbackRateNumber = Number(currentPlaybackRate.value)
      cameraVideo.playbackRate = playbackRateNumber
      screenVideo.playbackRate = playbackRateNumber
    } else {
      cameraVideo.playbackRate = 1
      screenVideo.playbackRate = 1
      currentPlaybackRate.value = 1
    }

    applyDualAudioState()

    if (!screenVideo.paused && cameraVideo.paused) {
      cameraVideo.play().catch(() => { /* Ignore sync play errors */ })
    } else if (screenVideo.paused && !cameraVideo.paused) {
      cameraVideo.pause()
    }

    const drift = Math.abs(cameraVideo.currentTime - screenVideo.currentTime)
    if (!screenVideo.paused && Number.isFinite(drift) && drift > 0.75) {
      cameraVideo.currentTime = screenVideo.currentTime
    }

    updateDualPlaybackState()
  }

  const startDualSync = () => {
    stopDualSync()
    dualSyncInterval = setInterval(syncDualStreams, 1500)
  }

  const setupDualHlsErrorHandling = (hlsInstance: Hls, video: HTMLVideoElement, label: string) => {
    setupDualHlsErrorHandler(hlsInstance, video, label, {
      mode,
      onFatal: (message) => {
        error.value = message
        handleTaskError(message)
      }
    })
  }

  const attachDualHls = (
    video: HTMLVideoElement,
    stream: VideoStream,
    hlsRef: ShallowRef<Hls | null>,
    label: string,
    seekToTime?: number,
    shouldAutoPlay?: boolean
  ) => {
    const hlsInstance = new Hls(getHlsConfig(mode))
    hlsRef.value = hlsInstance

    hlsInstance.loadSource(stream.url)
    hlsInstance.attachMedia(video)

    hlsInstance.on(Events.MANIFEST_PARSED, () => {
      setTimeout(() => {
        if (mode === 'recorded') {
          video.playbackRate = Number(currentPlaybackRate.value)
        } else {
          video.playbackRate = 1
          currentPlaybackRate.value = 1
        }

        if (seekToTime !== undefined && seekToTime > 0 && Number.isFinite(seekToTime)) {
          try {
            video.currentTime = seekToTime
          } catch (seekError) {
            log.warn(`Could not seek ${label} stream during dual load:`, seekError)
          }
        }

        applyDualAudioState()
        updateDualPlaybackState()

        if (shouldAutoPlay !== false) {
          video.play().catch(() => { /* Ignore dual autoplay error */ })
        }
      }, 100)
    })

    setupDualHlsErrorHandling(hlsInstance, video, label)
  }

  const loadDualVideoSources = async (seekToTime?: number, shouldAutoPlay?: boolean) => {
    if (overrides.playbackDemo) return // demo posters only — never load real dual sources
    const cameraVideo = cameraVideoPlayer.value
    const screenVideo = screenVideoPlayer.value
    const cameraStream = cameraStreamData.value
    const screenStream = screenStreamData.value

    if (!cameraVideo || !screenVideo || !cameraStream || !screenStream) {
      return
    }

    try {
      cleanupSingleVideoSource()
      cleanupDualVideoSources()

      if (!Hls.isSupported()) {
        throw new Error('HLS is not supported in this browser')
      }

      attachDualHls(cameraVideo, cameraStream, cameraHls, 'camera', seekToTime, shouldAutoPlay)
      attachDualHls(screenVideo, screenStream, screenHls, 'screen', seekToTime, shouldAutoPlay)
      startDualSync()
    } catch (err: any) {
      log.error('Failed to load dual video sources:', err)
      const errorMessage = 'Failed to load dual video sources: ' + err.message
      error.value = errorMessage
      handleTaskError(errorMessage)
    }
  }

  const playDualStreams = async () => {
    const cameraVideo = cameraVideoPlayer.value
    const screenVideo = screenVideoPlayer.value

    if (!cameraVideo || !screenVideo) return

    applyDualAudioState()

    try {
      await Promise.allSettled([cameraVideo.play(), screenVideo.play()])
      isPlaying.value = true
      startDualSync()
    } catch (playError) {
      log.warn('Could not start dual playback:', playError)
    }
  }

  const pauseDualStreams = () => {
    cameraVideoPlayer.value?.pause()
    screenVideoPlayer.value?.pause()
    isPlaying.value = false
  }

  const toggleDualPlayback = async () => {
    const masterVideo = getDualMasterVideo()
    if (!masterVideo) return

    if (masterVideo.paused) {
      await playDualStreams()
    } else {
      pauseDualStreams()
    }
  }

  const seekDualStreams = (time: number) => {
    if (!dualCanSeek.value || !Number.isFinite(time)) return

    const boundedTime = Math.min(Math.max(time, 0), dualDuration.value)

    if (screenVideoPlayer.value) {
      screenVideoPlayer.value.currentTime = boundedTime
    }
    if (cameraVideoPlayer.value) {
      cameraVideoPlayer.value.currentTime = boundedTime
    }

    dualCurrentTime.value = boundedTime
  }

  const onDualTimeUpdate = () => {
    updateDualPlaybackState()
  }

  const onDualPlayStateChanged = () => {
    updateDualPlaybackState()
    if (isPlaying.value) {
      startDualSync()
    }
  }

  const onDualEnded = async () => {
    pauseDualStreams()
    await onEnded()
  }

  const preventDualUnmute = (event: Event) => {
    if (isApplyingDualAudioState) return

    const target = event.target as HTMLVideoElement
    if (shouldVideoMute.value) {
      event.preventDefault()
      target.volume = 0
      target.muted = false
      return
    }

    applyDualAudioState()
  }

  return {
    cameraHls,
    screenHls,
    dualAudioSource,
    dualCurrentTime,
    dualDuration,
    dualCanSeek,
    getDualMasterVideo,
    cleanupDualVideoSources,
    loadDualVideoSources,
    playDualStreams,
    pauseDualStreams,
    toggleDualPlayback,
    seekDualStreams,
    setDualAudioSource,
    applyDualAudioState,
    startDualSync,
    onDualTimeUpdate,
    onDualPlayStateChanged,
    onDualEnded,
    preventDualUnmute
  }
}
