import { ref, shallowRef, computed, nextTick, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import Hls, { Events, ErrorTypes, ErrorDetails } from 'hls.js'
import { DataStore } from '../services/dataStore'
import { TokenManager } from '../services/authService'
import type { SlideExtractor } from '../services/slideExtractor'

export const DUAL_STREAM_KEY = '__dual__'
export type DualAudioSource = 'screen' | 'camera'

// Types for video player
export interface VideoStream {
  type: 'camera' | 'screen'
  name: string
  url: string
  original_url: string
}

export interface PlaybackData {
  session_id?: string
  stream_id?: string
  video_id?: string
  title: string
  duration?: string
  streams: { [key: string]: VideoStream }
}

// Session input type matching the video proxy service
export interface SessionInput {
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string | number;
  main_url?: string;
  vga_url?: string;
}

export interface UseVideoPlayerOptions {
  mode: 'live' | 'recorded'
  streamId?: string
  session: Ref<SessionInput | null>
  slideExtractorInstance: Ref<SlideExtractor | null>
  onTaskError?: (message: string) => void
}

export interface UseVideoPlayerReturn {
  // State
  loading: Ref<boolean>
  error: Ref<string | null>
  playbackData: Ref<PlaybackData | null>
  selectedStream: Ref<string>
  isPlaying: Ref<boolean>
  videoPlayer: Ref<HTMLVideoElement | null>
  cameraVideoPlayer: Ref<HTMLVideoElement | null>
  screenVideoPlayer: Ref<HTMLVideoElement | null>
  hls: ShallowRef<Hls | null>
  currentPlaybackRate: Ref<number>
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>
  isVideoMuted: Ref<boolean>
  isRetrying: Ref<boolean>
  retryMessage: Ref<string>
  maxVideoErrorRetries: Ref<number>
  videoProxyClientId: Ref<string | null>
  dualAudioSource: Ref<DualAudioSource>
  dualCurrentTime: Ref<number>
  dualDuration: Ref<number>

  // Computed
  shouldVideoMute: ComputedRef<boolean>
  isScreenRecordingSelected: ComputedRef<boolean>
  isDualStreamSelected: ComputedRef<boolean>
  hasDualStreams: ComputedRef<boolean>
  currentStreamData: ComputedRef<VideoStream | null>
  cameraStreamData: ComputedRef<VideoStream | null>
  screenStreamData: ComputedRef<VideoStream | null>
  dualCanSeek: ComputedRef<boolean>
  showSpeedWarning: ComputedRef<boolean>

  // Error tracking state
  videoErrorRetryCount: number
  consecutiveErrorsAtSamePosition: number
  lastErrorPosition: number
  lastPlaybackPosition: number
  wasPlayingBeforeError: boolean
  lastPlaybackRateBeforeError: number
  isHlsRecovering: boolean

  // Methods
  loadVideoStreams: () => Promise<void>
  loadVideoSource: () => Promise<void>
  loadVideoSourceWithPosition: (seekToTime?: number, shouldAutoPlay?: boolean) => Promise<void>
  loadDualVideoSources: (seekToTime?: number, shouldAutoPlay?: boolean) => Promise<void>
  switchStream: () => Promise<void>
  retryLoad: () => void
  changePlaybackRate: () => void
  toggleDualPlayback: () => Promise<void>
  playDualStreams: () => Promise<void>
  pauseDualStreams: () => void
  seekDualStreams: (time: number) => void
  setDualAudioSource: (source: DualAudioSource) => void
  applyDualAudioState: () => void
  cleanup: () => void
  getHlsConfig: (mode: 'live' | 'recorded') => object
  createSerializableCopy: (obj: any) => any

  // Event handlers
  onLoadStart: () => void
  onLoadedMetadata: () => void
  onVideoError: (event: Event) => Promise<void>
  onCanPlay: () => void
  onEnded: () => Promise<void>
  preventUnmute: (event: Event) => void
  onDualTimeUpdate: () => void
  onDualPlayStateChanged: () => void
  onDualEnded: () => Promise<void>
  preventDualUnmute: (event: Event) => void

  // Utility
  resetErrorCounters: () => void
  initConfig: () => Promise<void>
  registerClient: () => Promise<void>
  unregisterClient: () => Promise<void>
}

export function useVideoPlayer(options: UseVideoPlayerOptions) {
  const { mode, streamId, session, slideExtractorInstance, onTaskError } = options

  // TokenManager instance
  const tokenManager = new TokenManager()

  // Reactive state
  const loading = ref(true)
  const error = ref<string | null>(null)
  const playbackData = ref<PlaybackData | null>(null)
  const selectedStream = ref<string>('')
  const isPlaying = ref(false)
  const videoPlayer = ref<HTMLVideoElement | null>(null)
  const cameraVideoPlayer = ref<HTMLVideoElement | null>(null)
  const screenVideoPlayer = ref<HTMLVideoElement | null>(null)
  const hls = shallowRef<Hls | null>(null)
  const cameraHls = shallowRef<Hls | null>(null)
  const screenHls = shallowRef<Hls | null>(null)
  const currentPlaybackRate = ref(1)
  const connectionMode = ref<'internal' | 'external'>('external')
  const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
  const isVideoMuted = ref(false)
  const videoProxyClientId = ref<string | null>(null)
  const isRetrying = ref(false)
  const retryMessage = ref('')
  const maxVideoErrorRetries = ref(5)
  const dualAudioSource = ref<DualAudioSource>('screen')
  const dualCurrentTime = ref(0)
  const dualDuration = ref(0)

  // Error tracking state (non-reactive for performance)
  let videoErrorRetryCount = 0
  let lastPlaybackPosition = 0
  let wasPlayingBeforeError = false
  let lastPlaybackRateBeforeError = 1
  let consecutiveErrorsAtSamePosition = 0
  let lastErrorPosition = -1
  let isHlsRecovering = false
  let dualSyncInterval: ReturnType<typeof setInterval> | null = null
  let isApplyingDualAudioState = false

  // Computed properties
  const shouldVideoMute = computed(() => {
    switch (muteMode.value) {
      case 'mute_all':
        return true
      case 'mute_live':
        return mode === 'live'
      case 'mute_recorded':
        return mode === 'recorded'
      case 'normal':
      default:
        return false
    }
  })

  const isScreenRecordingSelected = computed(() => {
    if (!playbackData.value || !selectedStream.value) return false
    if (selectedStream.value === DUAL_STREAM_KEY) return false
    const currentStream = playbackData.value.streams[selectedStream.value]
    return currentStream?.type === 'screen'
  })

  const cameraStreamData = computed(() => {
    if (!playbackData.value) return null
    return Object.values(playbackData.value.streams).find(stream => stream.type === 'camera') || null
  })

  const screenStreamData = computed(() => {
    if (!playbackData.value) return null
    return Object.values(playbackData.value.streams).find(stream => stream.type === 'screen') || null
  })

  const hasDualStreams = computed(() => {
    return Boolean(cameraStreamData.value && screenStreamData.value)
  })

  const isDualStreamSelected = computed(() => {
    return selectedStream.value === DUAL_STREAM_KEY && hasDualStreams.value
  })

  const currentStreamData = computed(() => {
    if (!playbackData.value || !selectedStream.value) return null
    if (selectedStream.value === DUAL_STREAM_KEY) return null
    return playbackData.value.streams[selectedStream.value]
  })

  const dualCanSeek = computed(() => {
    return Number.isFinite(dualDuration.value) && dualDuration.value > 0
  })

  const showSpeedWarning = computed(() => {
    return connectionMode.value === 'external' && currentPlaybackRate.value > 2
  })

  const getDualMasterVideo = () => {
    return screenVideoPlayer.value || cameraVideoPlayer.value
  }

  const getCurrentPlaybackTime = () => {
    if (videoPlayer.value) return videoPlayer.value.currentTime

    const masterVideo = getDualMasterVideo()
    if (masterVideo) return masterVideo.currentTime

    return dualCurrentTime.value
  }

  const isAnyVideoPlaying = () => {
    if (videoPlayer.value) return !videoPlayer.value.paused

    const masterVideo = getDualMasterVideo()
    return Boolean(masterVideo && !masterVideo.paused)
  }

  // Helper function to create a serializable copy of an object and fix URL escaping
  const createSerializableCopy = (obj: any): any => {
    const copy = JSON.parse(JSON.stringify(obj))

    const fixUrls = (item: any): any => {
      if (typeof item === 'string' && item.includes('\\/\\/')) {
        return item.replace(/\\\//g, '/')
      }
      if (typeof item === 'object' && item !== null) {
        for (const key in item) {
          item[key] = fixUrls(item[key])
        }
      }
      return item
    }

    return fixUrls(copy)
  }

  // Helper function to get mode-specific HLS configuration
  const getHlsConfig = (hlsMode: 'live' | 'recorded') => {
    const baseConfig = {
      enableWorker: true,
      debug: false,
      startFragPrefetch: true,
      testBandwidth: false,
      progressive: false,
      maxBufferHole: 0.5,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 3,
      maxFragLookUpTolerance: 0.25,
      minAutoBitrate: 0
    }

    if (hlsMode === 'live') {
      return {
        ...baseConfig,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 20 * 1000 * 1000,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        liveDurationInfinity: true,
        fragLoadingTimeOut: 8000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 16000,
        levelLoadingTimeOut: 5000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        levelLoadingMaxRetryTimeout: 16000,
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 16000,
        highBufferWatchdogPeriod: 1,
        maxStarvationDelay: 2,
        maxLoadingDelay: 2
      }
    } else {
      return {
        ...baseConfig,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,
        highBufferWatchdogPeriod: 2,
        maxStarvationDelay: 4,
        maxLoadingDelay: 4
      }
    }
  }

  const handleTaskError = (message: string) => {
    if (onTaskError) {
      onTaskError(message)
    }
  }

  const cleanupSingleVideoSource = () => {
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }
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
    let mediaErrorRecoveryCount = 0
    let networkErrorRecoveryCount = 0
    const maxRecoveryAttempts = 3

    hlsInstance.on(Events.ERROR, (_event, data) => {
      console.error(`Dual HLS error (${label}):`, _event, data)

      if (!data.fatal) {
        console.warn(`Non-fatal dual HLS error (${label}):`, data.details, data)
        return
      }

      switch (data.type) {
        case ErrorTypes.NETWORK_ERROR:
          if (networkErrorRecoveryCount < maxRecoveryAttempts) {
            networkErrorRecoveryCount++
            setTimeout(() => {
              hlsInstance.startLoad()
            }, 1000 * networkErrorRecoveryCount)
          } else {
            const errorMessage = `Network error: Unable to load ${label} stream after multiple attempts`
            error.value = errorMessage
            handleTaskError(errorMessage)
          }
          break

        case ErrorTypes.MEDIA_ERROR:
          if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
            mediaErrorRecoveryCount++
            const currentPosition = video.currentTime || 0
            setTimeout(() => {
              try {
                hlsInstance.recoverMediaError()
                if (currentPosition > 0 && mode === 'recorded') {
                  video.currentTime = currentPosition + 0.5
                }
              } catch (recoveryError) {
                console.error(`Dual media recovery failed (${label}):`, recoveryError)
              }
            }, 500 * mediaErrorRecoveryCount)
          } else {
            const errorMessage = `Video decoding error: Unable to decode ${label} stream after multiple attempts`
            error.value = errorMessage
            handleTaskError(errorMessage)
          }
          break

        default:
          {
            const errorMessage = `Video playback error (${label}): ${data.details}`
            error.value = errorMessage
            handleTaskError(errorMessage)
          }
          break
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
            console.warn(`Could not seek ${label} stream during dual load:`, seekError)
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
      console.error('Failed to load dual video sources:', err)
      const errorMessage = 'Failed to load dual video sources: ' + err.message
      error.value = errorMessage
      handleTaskError(errorMessage)
    }
  }

  const loadVideoStreams = async () => {
    try {
      loading.value = true
      error.value = null

      const token = tokenManager.getToken()
      if (!token) {
        throw new Error('Authentication token not found')
      }

      let result: PlaybackData

      if (mode === 'live' && streamId) {
        const streamData = DataStore.getStreamData(streamId)
        if (!streamData) {
          throw new Error('Stream data not found')
        }
        const serializableStreamData = createSerializableCopy(streamData)
        result = await window.electronAPI.video.getLiveStreamUrls(serializableStreamData, token)
      } else if (mode === 'recorded' && session.value) {
        const serializableSession = createSerializableCopy(session.value)
        result = await window.electronAPI.video.getVideoPlaybackUrls(serializableSession, token)
      } else {
        throw new Error('Invalid playback parameters')
      }

      playbackData.value = result

      const streamKeys = Object.keys(result.streams)
      if (streamKeys.length > 0) {
        const screenStream = streamKeys.find(key => result.streams[key].type === 'screen')
        selectedStream.value = screenStream || streamKeys[0]

        await nextTick()
        await loadVideoSource()
      } else {
        throw new Error('No video streams available')
      }

    } catch (err: any) {
      console.error('Failed to load video streams:', err)
      error.value = err.message || 'Failed to load video streams'
      handleTaskError(err.message || 'Failed to load video streams')
      isRetrying.value = false
      retryMessage.value = ''
    } finally {
      loading.value = false
    }
  }

  const loadVideoSourceWithPosition = async (seekToTime?: number, shouldAutoPlay?: boolean) => {
    if (!videoPlayer.value || !currentStreamData.value) {
      return
    }

    try {
      cleanupDualVideoSources()
      cleanupSingleVideoSource()

      const videoUrl = currentStreamData.value.url

      if (Hls.isSupported()) {
        hls.value = new Hls(getHlsConfig(mode))

        hls.value.loadSource(videoUrl)
        hls.value.attachMedia(videoPlayer.value)

        hls.value.on(Events.MANIFEST_PARSED, () => {
          setTimeout(() => {
            if (videoPlayer.value) {
              if (mode === 'recorded') {
                const targetRate = lastPlaybackRateBeforeError > 1 ? lastPlaybackRateBeforeError : currentPlaybackRate.value
                videoPlayer.value.playbackRate = targetRate
                currentPlaybackRate.value = targetRate
                if (slideExtractorInstance.value) {
                  slideExtractorInstance.value.updatePlaybackRate(targetRate)
                }
              } else {
                videoPlayer.value.playbackRate = 1
                currentPlaybackRate.value = 1
                if (slideExtractorInstance.value) {
                  slideExtractorInstance.value.updatePlaybackRate(1)
                }
              }

              if (shouldVideoMute.value) {
                videoPlayer.value.volume = 0
                videoPlayer.value.setAttribute('data-muted-by-app', 'true')
                isVideoMuted.value = true
              } else {
                videoPlayer.value.volume = 1
                videoPlayer.value.removeAttribute('data-muted-by-app')
                isVideoMuted.value = false
              }

              if (seekToTime && seekToTime > 0) {
                videoPlayer.value.currentTime = seekToTime
              }

              if (shouldAutoPlay !== false) {
                setTimeout(() => {
                  if (videoPlayer.value) {
                    videoPlayer.value.play().catch(() => {
                      setTimeout(() => {
                        if (videoPlayer.value) {
                          videoPlayer.value.play().catch(() => { /* Ignore retry play error */ })
                        }
                      }, 500)
                    })
                  }
                }, 200)
              }
            }
          }, 100)
        })

        let mediaErrorRecoveryCount = 0
        let networkErrorRecoveryCount = 0
        const maxRecoveryAttempts = 3

        hls.value.on(Events.ERROR, async (_event, data) => {
          console.error('HLS error during position restore:', _event, data)

          if (data.fatal) {
            switch (data.type) {
              case ErrorTypes.NETWORK_ERROR:
                if (networkErrorRecoveryCount < maxRecoveryAttempts) {
                  networkErrorRecoveryCount++
                  setTimeout(() => {
                    if (hls.value) {
                      hls.value.startLoad()
                    }
                  }, 1000 * networkErrorRecoveryCount)
                } else {
                  error.value = 'Network error: Unable to load video after multiple attempts'
                  isRetrying.value = false
                  retryMessage.value = ''
                  handleTaskError('Network error: Unable to load video after multiple attempts')
                }
                break

              case ErrorTypes.MEDIA_ERROR:
                if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                  mediaErrorRecoveryCount++

                  if (data.details === ErrorDetails.BUFFER_STALLED_ERROR ||
                      data.details === ErrorDetails.BUFFER_FULL_ERROR ||
                      data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                    setTimeout(() => {
                      if (hls.value && videoPlayer.value) {
                        const currentTime = videoPlayer.value.currentTime
                        videoPlayer.value.currentTime = currentTime + 0.1
                        hls.value.recoverMediaError()
                      }
                    }, 500)
                  } else {
                    setTimeout(() => {
                      if (hls.value) {
                        hls.value.recoverMediaError()
                      }
                    }, 1000 * mediaErrorRecoveryCount)
                  }
                } else {
                  error.value = 'Video decoding error: Unable to decode video after multiple attempts'
                  isRetrying.value = false
                  retryMessage.value = ''
                  handleTaskError('Video decoding error: Unable to decode video after multiple attempts')
                }
                break

              default:
                console.error('Other fatal error during restore:', data.details)
                error.value = 'Video playback error: ' + data.details
                isRetrying.value = false
                retryMessage.value = ''
                handleTaskError('Video playback error: ' + data.details)
                break
            }
          }
        })

      } else {
        throw new Error('HLS is not supported in this browser')
      }
    } catch (err: any) {
      console.error('Failed to load video source with position:', err)
      const errorMessage = 'Failed to load video source: ' + err.message
      error.value = errorMessage
      handleTaskError(errorMessage)
      isRetrying.value = false
      retryMessage.value = ''
    }
  }

  const loadVideoSource = async () => {
    if (!videoPlayer.value || !currentStreamData.value) {
      return
    }

    try {
      cleanupDualVideoSources()
      cleanupSingleVideoSource()

      const videoUrl = currentStreamData.value.url

      if (Hls.isSupported()) {
        hls.value = new Hls(getHlsConfig(mode))

        hls.value.loadSource(videoUrl)
        hls.value.attachMedia(videoPlayer.value)

        hls.value.on(Events.MANIFEST_PARSED, () => {
          setTimeout(() => {
            if (videoPlayer.value) {
              if (mode === 'recorded') {
                videoPlayer.value.playbackRate = currentPlaybackRate.value
                if (slideExtractorInstance.value) {
                  slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
                }
              } else {
                videoPlayer.value.playbackRate = 1
                currentPlaybackRate.value = 1
                if (slideExtractorInstance.value) {
                  slideExtractorInstance.value.updatePlaybackRate(1)
                }
              }

              if (shouldVideoMute.value) {
                videoPlayer.value.volume = 0
                videoPlayer.value.setAttribute('data-muted-by-app', 'true')
                isVideoMuted.value = true
              } else {
                videoPlayer.value.volume = 1
                videoPlayer.value.removeAttribute('data-muted-by-app')
                isVideoMuted.value = false
              }

              videoPlayer.value.play().catch(() => { /* Ignore manifest parsed play error */ })
            }
          }, 100)
        })

        let mediaErrorRecoveryCount = 0
        let networkErrorRecoveryCount = 0
        const maxRecoveryAttempts = 3

        hls.value.on(Events.ERROR, async (_event, data) => {
          console.error('HLS error:', _event, data)

          if (data.fatal) {
            isHlsRecovering = true
            switch (data.type) {
              case ErrorTypes.NETWORK_ERROR:
                if (networkErrorRecoveryCount < maxRecoveryAttempts) {
                  networkErrorRecoveryCount++
                  setTimeout(() => {
                    if (hls.value) {
                      hls.value.startLoad()
                    }
                  }, 1000 * networkErrorRecoveryCount)
                } else {
                  error.value = 'Network error: Unable to load video after multiple attempts'
                  isRetrying.value = false
                  retryMessage.value = ''
                  handleTaskError('Network error: Unable to load video after multiple attempts')
                }
                break

              case ErrorTypes.MEDIA_ERROR:
                if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                  mediaErrorRecoveryCount++

                  const currentPosition = videoPlayer.value?.currentTime || 0
                  const wasPlaying = videoPlayer.value ? !videoPlayer.value.paused : false

                  if (data.details === ErrorDetails.BUFFER_STALLED_ERROR ||
                      data.details === ErrorDetails.BUFFER_FULL_ERROR ||
                      data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                    setTimeout(() => {
                      if (hls.value && videoPlayer.value) {
                        const skipAmount = 0.5 + (mediaErrorRecoveryCount * 0.5)
                        videoPlayer.value.currentTime = currentPosition + skipAmount
                        hls.value.recoverMediaError()
                      }
                    }, 500)
                  } else if (data.details === ErrorDetails.BUFFER_APPEND_ERROR ||
                             data.details === ErrorDetails.BUFFER_APPENDING_ERROR) {
                    setTimeout(() => {
                      if (hls.value && videoPlayer.value) {
                        const skipAmount = 1 + (mediaErrorRecoveryCount * 1)
                        try {
                          hls.value.recoverMediaError()
                          setTimeout(() => {
                            if (videoPlayer.value) {
                              videoPlayer.value.currentTime = currentPosition + skipAmount
                              if (wasPlaying) {
                                videoPlayer.value.play().catch(() => { /* Ignore buffer recovery play error */ })
                              }
                            }
                            isHlsRecovering = false
                          }, 500)
                        } catch (e) {
                          console.error('Error during buffer append recovery:', e)
                          isHlsRecovering = false
                        }
                      }
                    }, 200)
                  } else {
                    setTimeout(() => {
                      if (hls.value) {
                        hls.value.recoverMediaError()
                        setTimeout(() => {
                          if (videoPlayer.value && currentPosition > 0) {
                            videoPlayer.value.currentTime = currentPosition
                            if (wasPlaying) {
                              videoPlayer.value.play().catch(() => { /* Ignore media recovery play error */ })
                            }
                          }
                          isHlsRecovering = false
                        }, 1000)
                      }
                    }, 500 * mediaErrorRecoveryCount)
                  }
                } else {
                  error.value = 'Video decoding error: Unable to decode video after multiple attempts'
                  isRetrying.value = false
                  retryMessage.value = ''
                  handleTaskError('Video decoding error: Unable to decode video after multiple attempts')
                }
                break

              default:
                console.error('Other fatal error:', data.details)
                error.value = 'Video playback error: ' + data.details
                isRetrying.value = false
                retryMessage.value = ''
                handleTaskError('Video playback error: ' + data.details)
                break
            }
          } else {
            console.warn('Non-fatal HLS error:', data.details, data)
          }
        })

      } else {
        throw new Error('HLS is not supported in this browser')
      }
    } catch (err: any) {
      console.error('Failed to load video source:', err)
      const errorMessage = 'Failed to load video source: ' + err.message
      error.value = errorMessage
      handleTaskError(errorMessage)
      isRetrying.value = false
      retryMessage.value = ''
    }
  }

  const switchStream = async () => {
    const wasPlaying = isAnyVideoPlaying()
    const currentTime = getCurrentPlaybackTime()

    if (isDualStreamSelected.value) {
      cleanupSingleVideoSource()
      await nextTick()
      await loadDualVideoSources(currentTime, true)
      return
    }

    cleanupDualVideoSources()
    await nextTick()

    if (videoPlayer.value) {
      await loadVideoSource()

      if (videoPlayer.value) {
        videoPlayer.value.currentTime = currentTime

        if (mode === 'recorded') {
          videoPlayer.value.playbackRate = currentPlaybackRate.value
          if (slideExtractorInstance.value) {
            slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
          }
        } else {
          videoPlayer.value.playbackRate = 1
          currentPlaybackRate.value = 1
          if (slideExtractorInstance.value) {
            slideExtractorInstance.value.updatePlaybackRate(1)
          }
        }

        if (shouldVideoMute.value) {
          videoPlayer.value.volume = 0
          videoPlayer.value.setAttribute('data-muted-by-app', 'true')
          isVideoMuted.value = true
        } else {
          videoPlayer.value.volume = 1
          videoPlayer.value.removeAttribute('data-muted-by-app')
          isVideoMuted.value = false
        }

        if (wasPlaying) {
          try {
            await videoPlayer.value.play()
          } catch (err) {
            console.warn('Could not resume playback:', err)
          }
        } else {
          try {
            await videoPlayer.value.play()
          } catch {
            // Ignore play errors - can occur during stream switching
          }
        }
      }
    }
  }

  const retryLoad = () => {
    error.value = null
    lastPlaybackPosition = 0
    cleanupDualVideoSources()
    loadVideoStreams()
  }

  const changePlaybackRate = () => {
    if (isDualStreamSelected.value) {
      const playbackRateNumber = Number(currentPlaybackRate.value)
      if (cameraVideoPlayer.value) {
        cameraVideoPlayer.value.playbackRate = mode === 'recorded' ? playbackRateNumber : 1
      }
      if (screenVideoPlayer.value) {
        screenVideoPlayer.value.playbackRate = mode === 'recorded' ? playbackRateNumber : 1
      }
      if (mode !== 'recorded') {
        currentPlaybackRate.value = 1
      }
      return
    }

    if (videoPlayer.value) {
      const playbackRateNumber = Number(currentPlaybackRate.value)
      videoPlayer.value.playbackRate = playbackRateNumber

      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.updatePlaybackRate(playbackRateNumber)
      }
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
      console.warn('Could not start dual playback:', playError)
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

  const cleanup = () => {
    cleanupSingleVideoSource()
    cleanupDualVideoSources()
  }

  // Event handlers
  const onLoadStart = () => {
    // Video load started
  }

  const onLoadedMetadata = () => {
    // Video metadata loaded
  }

  const onVideoError = async (event: Event) => {
    const target = event.target as HTMLVideoElement
    const errorCode = target.error?.code
    const errorMessage = target.error?.message

    if (isHlsRecovering) {
      console.log('HLS is recovering, deferring video error handling...')
      setTimeout(() => {
        if (isHlsRecovering) {
          console.log('HLS recovery timeout, proceeding with video error handling')
          isHlsRecovering = false
          onVideoError(event)
        }
      }, 2000)
      return
    }

    if (target.currentTime > 0) {
      lastPlaybackPosition = target.currentTime
      wasPlayingBeforeError = !target.paused
      lastPlaybackRateBeforeError = target.playbackRate
    }

    if (Math.abs(lastPlaybackPosition - lastErrorPosition) < 4.5) {
      consecutiveErrorsAtSamePosition++
    } else {
      consecutiveErrorsAtSamePosition = 1
      lastErrorPosition = lastPlaybackPosition
    }

    console.error('Video error:', {
      errorCode,
      errorMessage,
      retryCount: videoErrorRetryCount,
      currentTime: target.currentTime,
      wasPlaying: wasPlayingBeforeError,
      consecutiveErrors: consecutiveErrorsAtSamePosition,
      lastErrorPos: lastErrorPosition
    })

    let userMessage = 'Video playback error'
    let shouldRetry = false

    switch (errorCode) {
      case 1:
        userMessage = 'Video playback was aborted'
        break
      case 2:
        userMessage = 'Network error occurred while loading video'
        shouldRetry = true
        break
      case 3:
        userMessage = 'Video decoding error'
        shouldRetry = true
        break
      case 4:
        userMessage = 'Video format not supported'
        break
    }

    if (shouldRetry && videoErrorRetryCount < maxVideoErrorRetries.value) {
      videoErrorRetryCount++

      let skipAmount = 0
      if (errorCode === 3) {
        if (consecutiveErrorsAtSamePosition === 1) {
          skipAmount = 1
        } else if (consecutiveErrorsAtSamePosition === 2) {
          skipAmount = 3
        } else {
          skipAmount = 5
        }
      }

      const targetPosition = lastPlaybackPosition + skipAmount
      console.log(`Attempting video error recovery (attempt ${videoErrorRetryCount}/${maxVideoErrorRetries.value}) - skipping from ${lastPlaybackPosition} to ${targetPosition} (skip: ${skipAmount}s, consecutive errors: ${consecutiveErrorsAtSamePosition})`)

      isRetrying.value = true
      retryMessage.value = `Recovering from playback error... (${videoErrorRetryCount}/${maxVideoErrorRetries.value})`

      setTimeout(() => {
        if (videoPlayer.value && currentStreamData.value) {
          console.log('Retrying video load after error...')
          loadVideoSourceWithPosition(targetPosition, true)
        }
      }, 1000 + (500 * videoErrorRetryCount))
    } else {
      if (videoErrorRetryCount >= maxVideoErrorRetries.value) {
        userMessage += ` (Failed after ${maxVideoErrorRetries.value} retry attempts)`
      }
      error.value = userMessage
      handleTaskError(userMessage)
      isRetrying.value = false
      retryMessage.value = ''

      videoErrorRetryCount = 0
      wasPlayingBeforeError = false
      lastPlaybackRateBeforeError = 1
      consecutiveErrorsAtSamePosition = 0
      lastErrorPosition = -1
    }
  }

  const onCanPlay = () => {
    if (isRetrying.value) {
      setTimeout(() => {
        isRetrying.value = false
        retryMessage.value = ''
      }, 500)
    }

    setTimeout(() => {
      if (videoPlayer.value && !videoPlayer.value.paused && !videoPlayer.value.ended) {
        if (consecutiveErrorsAtSamePosition > 0) {
          consecutiveErrorsAtSamePosition = Math.max(0, consecutiveErrorsAtSamePosition - 1)
        }
        if (lastPlaybackRateBeforeError > 1) {
          lastPlaybackRateBeforeError = 1
        }
      }
    }, 1500)
  }

  const onEnded = async () => {
    console.log('Video playback ended, stopping signature loop')
    try {
      await window.electronAPI.video.stopSignatureLoop()
    } catch (err) {
      console.error('Failed to stop signature loop on video end:', err)
    }
  }

  const preventUnmute = (event: Event) => {
    if (shouldVideoMute.value && videoPlayer.value) {
      event.preventDefault()
      videoPlayer.value.volume = 0
      videoPlayer.value.muted = false
    }
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

  const resetErrorCounters = () => {
    videoErrorRetryCount = 0
    consecutiveErrorsAtSamePosition = 0
    lastErrorPosition = -1
    lastPlaybackRateBeforeError = 1
    lastPlaybackPosition = 0
    wasPlayingBeforeError = false
  }

  const initConfig = async () => {
    try {
      const config = await window.electronAPI.config.get()
      connectionMode.value = config.connectionMode
      muteMode.value = config.muteMode || 'normal'
      maxVideoErrorRetries.value = config.videoRetryCount || 5
    } catch (err) {
      console.error('Failed to load video player config:', err)
    }
  }

  const registerClient = async () => {
    try {
      videoProxyClientId.value = await window.electronAPI.video.registerClient()
    } catch (err) {
      console.error('Failed to register video proxy client:', err)
    }
  }

  const unregisterClient = async () => {
    if (videoProxyClientId.value) {
      try {
        await window.electronAPI.video.unregisterClient(videoProxyClientId.value)
      } catch (err) {
        console.error('Failed to unregister video proxy client on unmount:', err)
      }
    }
  }

  return {
    // State
    loading,
    error,
    playbackData,
    selectedStream,
    isPlaying,
    videoPlayer,
    cameraVideoPlayer,
    screenVideoPlayer,
    hls,
    currentPlaybackRate,
    connectionMode,
    muteMode,
    isVideoMuted,
    isRetrying,
    retryMessage,
    maxVideoErrorRetries,
    videoProxyClientId,
    dualAudioSource,
    dualCurrentTime,
    dualDuration,

    // Computed
    shouldVideoMute,
    isScreenRecordingSelected,
    isDualStreamSelected,
    hasDualStreams,
    currentStreamData,
    cameraStreamData,
    screenStreamData,
    dualCanSeek,
    showSpeedWarning,

    // Error tracking state (exposed for task queue access)
    get videoErrorRetryCount() { return videoErrorRetryCount },
    set videoErrorRetryCount(val) { videoErrorRetryCount = val },
    get consecutiveErrorsAtSamePosition() { return consecutiveErrorsAtSamePosition },
    set consecutiveErrorsAtSamePosition(val) { consecutiveErrorsAtSamePosition = val },
    get lastErrorPosition() { return lastErrorPosition },
    set lastErrorPosition(val) { lastErrorPosition = val },
    get lastPlaybackPosition() { return lastPlaybackPosition },
    set lastPlaybackPosition(val) { lastPlaybackPosition = val },
    get wasPlayingBeforeError() { return wasPlayingBeforeError },
    set wasPlayingBeforeError(val) { wasPlayingBeforeError = val },
    get lastPlaybackRateBeforeError() { return lastPlaybackRateBeforeError },
    set lastPlaybackRateBeforeError(val) { lastPlaybackRateBeforeError = val },
    get isHlsRecovering() { return isHlsRecovering },
    set isHlsRecovering(val) { isHlsRecovering = val },

    // Methods
    loadVideoStreams,
    loadVideoSource,
    loadVideoSourceWithPosition,
    loadDualVideoSources,
    switchStream,
    retryLoad,
    changePlaybackRate,
    toggleDualPlayback,
    playDualStreams,
    pauseDualStreams,
    seekDualStreams,
    setDualAudioSource,
    applyDualAudioState,
    cleanup,
    getHlsConfig,
    createSerializableCopy,

    // Event handlers
    onLoadStart,
    onLoadedMetadata,
    onVideoError,
    onCanPlay,
    onEnded,
    preventUnmute,
    onDualTimeUpdate,
    onDualPlayStateChanged,
    onDualEnded,
    preventDualUnmute,

    // Utility
    resetErrorCounters,
    initConfig,
    registerClient,
    unregisterClient
  }
}
