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
        <div class="error-details">
          <p class="error-message">{{ error }}</p>
          <div v-if="lastPlaybackPosition > 0" class="error-info">
            <p class="playback-position">
              <strong>Last played position:</strong> {{ formatDuration(Math.floor(lastPlaybackPosition)) }}
            </p>
          </div>
          <div v-if="error.includes('Failed after') || error.includes('retry attempts')" class="error-suggestion">
            <p class="suggestion-text">
              This may be due to video quality issues or network problems.
              Consider downloading this video for offline viewing to avoid playback interruptions.
            </p>
          </div>
        </div>
        <button @click="retryLoad" class="retry-btn">Retry</button>
      </div>

      <div v-else-if="playbackData" class="video-content" :data-playback-mode="props.mode">
        <!-- Stream Selection and Playback Controls -->
        <div class="controls-row">
          <div v-if="Object.keys(playbackData.streams).length > 1 && !isSlideExtractionEnabled" class="stream-selector">
            <label>Select Stream:</label>
            <select v-model="selectedStream" @change="switchStream">
              <option v-for="(stream, key) in playbackData.streams" :key="key" :value="key">
                {{ stream.name }}
              </option>
            </select>
          </div>

          <!-- Slide Extraction Controls (only for screen recording) -->
          <div v-if="isScreenRecordingSelected" class="slide-extraction-control">
            <label class="extraction-toggle">
              <input
                type="checkbox"
                v-model="isSlideExtractionEnabled"
                @change="toggleSlideExtraction"
              />
              <span class="toggle-text">Extract Slides</span>
            </label>
            <div v-if="isSlideExtractionEnabled" class="extraction-status">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
              </svg>
              <span>{{ slideExtractionStatus.slideCount }} slides extracted</span>
            </div>
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
          <!-- Retry Indicator -->
          <div v-if="isRetrying" class="retry-indicator">
            <div class="retry-spinner"></div>
            <span>{{ retryMessage }}</span>
          </div>
        </div>

        <!-- Slide Gallery -->
        <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0" class="slide-gallery">
          <div class="gallery-header">
            <h3>Extracted Slides ({{ extractedSlides.length }})</h3>
            <button @click="clearAllSlides" class="clear-all-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Clear All
            </button>
          </div>
          <div class="gallery-grid">
            <div
              v-for="slide in extractedSlides"
              :key="slide.id"
              class="slide-thumbnail"
              @click="openSlideModal(slide)"
            >
              <img :src="slide.dataUrl" :alt="slide.title" />
              <div class="thumbnail-overlay">
                <div class="slide-info">
                  <span class="slide-title">{{ slide.title }}</span>
                  <span class="slide-time">{{ formatSlideTime(slide.timestamp) }}</span>
                </div>
                <button
                  @click.stop="deleteSlide(slide)"
                  class="delete-btn"
                  :title="`Delete ${slide.title}`"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </div>
            </div>
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

    <!-- Slide Preview Modal -->
    <div v-if="selectedSlide" class="slide-modal" @click="closeSlideModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedSlide.title }}</h3>
          <div class="modal-actions">
            <button @click="deleteSlide(selectedSlide)" class="modal-delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Delete
            </button>
            <button @click="closeSlideModal" class="modal-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close
            </button>
          </div>
        </div>
        <div class="modal-body">
          <img :src="selectedSlide.dataUrl" :alt="selectedSlide.title" class="modal-image" />
          <div class="slide-metadata">
            <p><strong>Extracted at:</strong> {{ formatSlideTime(selectedSlide.timestamp) }}</p>
            <p><strong>File name:</strong> {{ selectedSlide.title }}.png</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DataStore } from '../services/dataStore'
import { TokenManager } from '../services/authService'
import { slideExtractionManager, type SlideExtractor, type ExtractedSlide } from '../services/slideExtractor'
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

// Video proxy client management for independent mode support
const videoProxyClientId = ref<string | null>(null)
const showDetails = ref(false)
const isRetrying = ref(false)
const retryMessage = ref('')
const showSpeedWarning = computed(() => {
  return connectionMode.value === 'external' && currentPlaybackRate.value > 2
})

// Slide extraction state
const isSlideExtractionEnabled = ref(false)
const slideExtractionStatus = ref({
  isRunning: false,
  slideCount: 0,
  verificationState: 'none',
  currentVerification: 0
})
const slideExtractorInstance = ref<SlideExtractor | null>(null)
const extractorInstanceId = ref<string | null>(null)

// Slide gallery state
const extractedSlides = ref<ExtractedSlide[]>([])
const selectedSlide = ref<ExtractedSlide | null>(null)

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

// Computed property to check if screen recording is selected
const isScreenRecordingSelected = computed(() => {
  if (!playbackData.value || !selectedStream.value) return false
  const currentStream = playbackData.value.streams[selectedStream.value]
  return currentStream?.type === 'screen'
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
    // Clear retry UI state when showing final error
    isRetrying.value = false
    retryMessage.value = ''
    // Note: Video proxy is managed by reference counting and will be stopped
    // automatically when all clients are unregistered
  } finally {
    loading.value = false
  }
}

const loadVideoSourceWithPosition = async (seekToTime?: number, shouldAutoPlay?: boolean) => {
  if (!videoPlayer.value || !currentStreamData.value) {
    return
  }

  try {

    // Clean up existing HLS instance
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    const videoUrl = currentStreamData.value.url

    // Check if HLS is supported
    if (Hls.isSupported()) {
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
        setTimeout(() => {
          if (videoPlayer.value) {
            // Set initial playback rate based on mode and saved state
            if (props.mode === 'recorded') {
              // Use saved playback rate if available (from error recovery), otherwise use current setting
              const targetRate = lastPlaybackRateBeforeError > 1 ? lastPlaybackRateBeforeError : currentPlaybackRate.value
              videoPlayer.value.playbackRate = targetRate
              currentPlaybackRate.value = targetRate
              // Update slide extractor with restored playback rate
              if (slideExtractorInstance.value) {
                slideExtractorInstance.value.updatePlaybackRate(targetRate)
              }
            } else {
              videoPlayer.value.playbackRate = 1
              currentPlaybackRate.value = 1
              // Update slide extractor with live mode playback rate
              if (slideExtractorInstance.value) {
                slideExtractorInstance.value.updatePlaybackRate(1)
              }
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
              videoPlayer.value.currentTime = seekToTime
            }

            // Auto-play if requested or if was playing before error
            if (shouldAutoPlay !== false) {
              // Add a small delay to ensure video is ready
              setTimeout(() => {
                if (videoPlayer.value) {
                  videoPlayer.value.play().catch(() => {
                    // Try again after a short delay
                    setTimeout(() => {
                      if (videoPlayer.value) {
                        videoPlayer.value.play().catch(() => {})
                      }
                    }, 500)
                  })
                }
              }, 200)
            }
          }
        }, 100)
      })

      // Add the same enhanced error handling as the original function
      let mediaErrorRecoveryCount = 0
      let networkErrorRecoveryCount = 0
      const maxRecoveryAttempts = 3

      hls.value.on(Hls.Events.ERROR, async (event, data) => {
        console.error('HLS error during position restore:', event, data)

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:

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
              }
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                mediaErrorRecoveryCount++

                if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR ||
                    data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {

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
              }
              break

            default:
              console.error('Other fatal error during restore:', data.details)
              error.value = 'Video playback error: ' + data.details
              isRetrying.value = false
              retryMessage.value = ''
              break
          }
        }
      })


    } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support with position restore
      videoPlayer.value.src = videoUrl
      videoPlayer.value.load()

      setTimeout(() => {
        if (videoPlayer.value) {
          // Set initial playback rate based on mode and saved state
          if (props.mode === 'recorded') {
            // Use saved playback rate if available (from error recovery), otherwise use current setting
            const targetRate = lastPlaybackRateBeforeError > 1 ? lastPlaybackRateBeforeError : currentPlaybackRate.value
            videoPlayer.value.playbackRate = targetRate
            currentPlaybackRate.value = targetRate
            // Update slide extractor with restored playback rate
            if (slideExtractorInstance.value) {
              slideExtractorInstance.value.updatePlaybackRate(targetRate)
            }
          } else {
            videoPlayer.value.playbackRate = 1
            currentPlaybackRate.value = 1
            // Update slide extractor with live mode playback rate
            if (slideExtractorInstance.value) {
              slideExtractorInstance.value.updatePlaybackRate(1)
            }
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
            videoPlayer.value.currentTime = seekToTime
          }

          // Auto-play if requested
          if (shouldAutoPlay !== false) {
            // Add a small delay to ensure video is ready
            setTimeout(() => {
              if (videoPlayer.value) {
                videoPlayer.value.play().catch(e => {
                  console.log('Autoplay prevented during native position restore:', e)
                  // Try again after a short delay
                  setTimeout(() => {
                    if (videoPlayer.value) {
                      videoPlayer.value.play().catch(e2 => {
                        console.log('Second native autoplay attempt failed:', e2)
                      })
                    }
                  }, 500)
                })
              }
            }, 200)
          }
        }
      }, 100)
    } else {
      throw new Error('HLS is not supported in this browser')
    }
  } catch (err: any) {
    console.error('Failed to load video source with position:', err)
    error.value = 'Failed to load video source: ' + err.message
    // Clear retry UI state when showing final error
    isRetrying.value = false
    retryMessage.value = ''
    // Note: Video proxy is managed by reference counting
  }
}

const loadVideoSource = async () => {
  if (!videoPlayer.value || !currentStreamData.value) {
    return
  }

  try {

    // Clean up existing HLS instance
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    const videoUrl = currentStreamData.value.url

    // Check if HLS is supported
    if (Hls.isSupported()) {
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
        // Automatically start playback when manifest is ready
        setTimeout(() => {
          if (videoPlayer.value) {
            // Set initial playback rate based on mode
            if (props.mode === 'recorded') {
              videoPlayer.value.playbackRate = currentPlaybackRate.value
              // Update slide extractor with current playback rate
              if (slideExtractorInstance.value) {
                slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
              }
            } else {
              videoPlayer.value.playbackRate = 1
              currentPlaybackRate.value = 1
              // Update slide extractor with live mode playback rate
              if (slideExtractorInstance.value) {
                slideExtractorInstance.value.updatePlaybackRate(1)
              }
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

            videoPlayer.value.play().catch(() => {})
          }
        }, 100)
      })


      // Enhanced error handling with retry logic
      let mediaErrorRecoveryCount = 0
      let networkErrorRecoveryCount = 0
      const maxRecoveryAttempts = 3

      hls.value.on(Hls.Events.ERROR, async (event, data) => {
        console.error('HLS error:', event, data)

        if (data.fatal) {
          // Set recovery flag to coordinate with video error handling
          isHlsRecovering = true
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkErrorRecoveryCount < maxRecoveryAttempts) {
                networkErrorRecoveryCount++
                // Wait a bit before retrying
                setTimeout(() => {
                  if (hls.value) {
                    hls.value.startLoad()
                  }
                }, 1000 * networkErrorRecoveryCount) // Exponential backoff
              } else {
                error.value = 'Network error: Unable to load video after multiple attempts'
                isRetrying.value = false
                retryMessage.value = ''
              }
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaErrorRecoveryCount < maxRecoveryAttempts) {
                mediaErrorRecoveryCount++

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
                      const skipAmount = 0.5 + (mediaErrorRecoveryCount * 0.5) // Increase skip amount with retries
                      videoPlayer.value.currentTime = currentPosition + skipAmount
                      hls.value.recoverMediaError()
                    }
                  }, 500)

                } else if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR ||
                           data.details === Hls.ErrorDetails.BUFFER_APPENDING_ERROR) {

                  // Buffer append errors - more aggressive recovery
                  setTimeout(() => {
                    if (hls.value && videoPlayer.value) {
                      const skipAmount = 1 + (mediaErrorRecoveryCount * 1) // Skip more for append errors

                      // Clear buffers and seek forward
                      try {
                        hls.value.recoverMediaError()
                        setTimeout(() => {
                          if (videoPlayer.value) {
                            videoPlayer.value.currentTime = currentPosition + skipAmount
                            if (wasPlaying) {
                              videoPlayer.value.play().catch(() => {})
                            }
                          }
                          // Clear recovery flag after successful recovery
                          isHlsRecovering = false
                        }, 500)
                      } catch (e) {
                        console.error('Error during buffer append recovery:', e)
                        isHlsRecovering = false
                      }
                    }
                  }, 200) // Faster response for buffer errors

                } else {
                  // Other media errors - standard recovery with position restore
                  setTimeout(() => {
                    if (hls.value) {
                      hls.value.recoverMediaError()

                      // Try to restore position after recovery
                      setTimeout(() => {
                        if (videoPlayer.value && currentPosition > 0) {
                          videoPlayer.value.currentTime = currentPosition

                          if (wasPlaying) {
                            videoPlayer.value.play().catch(() => {})
                          }
                        }
                        // Clear recovery flag after successful recovery
                        isHlsRecovering = false
                      }, 1000)
                    }
                  }, 500 * mediaErrorRecoveryCount) // Shorter backoff
                }
              } else {
                error.value = 'Video decoding error: Unable to decode video after multiple attempts'
                isRetrying.value = false
                retryMessage.value = ''
              }
              break

            default:
              console.error('Other fatal error:', data.details)
              error.value = 'Video playback error: ' + data.details
              isRetrying.value = false
              retryMessage.value = ''
              break
          }
        } else {
          // Non-fatal errors - log but continue
          console.warn('Non-fatal HLS error:', data.details, data)
        }
      })

    } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Electron/Chromium fallback)
      videoPlayer.value.src = videoUrl
      videoPlayer.value.load()

      // Automatically start playback for native HLS
      setTimeout(() => {
        if (videoPlayer.value) {
          // Set initial playback rate based on mode
          if (props.mode === 'recorded') {
            videoPlayer.value.playbackRate = currentPlaybackRate.value
            // Update slide extractor with current playback rate
            if (slideExtractorInstance.value) {
              slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
            }
          } else {
            videoPlayer.value.playbackRate = 1
            currentPlaybackRate.value = 1
            // Update slide extractor with live mode playback rate
            if (slideExtractorInstance.value) {
              slideExtractorInstance.value.updatePlaybackRate(1)
            }
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

          videoPlayer.value.play().catch(() => {})
        }
      }, 100)
    } else {
      throw new Error('HLS is not supported in this browser')
    }
  } catch (err: any) {
    console.error('Failed to load video source:', err)
    error.value = 'Failed to load video source: ' + err.message
    isRetrying.value = false
    retryMessage.value = ''
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
        // Update slide extractor with current playback rate
        if (slideExtractorInstance.value) {
          slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
        }
      } else {
        videoPlayer.value.playbackRate = 1
        currentPlaybackRate.value = 1
        // Update slide extractor with live mode playback rate
        if (slideExtractorInstance.value) {
          slideExtractorInstance.value.updatePlaybackRate(1)
        }
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
        } catch (err) {}
      }
    }
  }
}


const retryLoad = () => {
  // Clear error state before retrying
  error.value = null
  // Reset playback position for fresh start
  lastPlaybackPosition = 0
  loadVideoStreams()
}

// Change playback rate
const changePlaybackRate = () => {
  if (videoPlayer.value) {
    // Convert to number to ensure proper type handling
    const playbackRateNumber = Number(currentPlaybackRate.value)

    videoPlayer.value.playbackRate = playbackRateNumber

    // Update slide extractor with new playback rate for dynamic interval adjustment
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.updatePlaybackRate(playbackRateNumber)
    }
  }
}

// Toggle slide extraction
const toggleSlideExtraction = async () => {
  if (isSlideExtractionEnabled.value) {
    // Ensure we're on screen recording
    if (!isScreenRecordingSelected.value) {
      isSlideExtractionEnabled.value = false
      return
    }

    try {
      // Get or create extractor instance for this mode
      const instanceId = `${props.mode}_${props.course?.id || 'unknown'}_${Date.now()}`
      slideExtractorInstance.value = slideExtractionManager.getExtractor(props.mode, instanceId)
      extractorInstanceId.value = instanceId

      // Initialize slide extraction with current course/session info
      await initializeSlideExtraction()

      // Sync with current playback rate before starting extraction
      slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))

      // Start the extraction process
      const success = slideExtractorInstance.value.startExtraction()
      if (!success) {
        isSlideExtractionEnabled.value = false
        return
      }

      // Update status
      updateSlideExtractionStatus()
    } catch (error) {
      console.error('Failed to start slide extraction:', error)
      isSlideExtractionEnabled.value = false
    }
  } else {
    // Stop slide extraction
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.stopExtraction()
      slideExtractionStatus.value.isRunning = false
    }
  }
}

// Initialize slide extraction with course/session context
const initializeSlideExtraction = async () => {
  try {
    // Get output directory from config
    const config = await window.electronAPI.config.get()
    const outputDir = config.outputDirectory || '~/Downloads/AutoSlides'

    // Create folder name based on course and session info
    let folderName = 'slides'

    if (props.course?.title) {
      folderName += `_${sanitizeFileName(props.course.title)}`
    }

    if (props.session?.title) {
      folderName += `_${sanitizeFileName(props.session.title)}`
    } else if (props.course?.session?.section_group_title && props.mode === 'live') {
      folderName += `_${sanitizeFileName(props.course.session.section_group_title)}`
    }

    // Set up slide extraction output directory
    const slideOutputPath = `${outputDir}/${folderName}`

    // Prepare course info for slide extractor
    const courseInfo = {
      courseName: props.course?.title,
      sessionTitle: props.session?.title || props.course?.session?.section_group_title,
      mode: props.mode
    }

    // Ensure the output directory exists
    await window.electronAPI.slideExtraction.ensureDirectory(slideOutputPath)

    // Store the output path and course info for later use when saving slides
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.setOutputPath(slideOutputPath, courseInfo)
    }

  } catch (error) {
    console.error('Failed to initialize slide extraction:', error)
    throw error
  }
}

// Sanitize filename by removing special characters
const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .trim()
}

// Update slide extraction status
const updateSlideExtractionStatus = () => {
  if (slideExtractorInstance.value) {
    const status = slideExtractorInstance.value.getStatus()
    slideExtractionStatus.value = {
      isRunning: status.isRunning,
      slideCount: status.slideCount,
      verificationState: status.verificationState,
      currentVerification: status.currentVerification
    }
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
const maxVideoErrorRetries = ref(5) // Will be loaded from config
let lastPlaybackPosition = 0
let wasPlayingBeforeError = false
let lastPlaybackRateBeforeError = 1 // Save playback rate before error
let consecutiveErrorsAtSamePosition = 0
let lastErrorPosition = -1
let isHlsRecovering = false // Flag to coordinate HLS and video error recovery

const onVideoError = async (event: Event) => {
  const target = event.target as HTMLVideoElement
  const errorCode = target.error?.code
  const errorMessage = target.error?.message

  // If HLS is currently recovering, let it handle the error first
  if (isHlsRecovering) {
    console.log('HLS is recovering, deferring video error handling...')
    setTimeout(() => {
      if (isHlsRecovering) {
        console.log('HLS recovery timeout, proceeding with video error handling')
        isHlsRecovering = false
        onVideoError(event) // Retry after HLS recovery timeout
      }
    }, 2000)
    return
  }

  // Save current playback state before error
  if (target.currentTime > 0) {
    lastPlaybackPosition = target.currentTime
    wasPlayingBeforeError = !target.paused
    lastPlaybackRateBeforeError = target.playbackRate // Save current playback rate
  }

  // Track consecutive errors at the same position
  // Use 4.5 second threshold - if errors occur within 4.5s, consider them at same position
  // This accounts for 1s + 3s = 4s of skipping, plus small buffer
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
  if (shouldRetry && videoErrorRetryCount < maxVideoErrorRetries.value) {
    videoErrorRetryCount++

    // Calculate smart skip amount based on consecutive errors
    // Pattern: 1s, 3s, 5s, 5s, 5s... (since TS segment is 20s)
    let skipAmount = 0
    if (errorCode === 3) { // DECODE error
      if (consecutiveErrorsAtSamePosition === 1) {
        skipAmount = 1 // First error: skip 1 second
      } else if (consecutiveErrorsAtSamePosition === 2) {
        skipAmount = 3 // Second error: skip 3 seconds
      } else {
        skipAmount = 5 // Third error and beyond: skip 5 seconds
      }
    }

    const targetPosition = lastPlaybackPosition + skipAmount
    console.log(`Attempting video error recovery (attempt ${videoErrorRetryCount}/${maxVideoErrorRetries.value}) - skipping from ${lastPlaybackPosition} to ${targetPosition} (skip: ${skipAmount}s, consecutive errors: ${consecutiveErrorsAtSamePosition})`)

    // Show retry UI
    isRetrying.value = true
    retryMessage.value = `Recovering from playback error... (${videoErrorRetryCount}/${maxVideoErrorRetries.value})`

    setTimeout(() => {
      if (videoPlayer.value && currentStreamData.value) {
        console.log('Retrying video load after error...')

        // Ensure we pass the correct autoplay state (always true for retries)
        loadVideoSourceWithPosition(targetPosition, true) // Force autoplay on retry
      }
    }, 1000 + (500 * videoErrorRetryCount)) // Shorter backoff for faster recovery
  } else {
    // Max retries reached or non-retryable error
    if (videoErrorRetryCount >= maxVideoErrorRetries.value) {
      userMessage += ` (Failed after ${maxVideoErrorRetries.value} retry attempts)`
    }
    error.value = userMessage

    // Clear retry UI state when showing final error
    isRetrying.value = false
    retryMessage.value = ''

    // Note: Video proxy is managed by reference counting

    // Reset counters for next video
    videoErrorRetryCount = 0
    // Don't reset lastPlaybackPosition here - keep it for error display
    wasPlayingBeforeError = false
    lastPlaybackRateBeforeError = 1
    consecutiveErrorsAtSamePosition = 0
    lastErrorPosition = -1
  }
}

const onCanPlay = () => {
  // Hide retry UI immediately when video can play
  if (isRetrying.value) {
    setTimeout(() => {
      isRetrying.value = false
      retryMessage.value = ''
    }, 500) // Small delay to show success
  }

  // Wait a bit longer before reducing counters to ensure video is truly stable
  setTimeout(() => {
    if (videoPlayer.value && !videoPlayer.value.paused && !videoPlayer.value.ended) {
      if (consecutiveErrorsAtSamePosition > 0) {
        consecutiveErrorsAtSamePosition = Math.max(0, consecutiveErrorsAtSamePosition - 1)
      }

      // Reset saved playback rate after successful recovery
      if (lastPlaybackRateBeforeError > 1) {
        lastPlaybackRateBeforeError = 1
      }
    }
  }, 1500) // Wait 1.5 seconds to ensure stability
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

// Slide gallery methods
const formatSlideTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  } catch {
    return timestamp
  }
}

const openSlideModal = (slide: ExtractedSlide) => {
  selectedSlide.value = slide
}

const closeSlideModal = () => {
  selectedSlide.value = null
}

const deleteSlide = async (slide: ExtractedSlide) => {
  try {
    // Show confirmation dialog
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete Slide',
      message: `Are you sure you want to delete "${slide.title}.png"?`,
      detail: 'This action cannot be undone. The file will be permanently deleted from your output directory.'
    })

    if (confirmed?.response !== 1) {
      return // User cancelled
    }

    // Get the output path from the slide extractor
    const outputPath = slideExtractorInstance.value?.getOutputPath()
    if (!outputPath) {
      throw new Error('Output path not found')
    }

    // Delete the file from the file system
    await window.electronAPI.slideExtraction?.deleteSlide?.(outputPath, `${slide.title}.png`)

    // Remove from local array
    const index = extractedSlides.value.findIndex(s => s.id === slide.id)
    if (index !== -1) {
      extractedSlides.value.splice(index, 1)
    }

    // Close modal if this slide was being viewed
    if (selectedSlide.value?.id === slide.id) {
      selectedSlide.value = null
    }

    console.log(`Slide deleted: ${slide.title}`)
  } catch (error) {
    console.error('Failed to delete slide:', error)
    // Show error dialog
    await window.electronAPI.dialog?.showErrorBox?.('Delete Failed', `Failed to delete slide: ${error.message || error}`)
  }
}

const clearAllSlides = async () => {
  try {
    if (extractedSlides.value.length === 0) {
      return
    }

    // Show confirmation dialog
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'warning',
      buttons: ['Cancel', 'Delete All'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete All Slides',
      message: `Are you sure you want to delete all ${extractedSlides.value.length} slides?`,
      detail: 'This action cannot be undone. All slide files will be permanently deleted from your output directory.'
    })

    if (confirmed?.response !== 1) {
      return // User cancelled
    }

    // Get the output path from the slide extractor
    const outputPath = slideExtractorInstance.value?.getOutputPath()
    if (!outputPath) {
      throw new Error('Output path not found')
    }

    // Delete all files from the file system
    const deletePromises = extractedSlides.value.map(slide =>
      window.electronAPI.slideExtraction?.deleteSlide?.(outputPath, `${slide.title}.png`)
    )
    await Promise.all(deletePromises)

    // Clear local array
    extractedSlides.value = []

    // Close modal if open
    selectedSlide.value = null

    // Clear slides in the extractor instance
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.clearSlides()
    }

    console.log('All slides cleared')
  } catch (error) {
    console.error('Failed to clear all slides:', error)
    // Show error dialog
    await window.electronAPI.dialog?.showErrorBox?.('Clear Failed', `Failed to clear slides: ${error.message || error}`)
  }
}

// Watch for play/pause state changes
let currentEventListeners: (() => void)[] = []

watch(() => videoPlayer.value, (newPlayer) => {
  // Clean up old listeners
  currentEventListeners.forEach(cleanup => cleanup())
  currentEventListeners = []

  if (newPlayer) {
    const updatePlayingState = () => {
      isPlaying.value = !newPlayer.paused
    }

    const onPlayStart = () => {
      updatePlayingState()
      // Wait a bit before reducing counters to ensure stable playback
      setTimeout(() => {
        if (newPlayer && !newPlayer.paused && !newPlayer.ended) {
          if (consecutiveErrorsAtSamePosition > 0) {
            consecutiveErrorsAtSamePosition = Math.max(0, consecutiveErrorsAtSamePosition - 1)
          }
        }
      }, 1000) // Wait 1 second of stable playback
    }

    let lastTimeUpdate = 0
    let stablePlaybackTime = 0
    const onTimeUpdate = () => {
      const currentTime = newPlayer.currentTime
      // Track stable playback time (continuous progress without errors)
      if (currentTime > lastTimeUpdate + 0.1) { // 100ms progress
        stablePlaybackTime += (currentTime - lastTimeUpdate)
        lastTimeUpdate = currentTime

        // Only reduce counters after 2 seconds of stable playback
        if (stablePlaybackTime >= 2.0) {
          if (videoErrorRetryCount > 0) {
            videoErrorRetryCount = Math.max(0, videoErrorRetryCount - 1)
            stablePlaybackTime = 0 // Reset to avoid frequent reductions
          }
          if (consecutiveErrorsAtSamePosition > 1) {
            consecutiveErrorsAtSamePosition = Math.max(0, consecutiveErrorsAtSamePosition - 1)
          }

          // Reset saved playback rate after stable playback
          if (lastPlaybackRateBeforeError > 1) {
            lastPlaybackRateBeforeError = 1
          }
        }
      } else {
        // Reset stable playback time if no progress (might indicate buffering/stalling)
        stablePlaybackTime = 0
      }
    }

    newPlayer.addEventListener('play', onPlayStart)
    newPlayer.addEventListener('pause', updatePlayingState)
    newPlayer.addEventListener('ended', updatePlayingState)
    newPlayer.addEventListener('timeupdate', onTimeUpdate)

    // Store cleanup function
    currentEventListeners.push(() => {
      newPlayer.removeEventListener('play', onPlayStart)
      newPlayer.removeEventListener('pause', updatePlayingState)
      newPlayer.removeEventListener('ended', updatePlayingState)
      newPlayer.removeEventListener('timeupdate', onTimeUpdate)
    })

    // Apply mute settings immediately when video player is ready
    if (shouldVideoMute.value) {
      newPlayer.volume = 0
      newPlayer.setAttribute('data-muted-by-app', 'true')
      isVideoMuted.value = true
    }

    // If we have stream data ready, load it now
    if (currentStreamData.value && playbackData.value) {
      nextTick(() => {
        loadVideoSource()
      })
    }
  }
})

// Watch for stream data changes
watch(() => currentStreamData.value, (newStreamData) => {
  if (newStreamData && videoPlayer.value && playbackData.value) {
    nextTick(() => {
      loadVideoSource()
    })
  }
})

// Watch for visibility changes - keep video playing when hidden
watch(isVisible, (visible) => {
  // Don't pause video when hidden - this is what enables background playback
  // The video continues playing in the background even when the component is not visible
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

  }
}, { immediate: true })

// Watch for stream changes to disable slide extraction if not screen recording
watch(isScreenRecordingSelected, (isScreenRecording) => {
  if (!isScreenRecording && isSlideExtractionEnabled.value) {
    isSlideExtractionEnabled.value = false
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.stopExtraction()
    }
    slideExtractionStatus.value.isRunning = false
  }
})

// Watch for slide extraction toggle to update playback rate
watch(isSlideExtractionEnabled, (enabled) => {
  if (enabled && videoPlayer.value && slideExtractorInstance.value) {
    // Update slide extractor with current playback rate when enabled
    slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
  }
})

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

// Slide extraction event handlers
const onSlideExtracted = (event: CustomEvent) => {
  const { slide, instanceId, mode } = event.detail
  // Only handle events from our instance
  if (instanceId === extractorInstanceId.value && mode === props.mode) {
    // Add the new slide to our local array
    extractedSlides.value.push(slide)
    updateSlideExtractionStatus()
  }
}

const onSlidesCleared = (event: CustomEvent) => {
  const { instanceId, mode } = event.detail
  // Only handle events from our instance
  if (instanceId === extractorInstanceId.value && mode === props.mode) {
    // Clear local slides array
    extractedSlides.value = []
    selectedSlide.value = null
    updateSlideExtractionStatus()
  }
}

// Lifecycle
onMounted(async () => {
  // Register video proxy client for independent mode support
  try {
    videoProxyClientId.value = await window.electronAPI.video.registerClient()
  } catch (error) {
    console.error('Failed to register video proxy client:', error)
  }

  // Load connection mode, mute mode, and video retry count from config
  try {
    const config = await window.electronAPI.config.get()
    connectionMode.value = config.connectionMode
    muteMode.value = config.muteMode || 'normal'
    maxVideoErrorRetries.value = config.videoRetryCount || 5
  } catch (error) {
    console.error('Failed to load config:', error)
  }

  // Add slide extraction event listeners
  window.addEventListener('slideExtracted', onSlideExtracted as EventListener)
  window.addEventListener('slidesCleared', onSlidesCleared as EventListener)

  // Wait for next tick to ensure video element is in DOM
  await nextTick()
  loadVideoStreams()
})

onUnmounted(async () => {
  // Stop slide extraction if running
  if (isSlideExtractionEnabled.value && slideExtractorInstance.value) {
    slideExtractorInstance.value.stopExtraction()
  }

  // Clean up extractor instance if it was created specifically for this component
  if (extractorInstanceId.value) {
    slideExtractionManager.removeExtractor(extractorInstanceId.value)
  }

  // Remove slide extraction event listeners
  window.removeEventListener('slideExtracted', onSlideExtracted as EventListener)
  window.removeEventListener('slidesCleared', onSlidesCleared as EventListener)

  // Clean up HLS
  cleanup()

  // Clean up event listeners
  currentEventListeners.forEach(cleanupFn => cleanupFn())
  currentEventListeners = []

  // Unregister video proxy client for independent mode support
  if (videoProxyClientId.value) {
    try {
      await window.electronAPI.video.unregisterClient(videoProxyClientId.value)
    } catch (err) {
      console.error('Failed to unregister video proxy client on unmount:', err)
    }
  }
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

.error-details {
  text-align: center;
  max-width: 500px;
}

.error-message {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
}

.error-info {
  margin: 12px 0;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #007acc;
}

.playback-position {
  margin: 0;
  font-size: 14px;
  color: #555;
}

.error-suggestion {
  margin: 16px 0;
  padding: 12px;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
}

.suggestion-text {
  margin: 0;
  font-size: 14px;
  color: #856404;
  line-height: 1.4;
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

.retry-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 20;
  backdrop-filter: blur(4px);
}

.retry-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

/* Slide extraction controls */
.slide-extraction-control {
  display: flex;
  align-items: center;
  gap: 16px;
}

.extraction-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
  color: #333;
}

.extraction-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-text {
  font-size: 14px;
  user-select: none;
}

.extraction-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
  font-size: 12px;
  font-weight: 500;
}

.extraction-status svg {
  flex-shrink: 0;
  color: #28a745;
}

/* Slide Gallery */
.slide-gallery {
  margin-top: 24px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.gallery-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.clear-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #dc3545;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-btn:hover {
  background-color: #c82333;
  border-color: #c82333;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.slide-thumbnail {
  position: relative;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e9ecef;
  cursor: pointer;
  transition: all 0.2s;
}

.slide-thumbnail:hover {
  border-color: #007acc;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.slide-thumbnail img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.thumbnail-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.slide-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.slide-title {
  font-size: 12px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slide-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.delete-btn {
  padding: 4px;
  border: none;
  border-radius: 4px;
  background-color: rgba(220, 53, 69, 0.8);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background-color: rgba(220, 53, 69, 1);
  transform: scale(1.1);
}

/* Slide Modal */
.slide-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-actions {
  display: flex;
  gap: 8px;
}

.modal-delete-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #dc3545;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-delete-btn:hover {
  background-color: #c82333;
  border-color: #c82333;
}

.modal-close-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #6c757d;
  border-radius: 4px;
  background-color: #6c757d;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background-color: #5a6268;
  border-color: #5a6268;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.slide-metadata {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.slide-metadata p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.slide-metadata strong {
  color: #333;
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

  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .slide-thumbnail img {
    height: 100px;
  }

  .modal-content {
    max-width: 95vw;
    max-height: 95vh;
  }

  .modal-header {
    padding: 12px 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-image {
    max-height: 60vh;
  }
}
</style>