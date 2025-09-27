<template>
  <div class="playback-page">
    <div class="header">
      <button @click="goBack" class="back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
        Back
      </button>
      <div class="title-info">
        <h2>{{ course?.title || 'Unknown Course' }}</h2>
        <p v-if="session">{{ session.title }}</p>
        <p v-if="course?.session?.section_group_title && props.mode === 'live'">{{ course.session.section_group_title }}</p>
        <div v-if="!isVisible && isPlaying" class="background-mode-indicator">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          Playing in background
        </div>

        <!-- Collapsible Details Section -->
        <div class="details-toggle">
          <button @click="showDetails = !showDetails" class="toggle-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showDetails }">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
            {{ showDetails ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>

        <div v-if="showDetails" class="details-section">
          <div class="detail-item" v-if="course?.instructor">
            <strong>Instructor:</strong> {{ course.instructor }}
          </div>
          <div class="detail-item" v-if="session">
            <strong>Date:</strong> {{ formatDate(session.started_at) }}
          </div>
          <div class="detail-item" v-if="playbackData?.duration">
            <strong>Duration:</strong> {{ formatDuration(playbackData.duration) }}
          </div>
          <div class="detail-item" v-if="currentStreamData">
            <strong>Current Stream:</strong> {{ currentStreamData.name }} ({{ currentStreamData.type === 'camera' ? 'Camera View' : 'Screen Recording' }})
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading video streams...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>{{ error }}</p>
        <button @click="retryLoad" class="retry-btn">Retry</button>
      </div>

      <div v-else-if="playbackData" class="video-content">
        <!-- Stream Selection and Playback Controls -->
        <div class="controls-row">
          <div v-if="Object.keys(playbackData.streams).length > 1" class="stream-selector">
            <label>Select Stream:</label>
            <select v-model="selectedStream" @change="switchStream">
              <option v-for="(stream, key) in playbackData.streams" :key="key" :value="key">
                {{ stream.name }}
              </option>
            </select>
          </div>

          <!-- Custom Playback Rate Control (only for recorded videos) -->
          <div v-if="props.mode === 'recorded'" class="playback-rate-control">
            <label>Playback speed:</label>
            <select v-model="currentPlaybackRate" @change="changePlaybackRate">
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
              <option value="4">4x</option>
              <option value="5">5x</option>
              <option value="6">6x</option>
              <option value="7">7x</option>
              <option value="8">8x</option>
              <option value="9">9x</option>
              <option value="10">10x</option>
            </select>
          </div>
        </div>

        <!-- Playback Speed Warning for External Network -->
        <div v-if="props.mode === 'recorded' && showSpeedWarning" class="speed-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          High-speed playback may cause buffering issues. Consider switching to internal network mode for optimal performance at higher speeds.
        </div>

        <!-- Video Player -->
        <div class="video-container">
          <video
            ref="videoPlayer"
            class="video-player"
            controls
            controlslist="noplaybackrate"
            preload="metadata"
            @loadstart="onLoadStart"
            @loadedmetadata="onLoadedMetadata"
            @error="onVideoError"
            @canplay="onCanPlay"
            @volumechange="preventUnmute"
          >
            Your browser does not support the video tag.
          </video>
          <div v-if="shouldVideoMute" class="mute-indicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <span>{{ muteMode === 'mute_all' ? 'Muted by App' : muteMode === 'mute_live' ? 'Live Muted' : 'Recorded Muted' }}</span>
          </div>
        </div>

      </div>

      <div v-else class="no-streams">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
        <p>No video streams available</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DataStore } from '../services/dataStore'
import { TokenManager } from '../services/authService'
import Hls from 'hls.js'

interface Course {
  id: string
  title: string
  instructor: string
  time: string
  status?: number
  subtitle?: string
  schedule_started_at?: string
  schedule_ended_at?: string
  participant_count?: number
  session?: {
    professor?: {
      name: string;
    };
    section_group_title?: string;
  };
  target?: string; // Camera stream URL
  target_vga?: string; // Screen stream URL
  // Record mode specific fields
  professors?: string[];
  classrooms?: { name: string }[];
  school_year?: string;
  semester?: string;
  college_name?: string;
}

interface Session {
  id: string
  session_id: string
  video_id: string
  title: string
  duration: number
  week_number: number
  day: number
  started_at: string
  ended_at: string
  main_url?: string
  vga_url?: string
}

interface VideoStream {
  type: 'camera' | 'screen'
  name: string
  url: string
  original_url: string
}

interface PlaybackData {
  session_id?: string
  stream_id?: string
  video_id?: string
  title: string
  duration?: string
  streams: { [key: string]: VideoStream }
}

const props = defineProps<{
  course: Course | null
  session?: Session | null
  mode: 'live' | 'recorded'
  streamId?: string
  sessionId?: string
  isVisible?: boolean
}>()

// Default isVisible to true for backward compatibility
const isVisible = computed(() => props.isVisible ?? true)

const emit = defineEmits<{
  back: []
}>()

// Reactive state
const loading = ref(true)
const error = ref<string | null>(null)
const playbackData = ref<PlaybackData | null>(null)
const selectedStream = ref<string>('')
const isPlaying = ref(false)
const videoPlayer = ref<HTMLVideoElement | null>(null)
const hls = ref<Hls | null>(null)
const currentPlaybackRate = ref(1)
const connectionMode = ref<'internal' | 'external'>('external')
const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
const isVideoMuted = ref(false)
const showDetails = ref(false)
const showSpeedWarning = computed(() => {
  return connectionMode.value === 'external' && currentPlaybackRate.value > 2
})

// Computed property to determine if video should be muted based on mode and mute setting
const shouldVideoMute = computed(() => {
  switch (muteMode.value) {
    case 'mute_all':
      return true
    case 'mute_live':
      return props.mode === 'live'
    case 'mute_recorded':
      return props.mode === 'recorded'
    case 'normal':
    default:
      return false
  }
})

// Initialize TokenManager
const tokenManager = new TokenManager()

// Computed properties
const currentStreamData = computed(() => {
  if (!playbackData.value || !selectedStream.value) return null
  return playbackData.value.streams[selectedStream.value]
})

// Methods
const goBack = () => {
  emit('back')
}

// Helper function to create a serializable copy of an object and fix URL escaping
const createSerializableCopy = (obj: any): any => {
  const copy = JSON.parse(JSON.stringify(obj))

  // Fix URL escaping issues
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

const loadVideoStreams = async () => {
  try {
    loading.value = true
    error.value = null

    const token = tokenManager.getToken()
    if (!token) {
      throw new Error('Authentication token not found')
    }

    let result: PlaybackData

    if (props.mode === 'live' && props.streamId) {
      // Load live stream data
      const streamData = DataStore.getStreamData(props.streamId)
      if (!streamData) {
        throw new Error('Stream data not found')
      }

      // Create a serializable copy to avoid IPC cloning issues
      const serializableStreamData = createSerializableCopy(streamData)
      result = await window.electronAPI.video.getLiveStreamUrls(serializableStreamData, token)
    } else if (props.mode === 'recorded' && props.session) {
      // Load recorded video data
      // Create a serializable copy to avoid IPC cloning issues
      const serializableSession = createSerializableCopy(props.session)
      result = await window.electronAPI.video.getVideoPlaybackUrls(serializableSession, token)
    } else {
      throw new Error('Invalid playback parameters')
    }

    playbackData.value = result

    // Select default stream - prefer screen recording
    const streamKeys = Object.keys(result.streams)
    if (streamKeys.length > 0) {
      // Find screen recording stream first
      const screenStream = streamKeys.find(key => result.streams[key].type === 'screen')
      selectedStream.value = screenStream || streamKeys[0]

      // Wait for next tick to ensure DOM is updated
      await nextTick()
      await loadVideoSource()
    } else {
      throw new Error('No video streams available')
    }

  } catch (err: any) {
    console.error('Failed to load video streams:', err)
    error.value = err.message || 'Failed to load video streams'
  } finally {
    loading.value = false
  }
}

const loadVideoSourceWithPosition = async (seekToTime?: number, shouldAutoPlay?: boolean) => {
  console.log('loadVideoSourceWithPosition called', { seekToTime, shouldAutoPlay })

  if (!videoPlayer.value || !currentStreamData.value) {
    console.warn('Video player or stream data not ready for position restore')
    return
  }

  try {
    console.log('Loading video source with position restore:', currentStreamData.value.url)

    // Clean up existing HLS instance
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    const videoUrl = currentStreamData.value.url

    // Check if HLS is supported
    if (Hls.isSupported()) {
      console.log('Using HLS.js for playback with position restore')
      hls.value = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        debug: false,
        // Enhanced error recovery settings
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000,
        // Manifest loading retry settings
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,
        // Additional resilience settings
        startFragPrefetch: true,
        testBandwidth: false,
        progressive: false,
        // Buffer settings for better error recovery
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        // Stall detection and recovery
        maxStarvationDelay: 4,
        maxLoadingDelay: 4,
        minAutoBitrate: 0
      })

      hls.value.loadSource(videoUrl)
      hls.value.attachMedia(videoPlayer.value)

      hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully for position restore')

        setTimeout(() => {
          if (videoPlayer.value) {
            // Set initial playback rate based on mode
            if (props.mode === 'recorded') {
              videoPlayer.value.playbackRate = currentPlaybackRate.value
            } else {
              videoPlayer.value.playbackRate = 1
              currentPlaybackRate.value = 1
            }

            // Apply mute settings
            if (shouldVideoMute.value) {
              videoPlayer.value.volume = 0
              videoPlayer.value.setAttribute('data-muted-by-app', 'true')
              isVideoMuted.value = true
            } else {
              videoPlayer.value.volume = 1
              videoPlayer.value.removeAttribute('data-muted-by-app')
              isVideoMuted.value = false
            }

            // Restore position if specified
            if (seekToTime && seekToTime > 0) {
              console.log(`Restoring playback position to ${seekToTime}`)
              videoPlayer.value.currentTime = seekToTime
            }

            // Auto-play if requested or if was playing before error
            if (shouldAutoPlay !== false) {
              videoPlayer.value.play().catch(e => {
                console.log('Autoplay prevented during position restore:', e)
              })
            }
          }
        }, 100)
      })

      // Add the same enhanced error handling as the original function
      let mediaErrorRecoveryCount = 0
      let networkErrorRecoveryCount = 0
      const maxRecoveryAttempts = 3

      hls.value.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error during position restore:', event, data)

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log(`Network error during restore (attempt ${networkErrorRecoveryCount + 1}/${maxRecoveryAttempts}):`, data.details)

              if (networkErrorRecoveryCount < maxRecoveryAttempts) {
                networkErrorRecoveryCount++
                console.log('Attempting network error recovery during restore...')

                setTimeout(() => {
                  if (hls.value) {
                    hls.value.startLoad()
                  }
                }, 1000 * networkErrorRecoveryCount)
              } else {
                console.error('Max network recovery attempts reached during restore')
                error.value = 'Network error: Unable to load video after multiple attempts'
              }
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log(`Media error during restore (attempt ${mediaErrorRecoveryCount + 1}/${maxRecoveryAttempts}):`, data.details)

              if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                mediaErrorRecoveryCount++
                console.log('Attempting media error recovery during restore...')

                if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {

                  setTimeout(() => {
                    if (hls.value && videoPlayer.value) {
                      const currentTime = videoPlayer.value.currentTime
                      console.log(`Seeking forward from ${currentTime} to recover from buffer error during restore`)
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
                console.error('Max media recovery attempts reached during restore')
                error.value = 'Video decoding error: Unable to decode video after multiple attempts'
              }
              break

            default:
              console.error('Other fatal error during restore:', data.details)
              error.value = 'Video playback error: ' + data.details
              break
          }
        }
      })

      // Add fragment monitoring
      hls.value.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, (_event, data) => {
        console.warn('Fragment load emergency aborted during restore:', data)
      })

      hls.value.on(Hls.Events.FRAG_LOADING, (_event, data) => {
        console.log('Loading fragment during restore:', data.frag?.sn, 'URL:', data.frag?.url)
      })

      hls.value.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        console.log('Fragment loaded successfully during restore:', data.frag?.sn)
      })

    } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support with position restore
      console.log('Using native HLS support with position restore')
      videoPlayer.value.src = videoUrl
      videoPlayer.value.load()

      setTimeout(() => {
        if (videoPlayer.value) {
          // Set initial playback rate based on mode
          if (props.mode === 'recorded') {
            videoPlayer.value.playbackRate = currentPlaybackRate.value
          } else {
            videoPlayer.value.playbackRate = 1
            currentPlaybackRate.value = 1
          }

          // Apply mute settings
          if (shouldVideoMute.value) {
            videoPlayer.value.volume = 0
            videoPlayer.value.setAttribute('data-muted-by-app', 'true')
            isVideoMuted.value = true
          } else {
            videoPlayer.value.volume = 1
            videoPlayer.value.removeAttribute('data-muted-by-app')
            isVideoMuted.value = false
          }

          // Restore position if specified
          if (seekToTime && seekToTime > 0) {
            console.log(`Restoring playback position to ${seekToTime} (native)`)
            videoPlayer.value.currentTime = seekToTime
          }

          // Auto-play if requested
          if (shouldAutoPlay !== false) {
            videoPlayer.value.play().catch(e => {
              console.log('Autoplay prevented during native position restore:', e)
            })
          }
        }
      }, 100)
    } else {
      throw new Error('HLS is not supported in this browser')
    }
  } catch (err: any) {
    console.error('Failed to load video source with position:', err)
    error.value = 'Failed to load video source: ' + err.message
  }
}

const loadVideoSource = async () => {
  console.log('loadVideoSource called, checking conditions...')
  console.log('videoPlayer.value:', !!videoPlayer.value)
  console.log('currentStreamData.value:', !!currentStreamData.value)
  console.log('selectedStream.value:', selectedStream.value)
  console.log('playbackData.value:', !!playbackData.value)

  if (!videoPlayer.value || !currentStreamData.value) {
    console.warn('Video player or stream data not ready')
    return
  }

  try {
    console.log('Loading video source:', currentStreamData.value.url)

    // Clean up existing HLS instance
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    const videoUrl = currentStreamData.value.url

    // Check if HLS is supported
    if (Hls.isSupported()) {
      console.log('Using HLS.js for playback')
      hls.value = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        debug: false,
        // Enhanced error recovery settings
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000,
        // Manifest loading retry settings
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,
        // Additional resilience settings
        startFragPrefetch: true,
        testBandwidth: false,
        progressive: false,
        // Buffer settings for better error recovery
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        // Stall detection and recovery
        maxStarvationDelay: 4,
        maxLoadingDelay: 4,
        minAutoBitrate: 0
      })

      hls.value.loadSource(videoUrl)
      hls.value.attachMedia(videoPlayer.value)

      hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully')
        // Automatically start playback when manifest is ready
        setTimeout(() => {
          if (videoPlayer.value) {
            // Set initial playback rate based on mode
            if (props.mode === 'recorded') {
              videoPlayer.value.playbackRate = currentPlaybackRate.value
            } else {
              videoPlayer.value.playbackRate = 1
              currentPlaybackRate.value = 1
            }

            // Apply mute settings
            if (shouldVideoMute.value) {
              videoPlayer.value.volume = 0
              videoPlayer.value.setAttribute('data-muted-by-app', 'true')
              isVideoMuted.value = true
            } else {
              videoPlayer.value.volume = 1
              videoPlayer.value.removeAttribute('data-muted-by-app')
              isVideoMuted.value = false
            }

            videoPlayer.value.play().catch(e => {
              console.log('Autoplay prevented:', e)
            })
          }
        }, 100)
      })

      hls.value.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS media attached')
      })

      // Enhanced error handling with retry logic
      let mediaErrorRecoveryCount = 0
      let networkErrorRecoveryCount = 0
      const maxRecoveryAttempts = 3

      hls.value.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', event, data)

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log(`Network error (attempt ${networkErrorRecoveryCount + 1}/${maxRecoveryAttempts}):`, data.details)

              if (networkErrorRecoveryCount < maxRecoveryAttempts) {
                networkErrorRecoveryCount++
                console.log('Attempting network error recovery...')

                // Wait a bit before retrying
                setTimeout(() => {
                  if (hls.value) {
                    hls.value.startLoad()
                  }
                }, 1000 * networkErrorRecoveryCount) // Exponential backoff
              } else {
                console.error('Max network recovery attempts reached')
                error.value = 'Network error: Unable to load video after multiple attempts'
              }
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log(`Media error (attempt ${mediaErrorRecoveryCount + 1}/${maxRecoveryAttempts}):`, data.details)

              if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                mediaErrorRecoveryCount++
                console.log('Attempting media error recovery...')

                // Save current position before recovery
                const currentPosition = videoPlayer.value?.currentTime || 0
                const wasPlaying = videoPlayer.value ? !videoPlayer.value.paused : false

                // For decode errors, try different recovery strategies
                if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {

                  // Buffer-related errors - try to recover by seeking slightly forward
                  setTimeout(() => {
                    if (hls.value && videoPlayer.value) {
                      console.log(`Seeking forward from ${currentPosition} to recover from buffer error`)
                      videoPlayer.value.currentTime = currentPosition + 0.1
                      hls.value.recoverMediaError()
                    }
                  }, 500)

                } else {
                  // Other media errors - standard recovery with position restore
                  setTimeout(() => {
                    if (hls.value) {
                      hls.value.recoverMediaError()

                      // Try to restore position after recovery
                      setTimeout(() => {
                        if (videoPlayer.value && currentPosition > 0) {
                          console.log(`Restoring position to ${currentPosition} after media recovery`)
                          videoPlayer.value.currentTime = currentPosition

                          if (wasPlaying) {
                            videoPlayer.value.play().catch(e => {
                              console.log('Could not resume playback after recovery:', e)
                            })
                          }
                        }
                      }, 1000)
                    }
                  }, 1000 * mediaErrorRecoveryCount) // Exponential backoff
                }
              } else {
                console.error('Max media recovery attempts reached')
                error.value = 'Video decoding error: Unable to decode video after multiple attempts'
              }
              break

            default:
              console.error('Other fatal error:', data.details)
              error.value = 'Video playback error: ' + data.details
              break
          }
        } else {
          // Non-fatal errors - log but continue
          console.warn('Non-fatal HLS error:', data.details, data)

          // Handle specific non-fatal errors that might affect playback
          if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
            console.log('Fragment load error - HLS.js will retry automatically')
          } else if (data.details === Hls.ErrorDetails.FRAG_DECRYPT_ERROR) {
            console.log('Fragment decrypt error - may indicate corrupted segment')
          }
        }
      })

      // Add additional event listeners for better debugging
      hls.value.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, (_event, data) => {
        console.warn('Fragment load emergency aborted:', data)
      })

      // Add fragment loading progress monitoring
      hls.value.on(Hls.Events.FRAG_LOADING, (_event, data) => {
        console.log('Loading fragment:', data.frag?.sn, 'URL:', data.frag?.url)
      })

      hls.value.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        console.log('Fragment loaded successfully:', data.frag?.sn)
      })
    } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Electron/Chromium fallback)
      console.log('Using native HLS support')
      videoPlayer.value.src = videoUrl
      videoPlayer.value.load()

      // Automatically start playback for native HLS
      setTimeout(() => {
        if (videoPlayer.value) {
          // Set initial playback rate based on mode
          if (props.mode === 'recorded') {
            videoPlayer.value.playbackRate = currentPlaybackRate.value
          } else {
            videoPlayer.value.playbackRate = 1
            currentPlaybackRate.value = 1
          }

          // Apply mute settings
          if (shouldVideoMute.value) {
            videoPlayer.value.volume = 0
            videoPlayer.value.setAttribute('data-muted-by-app', 'true')
            isVideoMuted.value = true
          } else {
            videoPlayer.value.volume = 1
            videoPlayer.value.removeAttribute('data-muted-by-app')
            isVideoMuted.value = false
          }

          videoPlayer.value.play().catch(e => {
            console.log('Autoplay prevented:', e)
          })
        }
      }, 100)
    } else {
      throw new Error('HLS is not supported in this browser')
    }
  } catch (err: any) {
    console.error('Failed to load video source:', err)
    error.value = 'Failed to load video source: ' + err.message
  }
}

const switchStream = async () => {
  if (videoPlayer.value) {
    const wasPlaying = !videoPlayer.value.paused
    const currentTime = videoPlayer.value.currentTime

    // Wait for next tick to ensure DOM is updated
    await nextTick()
    await loadVideoSource()

    // Try to maintain playback position and state
    if (videoPlayer.value) {
      videoPlayer.value.currentTime = currentTime

      // Restore playback rate only for recorded videos
      if (props.mode === 'recorded') {
        videoPlayer.value.playbackRate = currentPlaybackRate.value
      } else {
        videoPlayer.value.playbackRate = 1
        currentPlaybackRate.value = 1
      }

      // Apply mute settings after stream switch
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
        // Automatically start playback even if previous stream wasn't playing
        try {
          await videoPlayer.value.play()
        } catch (err) {
          console.log('Autoplay prevented during stream switch:', err)
        }
      }
    }
  }
}


const retryLoad = () => {
  loadVideoStreams()
}

// Change playback rate
const changePlaybackRate = () => {
  if (videoPlayer.value) {
    videoPlayer.value.playbackRate = currentPlaybackRate.value
    console.log(`Playback rate changed to: ${currentPlaybackRate.value}x`)
  }
}

// Video event handlers
const onLoadStart = () => {
  // Video load started
}

const onLoadedMetadata = () => {
  // Video metadata loaded
}

// Enhanced video error handling with retry logic
let videoErrorRetryCount = 0
const maxVideoErrorRetries = 2
let lastPlaybackPosition = 0
let wasPlayingBeforeError = false

const onVideoError = (event: Event) => {
  const target = event.target as HTMLVideoElement
  const errorCode = target.error?.code
  const errorMessage = target.error?.message

  // Save current playback state before error
  if (target.currentTime > 0) {
    lastPlaybackPosition = target.currentTime
    wasPlayingBeforeError = !target.paused
  }

  console.error('Video error:', {
    errorCode,
    errorMessage,
    retryCount: videoErrorRetryCount,
    currentTime: target.currentTime,
    wasPlaying: wasPlayingBeforeError
  })

  let userMessage = 'Video playback error'
  let shouldRetry = false

  switch (errorCode) {
    case 1: // MEDIA_ERR_ABORTED
      userMessage = 'Video playback was aborted'
      break
    case 2: // MEDIA_ERR_NETWORK
      userMessage = 'Network error occurred while loading video'
      shouldRetry = true
      break
    case 3: // MEDIA_ERR_DECODE
      userMessage = 'Video decoding error'
      shouldRetry = true
      break
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      userMessage = 'Video format not supported'
      break
  }

  // Attempt retry for certain error types
  if (shouldRetry && videoErrorRetryCount < maxVideoErrorRetries) {
    videoErrorRetryCount++
    console.log(`Attempting video error recovery (attempt ${videoErrorRetryCount}/${maxVideoErrorRetries}) at position ${lastPlaybackPosition}`)

    setTimeout(() => {
      if (videoPlayer.value && currentStreamData.value) {
        console.log('Retrying video load after error...')

        // Reload the video source with position restoration
        loadVideoSourceWithPosition(lastPlaybackPosition, wasPlayingBeforeError)
      }
    }, 2000 * videoErrorRetryCount) // Exponential backoff
  } else {
    // Max retries reached or non-retryable error
    if (videoErrorRetryCount >= maxVideoErrorRetries) {
      userMessage += ` (Failed after ${maxVideoErrorRetries} retry attempts)`
    }
    error.value = userMessage
    videoErrorRetryCount = 0 // Reset for next video
    lastPlaybackPosition = 0
    wasPlayingBeforeError = false
  }
}

const onCanPlay = () => {
  // Video can start playing - reset error counters on successful load
  videoErrorRetryCount = 0
  console.log('Video can play - error counters reset')
}

// Utility functions
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  } catch {
    return dateString
  }
}

const formatDuration = (duration: string | number): string => {
  const seconds = typeof duration === 'string' ? parseInt(duration) : duration
  if (isNaN(seconds)) return 'Unknown'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Watch for play/pause state changes
let currentEventListeners: (() => void)[] = []

watch(() => videoPlayer.value, (newPlayer) => {
  console.log('Video player changed:', !!newPlayer)
  // Clean up old listeners
  currentEventListeners.forEach(cleanup => cleanup())
  currentEventListeners = []

  if (newPlayer) {
    const updatePlayingState = () => {
      isPlaying.value = !newPlayer.paused
    }

    newPlayer.addEventListener('play', updatePlayingState)
    newPlayer.addEventListener('pause', updatePlayingState)
    newPlayer.addEventListener('ended', updatePlayingState)

    // Store cleanup function
    currentEventListeners.push(() => {
      newPlayer.removeEventListener('play', updatePlayingState)
      newPlayer.removeEventListener('pause', updatePlayingState)
      newPlayer.removeEventListener('ended', updatePlayingState)
    })

    // Apply mute settings immediately when video player is ready
    if (shouldVideoMute.value) {
      newPlayer.volume = 0
      newPlayer.setAttribute('data-muted-by-app', 'true')
      isVideoMuted.value = true
    }

    // If we have stream data ready, load it now
    if (currentStreamData.value && playbackData.value) {
      console.log('Video player ready and stream data available, loading video source')
      nextTick(() => {
        loadVideoSource()
      })
    }
  }
})

// Watch for stream data changes
watch(() => currentStreamData.value, (newStreamData) => {
  console.log('Stream data changed:', !!newStreamData)
  if (newStreamData && videoPlayer.value && playbackData.value) {
    console.log('Stream data ready and video player available, loading video source')
    nextTick(() => {
      loadVideoSource()
    })
  }
})

// Watch for visibility changes - keep video playing when hidden
watch(isVisible, (visible) => {
  console.log(`🎬 PlaybackPage visibility changed: ${visible} (mode: ${props.mode})`)

  // Don't pause video when hidden - this is what enables background playback
  // The video continues playing in the background even when the component is not visible

  if (visible && videoPlayer.value) {
    // When becoming visible, we might want to show current playback state
    console.log(`▶️ ${props.mode} mode now visible, video playing: ${!videoPlayer.value.paused}`)
  } else if (!visible && videoPlayer.value) {
    // When becoming hidden, log the state but don't stop playback
    console.log(`🔇 ${props.mode} mode now hidden, video continues playing: ${!videoPlayer.value.paused}`)
  }
}, { immediate: true })

// Watch for mute mode changes to apply software-level muting
watch(shouldVideoMute, (shouldMute) => {
  if (videoPlayer.value) {
    // Apply software-level muting by setting volume to 0
    videoPlayer.value.volume = shouldMute ? 0 : 1
    isVideoMuted.value = shouldMute

    // Disable/enable the built-in mute controls
    if (shouldMute) {
      videoPlayer.value.setAttribute('data-muted-by-app', 'true')
    } else {
      videoPlayer.value.removeAttribute('data-muted-by-app')
    }

    console.log(`🔊 ${props.mode} mode mute changed: ${shouldMute} (mode: ${muteMode.value})`)
  }
}, { immediate: true })

// Function to prevent user from unmuting when app mute mode is active
const preventUnmute = (event: Event) => {
  if (shouldVideoMute.value && videoPlayer.value) {
    // Prevent the default unmute behavior
    event.preventDefault()
    // Immediately set volume back to 0
    videoPlayer.value.volume = 0
    videoPlayer.value.muted = false // Keep the muted attribute false so controls remain visible
  }
}

// Cleanup function
const cleanup = () => {
  if (hls.value) {
    hls.value.destroy()
    hls.value = null
  }
}

// Lifecycle
onMounted(async () => {
  // Load connection mode and mute mode from config
  try {
    const config = await window.electronAPI.config.get()
    connectionMode.value = config.connectionMode
    muteMode.value = config.muteMode || 'normal'
  } catch (error) {
    console.error('Failed to load connection mode:', error)
  }

  // Wait for next tick to ensure video element is in DOM
  await nextTick()
  loadVideoStreams()
})

onUnmounted(() => {
  // Clean up HLS
  cleanup()

  // Clean up event listeners
  currentEventListeners.forEach(cleanupFn => cleanupFn())
  currentEventListeners = []
})
</script>

<style scoped>
.playback-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #007acc;
  color: #007acc;
}

.title-info h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.title-info p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #666;
}

.background-mode-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 6px;
  background-color: #28a745;
  color: white;
  font-size: 12px;
  border-radius: 4px;
  width: fit-content;
}

.background-mode-indicator svg {
  animation: pulse 2s infinite;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Loading and Error States */
.loading-state, .error-state, .no-streams {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state svg {
  color: #dc3545;
}

.retry-btn {
  padding: 8px 16px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background-color: #0056b3;
}

/* Video Content */
.video-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  gap: 16px;
}

.stream-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stream-selector label {
  font-weight: 500;
  color: #333;
}

.stream-selector select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
}

.video-container {
  position: relative;
  width: 100%;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
}

.mute-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: rgba(220, 53, 69, 0.9);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 10;
}

.mute-indicator svg {
  flex-shrink: 0;
}

.playback-rate-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playback-rate-control label {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.playback-rate-control select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  cursor: pointer;
}

.playback-rate-control select:focus {
  outline: none;
  border-color: #007acc;
}

.video-player {
  width: 100%;
  height: auto;
  min-height: 400px;
  display: block;
}

/* Details toggle section */
.details-toggle {
  margin-top: 12px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  border-color: #007acc;
  color: #007acc;
}

.toggle-btn svg {
  transition: transform 0.2s;
}

.toggle-btn svg.rotated {
  transform: rotate(180deg);
}

.details-section {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.detail-item {
  margin: 6px 0;
  font-size: 14px;
  color: #666;
}

.detail-item strong {
  color: #333;
}

/* Speed warning */
.speed-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 12px 0;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  color: #856404;
  font-size: 14px;
  line-height: 1.4;
}

.speed-warning svg {
  flex-shrink: 0;
  color: #f39c12;
}

/* Responsive design */
@media (max-width: 768px) {
  .stream-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .video-player {
    min-height: 250px;
  }
}
</style>