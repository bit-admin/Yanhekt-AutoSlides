import { ref, shallowRef, computed, nextTick, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import Hls, { Events, ErrorTypes, ErrorDetails } from 'hls.js'
import { DataStore } from '../services/dataStore'
import { TokenManager } from '../services/authService'
import type { SlideExtractor } from '../services/slideExtractor'

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
  hls: ShallowRef<Hls | null>
  currentPlaybackRate: Ref<number>
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>
  isVideoMuted: Ref<boolean>
  isRetrying: Ref<boolean>
  retryMessage: Ref<string>
  maxVideoErrorRetries: Ref<number>
  videoProxyClientId: Ref<string | null>

  // Computed
  shouldVideoMute: ComputedRef<boolean>
  isScreenRecordingSelected: ComputedRef<boolean>
  currentStreamData: ComputedRef<VideoStream | null>
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
  switchStream: () => Promise<void>
  retryLoad: () => void
  changePlaybackRate: () => void
  cleanup: () => void
  getHlsConfig: (mode: 'live' | 'recorded') => object
  createSerializableCopy: (obj: any) => any

  // Event handlers
  onLoadStart: () => void
  onLoadedMetadata: () => void
  onVideoError: (event: Event) => Promise<void>
  onCanPlay: () => void
  preventUnmute: (event: Event) => void

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
  const hls = shallowRef<Hls | null>(null)
  const currentPlaybackRate = ref(1)
  const connectionMode = ref<'internal' | 'external'>('external')
  const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
  const isVideoMuted = ref(false)
  const videoProxyClientId = ref<string | null>(null)
  const isRetrying = ref(false)
  const retryMessage = ref('')
  const maxVideoErrorRetries = ref(5)

  // Error tracking state (non-reactive for performance)
  let videoErrorRetryCount = 0
  let lastPlaybackPosition = 0
  let wasPlayingBeforeError = false
  let lastPlaybackRateBeforeError = 1
  let consecutiveErrorsAtSamePosition = 0
  let lastErrorPosition = -1
  let isHlsRecovering = false

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
    const currentStream = playbackData.value.streams[selectedStream.value]
    return currentStream?.type === 'screen'
  })

  const currentStreamData = computed(() => {
    if (!playbackData.value || !selectedStream.value) return null
    return playbackData.value.streams[selectedStream.value]
  })

  const showSpeedWarning = computed(() => {
    return connectionMode.value === 'external' && currentPlaybackRate.value > 2
  })

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
      if (hls.value) {
        hls.value.destroy()
        hls.value = null
      }

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
      if (hls.value) {
        hls.value.destroy()
        hls.value = null
      }

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
    if (videoPlayer.value) {
      const wasPlaying = !videoPlayer.value.paused
      const currentTime = videoPlayer.value.currentTime

      await nextTick()
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
    loadVideoStreams()
  }

  const changePlaybackRate = () => {
    if (videoPlayer.value) {
      const playbackRateNumber = Number(currentPlaybackRate.value)
      videoPlayer.value.playbackRate = playbackRateNumber

      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.updatePlaybackRate(playbackRateNumber)
      }
    }
  }

  const cleanup = () => {
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }
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

  const preventUnmute = (event: Event) => {
    if (shouldVideoMute.value && videoPlayer.value) {
      event.preventDefault()
      videoPlayer.value.volume = 0
      videoPlayer.value.muted = false
    }
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
    hls,
    currentPlaybackRate,
    connectionMode,
    muteMode,
    isVideoMuted,
    isRetrying,
    retryMessage,
    maxVideoErrorRetries,
    videoProxyClientId,

    // Computed
    shouldVideoMute,
    isScreenRecordingSelected,
    currentStreamData,
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
    switchStream,
    retryLoad,
    changePlaybackRate,
    cleanup,
    getHlsConfig,
    createSerializableCopy,

    // Event handlers
    onLoadStart,
    onLoadedMetadata,
    onVideoError,
    onCanPlay,
    preventUnmute,

    // Utility
    resetErrorCounters,
    initConfig,
    registerClient,
    unregisterClient
  }
}
