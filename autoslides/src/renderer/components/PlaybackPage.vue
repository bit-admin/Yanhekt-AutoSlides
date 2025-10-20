<template>
  <div class="playback-page">
    <div class="header">
      <div class="header-main">
        <button @click="goBack" class="back-btn" :disabled="shouldDisableControls">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="title-info">
          <h2>{{ course?.title || $t('playback.unknownCourse') }}</h2>
          <p v-if="session">{{ session.title }}</p>
          <p v-if="course?.session?.section_group_title && props.mode === 'live'">{{ course.session.section_group_title }}</p>
          <div v-if="!isVisible && isPlaying" class="background-mode-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {{ $t('playback.playingInBackground') }}
          </div>
        </div>
        <button @click="toggleCourseDetails" class="expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="course-details">
        <div class="course-detail-item" v-if="course?.instructor">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ course.instructor }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.professors && course.professors.length > 0">
          <span class="detail-label">{{ $t('playback.professors') }}</span>
          <span class="detail-value">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.time">
          <span class="detail-label">{{ $t('sessions.academicTerm') }}</span>
          <span class="detail-value">{{ course.time }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.classrooms && course.classrooms.length > 0">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ course.classrooms.map(c => c.name).join(', ') }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.college_name">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ course.college_name }}</span>
        </div>
        <div class="course-detail-item" v-if="course?.participant_count !== undefined">
          <span class="detail-label">{{ $t('sessions.participants') }}</span>
          <span class="detail-value">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
        <div class="course-detail-item" v-if="session">
          <span class="detail-label">{{ $t('playback.sessionDate') }}</span>
          <span class="detail-value">{{ formatDate(session.started_at) }}</span>
        </div>
        <div class="course-detail-item" v-if="playbackData?.duration">
          <span class="detail-label">{{ $t('playback.duration') }}</span>
          <span class="detail-value">{{ formatDuration(playbackData.duration) }}</span>
        </div>
        <div class="course-detail-item" v-if="currentStreamData">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span class="detail-value">{{ currentStreamData.name }} ({{ currentStreamData.type === 'camera' ? $t('playback.cameraView') : $t('playback.screenRecording') }})</span>
        </div>
      </div>
    </div>

    <div class="content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
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
              <strong>{{ $t('playback.lastPlayedPosition') }}</strong> {{ formatDuration(Math.floor(lastPlaybackPosition)) }}
            </p>
          </div>
          <div v-if="error.includes('Failed after') || error.includes('retry attempts')" class="error-suggestion">
            <p class="suggestion-text">
              {{ $t('playback.networkProblems') }}
            </p>
          </div>
        </div>
        <button @click="retryLoad" class="retry-btn">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playbackData" class="video-content" :data-playback-mode="props.mode">

        <!-- Combined Warning Messages -->
        <div v-if="isTaskRunning || (props.mode === 'recorded' && showSpeedWarning)" class="combined-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          <div class="warning-messages">
            <div v-if="isTaskRunning" class="warning-message">
              {{ $t('playback.taskInProgress') }}
            </div>
            <div v-if="props.mode === 'recorded' && showSpeedWarning" class="warning-message">
              {{ $t('playback.highSpeedWarning') }}
            </div>
          </div>
        </div>

        <!-- Stream Selection and Playback Controls -->
        <div class="controls-row">
          <div v-if="Object.keys(playbackData.streams).length > 1" class="stream-selector">
            <label>{{ $t('playback.selectStream') }}</label>
            <select v-model="selectedStream" @change="switchStream" :disabled="shouldDisableControls || isSlideExtractionEnabled">
              <option v-for="(stream, key) in playbackData.streams" :key="key" :value="key">
                {{ stream.name }}
              </option>
            </select>
          </div>

          <!-- Custom Playback Rate Control (only for recorded videos) -->
          <div v-if="props.mode === 'recorded'" class="playback-rate-control">
            <label>{{ $t('playback.playbackSpeed') }}</label>
            <select v-model="currentPlaybackRate" @change="changePlaybackRate" :disabled="shouldDisableControls">
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

          <!-- Picture in Picture Toggle -->
          <div class="pip-control">
            <button
              class="pip-button"
              @click="togglePictureInPicture"
              :disabled="shouldDisableControls || !videoPlayer"
              :title="isPictureInPicture ? $t('playback.exitPictureInPicture') : $t('playback.enterPictureInPicture')"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 1px;">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <rect x="14" y="12" width="6" height="4" rx="1" fill="currentColor"/>
              </svg>
              <span>{{ isPictureInPicture ? $t('playback.exitPiP') : $t('playback.picInPic') }}</span>
            </button>
          </div>
        </div>

        <!-- Video Player -->
        <div class="video-container" :class="{ 'collapsed': isVideoContainerCollapsed }" :data-pip-message="$t('playback.videoPlayingInPiP')">
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
            @enterpictureinpicture="onEnterPictureInPicture"
            @leavepictureinpicture="onLeavePictureInPicture"
          >
            {{ $t('playback.browserNotSupported') }}
          </video>
          <div v-if="shouldVideoMute" class="mute-indicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <span>{{ muteMode === 'mute_all' ? $t('playback.mutedByApp') : muteMode === 'mute_live' ? $t('playback.liveMuted') : $t('playback.recordedMuted') }}</span>
          </div>
          <!-- Retry Indicator -->
          <div v-if="isRetrying" class="retry-indicator">
            <div class="retry-spinner"></div>
            <span>{{ retryMessage }}</span>
          </div>
        </div>

        <!-- Slide Gallery -->
        <div v-if="isScreenRecordingSelected" class="slide-gallery">
          <div class="gallery-header">
            <!-- Slide Extraction Controls -->
            <div class="slide-extraction-control">
              <div class="extraction-main">
                <label class="extraction-toggle">
                  <input
                    type="checkbox"
                    v-model="isSlideExtractionEnabled"
                    @change="toggleSlideExtraction"
                    :disabled="shouldDisableControls"
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-text">{{ $t('playback.slideExtraction') }}</span>
                </label>

                <div class="slide-counter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="counter-text">
                    {{ isSlideExtractionEnabled ? extractedSlides.length : 0 }} {{ $t('playback.slides') }}
                    <span v-if="isSlideExtractionEnabled" class="counter-status">{{ $t('playback.extracted') }}</span>
                  </span>
                </div>
              </div>

              <div class="slide-actions">
                <!-- Post-processing Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="executePostProcessing"
                  class="post-process-btn"
                  :disabled="isPostProcessing"
                  title="Execute post-processing on all saved slides"
                >
                  <svg v-if="!isPostProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="m2 17 10 5 10-5"/>
                    <path d="m2 12 10 5 10-5"/>
                  </svg>
                  <div v-else class="processing-spinner"></div>
                  {{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}
                </button>

                <!-- Clear All Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="clearAllSlides"
                  class="clear-all-btn"
                  title="Move all slides to trash"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  {{ $t('playback.clearAll') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Gallery Grid (only show when slides exist) -->
          <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0" class="gallery-grid">
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
                  :title="`Move ${slide.title} to trash`"
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
        <p>{{ $t('playback.noVideoStreams') }}</p>
      </div>
    </div>

    <!-- Slide Preview Modal -->
    <div v-if="selectedSlide" class="slide-modal" @click="closeSlideModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedSlide.title }}</h3>
          <div class="modal-actions">
            <button @click="deleteSlide(selectedSlide)" class="modal-delete-btn" title="Move slide to trash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              {{ $t('playback.moveToTrash') }}
            </button>
            <button @click="closeSlideModal" class="modal-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {{ $t('playback.close') }}
            </button>
          </div>
        </div>
        <div class="modal-body">
          <img :src="selectedSlide.dataUrl" :alt="selectedSlide.title" class="modal-image" />
          <div class="slide-metadata">
            <p><strong>{{ $t('playback.extractedAt') }}</strong> {{ formatSlideTime(selectedSlide.timestamp) }}</p>
            <p><strong>{{ $t('playback.fileName') }}</strong> {{ selectedSlide.title }}.png</p>
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
import { TaskQueue } from '../services/taskQueueService'
import { ssimThresholdService } from '../services/ssimThresholdService'
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

// Post-processing state
const isPostProcessing = ref(false)

// Task queue state
const currentTaskId = ref<string | null>(null)
const isTaskMode = ref(false)
const taskSpeed = ref(10) // Default task speed

// Picture in Picture state
const isPictureInPicture = ref(false)
const isVideoContainerCollapsed = ref(false)

// Performance optimization state for background playback
const isDocumentVisible = ref(true)
const keepAliveInterval = ref<NodeJS.Timeout | null>(null)
const wakeLock = ref<WakeLockSentinel | null>(null)
const performanceMonitorInterval = ref<NodeJS.Timeout | null>(null)
const preventSystemSleep = ref(false) // Configuration setting for enabling performance optimizations

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

// Computed property to check if task is currently running
const isTaskRunning = computed(() => {
  return isTaskMode.value && currentTaskId.value !== null
})

// Computed property to determine if UI controls should be disabled during task execution
const shouldDisableControls = computed(() => {
  return isTaskRunning.value
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

const toggleCourseDetails = () => {
  showDetails.value = !showDetails.value
}

// Picture in Picture methods
const togglePictureInPicture = async () => {
  if (!videoPlayer.value) return

  try {
    if (isPictureInPicture.value) {
      // Exit PiP mode
      await document.exitPictureInPicture()
    } else {
      // Enter PiP mode
      await videoPlayer.value.requestPictureInPicture()
    }
  } catch (error) {
    console.error('Picture in Picture error:', error)
  }
}

const onEnterPictureInPicture = () => {
  isPictureInPicture.value = true
  isVideoContainerCollapsed.value = true
}

const onLeavePictureInPicture = () => {
  isPictureInPicture.value = false
  isVideoContainerCollapsed.value = false
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

      // Check if we need to initialize task after video loading completes
      if (isTaskMode.value && currentTaskId.value) {
        console.log('Video loaded, checking task initialization for:', currentTaskId.value)
        // Wait for video to be fully ready before initializing task
        waitForVideoReady().then(() => {
          initializeTaskAfterVideoLoad(currentTaskId.value!)
        }).catch(error => {
          console.error('Video readiness check failed for task:', currentTaskId.value, error)
          handleTaskError('Video failed to become ready: ' + error.message)
        })
      }
    } else {
      throw new Error('No video streams available')
    }

  } catch (err: any) {
    console.error('Failed to load video streams:', err)
    error.value = err.message || 'Failed to load video streams'
    handleTaskError(err.message || 'Failed to load video streams')
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
                handleTaskError('Network error: Unable to load video after multiple attempts')
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
    const errorMessage = 'Failed to load video source: ' + err.message
    error.value = errorMessage

    // Handle task error if in task mode - this will continue to next task
    handleTaskError(errorMessage)

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
                handleTaskError('Network error: Unable to load video after multiple attempts')
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
    const errorMessage = 'Failed to load video source: ' + err.message
    error.value = errorMessage

    // Handle task error if in task mode - this will continue to next task
    handleTaskError(errorMessage)

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

// Update SSIM threshold based on classroom information
const updateSSIMThresholdForClassrooms = () => {
  try {
    // Get classroom information from course data
    const classrooms = props.course?.classrooms

    if (classrooms && classrooms.length > 0) {
      console.log('Setting classroom context for SSIM threshold:', classrooms.map(c => c.name).join(', '))
      ssimThresholdService.setCurrentClassrooms(classrooms)
    } else {
      console.log('No classroom information available, clearing SSIM classroom context')
      ssimThresholdService.setCurrentClassrooms(null)
    }
  } catch (error) {
    console.error('Failed to update SSIM threshold for classrooms:', error)
  }
}

// Initialize slide extraction with course/session context
const initializeSlideExtraction = async () => {
  try {
    // Update SSIM threshold based on classroom information before starting extraction
    updateSSIMThresholdForClassrooms()

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

    // Handle task error if in task mode - this will continue to next task
    handleTaskError(userMessage)

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

const deleteSlide = async (slide: ExtractedSlide, showConfirmation: boolean = true) => {
  try {
    // Show confirmation dialog if requested
    if (showConfirmation) {
      const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
        type: 'question',
        buttons: ['Cancel', 'Move to Trash'],
        defaultId: 1,
        cancelId: 0,
        title: 'Delete Slide',
        message: `Are you sure you want to delete "${slide.title}.png"?`,
        detail: 'The file will be moved to your system trash and can be restored if needed.'
      })

      if (confirmed?.response !== 1) {
        return // User cancelled
      }
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

    console.log(`Slide moved to trash: ${slide.title}`)
  } catch (error) {
    console.error('Failed to move slide to trash:', error)
    // Show error dialog
    const errorMessage = error instanceof Error ? error.message : String(error)
    await window.electronAPI.dialog?.showErrorBox?.('Move to Trash Failed', `Failed to move slide to trash: ${errorMessage}`)
  }
}

const clearAllSlides = async () => {
  try {
    if (extractedSlides.value.length === 0) {
      return
    }

    // Show confirmation dialog
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'question',
      buttons: ['Cancel', 'Move All to Trash'],
      defaultId: 1,
      cancelId: 0,
      title: 'Delete All Slides',
      message: `Are you sure you want to delete all ${extractedSlides.value.length} slide(s)?`,
      detail: 'All slide files will be moved to your system trash and can be restored if needed.'
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

    console.log('All slides moved to trash')
  } catch (error) {
    console.error('Failed to move all slides to trash:', error)
    // Show error dialog
    const errorMessage = error instanceof Error ? error.message : String(error)
    await window.electronAPI.dialog?.showErrorBox?.('Move to Trash Failed', `Failed to move slides to trash: ${errorMessage}`)
  }
}

// Execute post-processing on all saved slides
const executePostProcessing = async () => {
  try {
    if (extractedSlides.value.length === 0) {
      return
    }

    // Get the output path from the slide extractor
    const outputPath = slideExtractorInstance.value?.getOutputPath()
    if (!outputPath) {
      throw new Error('Output path not found')
    }

    // Get pHash configuration
    const config = await window.electronAPI.config?.getSlideExtractionConfig?.()
    if (!config) {
      throw new Error('Failed to get slide extraction configuration')
    }

    const pHashThreshold = config.pHashThreshold || 10
    const exclusionList = config.pHashExclusionList || []

    isPostProcessing.value = true
    console.log(`Starting post-processing for ${extractedSlides.value.length} slides...`)
    console.log(`Using pHash threshold: ${pHashThreshold}, exclusion list items: ${exclusionList.length}`)

    // Create post-processing worker to calculate pHash for all saved images
    const worker = new Worker(new URL('../workers/postProcessor.worker.ts', import.meta.url), { type: 'module' })

    // Helper function to calculate Hamming distance using worker
    const calculateHammingDistanceWithWorker = (hash1: string, hash2: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const messageId = `hamming_${Date.now()}_${Math.random()}`

        const messageHandler = (event: MessageEvent) => {
          const { id, success, result, error } = event.data
          if (id === messageId) {
            worker.removeEventListener('message', messageHandler)
            if (success) {
              resolve(result)
            } else {
              reject(new Error(error))
            }
          }
        }

        worker.addEventListener('message', messageHandler)
        worker.postMessage({
          id: messageId,
          type: 'calculateHammingDistance',
          data: { hash1, hash2 }
        })
      })
    }

    // Process each slide individually to avoid memory issues
    const results: Array<{ filename: string; pHash: string; excluded?: boolean; excludedReason?: string; error?: string }> = []
    const deletedSlides: string[] = []
    let processedCount = 0

    for (const slide of extractedSlides.value) {
      try {
        const filename = `${slide.title}.png`

        // Use the ImageData that's already in memory - no need to reload from file!
        const imageData = slide.imageData

        // Calculate pHash using worker
        const pHashPromise = new Promise<string>((resolve, reject) => {
          const messageId = `pHash_${Date.now()}_${Math.random()}`

          const messageHandler = (event: MessageEvent) => {
            const { id, success, result, error } = event.data
            if (id === messageId) {
              worker.removeEventListener('message', messageHandler)
              if (success) {
                resolve(result)
              } else {
                reject(new Error(error))
              }
            }
          }

          worker.addEventListener('message', messageHandler)
          worker.postMessage({
            id: messageId,
            type: 'calculatePHash',
            data: { imageData }
          })
        })

        const pHash = await pHashPromise

        // Check against exclusion list
        let shouldExclude = false
        let excludedReason = ''

        for (const exclusionItem of exclusionList) {
          try {
            const hammingDistance = await calculateHammingDistanceWithWorker(pHash, exclusionItem.pHash)
            if (hammingDistance <= pHashThreshold) {
              shouldExclude = true
              excludedReason = `Similar to excluded item "${exclusionItem.name}" (Hamming distance: ${hammingDistance})`
              console.log(`Slide ${filename} excluded: ${excludedReason}`)
              break
            }
          } catch (error) {
            console.warn(`Failed to calculate Hamming distance for exclusion item "${exclusionItem.name}":`, error)
          }
        }

        // If slide should be excluded, delete it
        if (shouldExclude) {
          try {
            await deleteSlide(slide, false) // false = don't show confirmation dialog
            deletedSlides.push(filename)
            results.push({
              filename,
              pHash,
              excluded: true,
              excludedReason
            })
          } catch (deleteError) {
            console.error(`Failed to delete excluded slide ${filename}:`, deleteError)
            results.push({
              filename,
              pHash,
              excluded: false,
              error: `Failed to delete: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`
            })
          }
        } else {
          results.push({
            filename,
            pHash,
            excluded: false
          })
        }

        processedCount++
        console.log(`Processed ${filename} (${processedCount}/${extractedSlides.value.length}): pHash = ${pHash}${shouldExclude ? ' [EXCLUDED]' : ''}`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Failed to process ${slide.title}:`, errorMessage)

        results.push({
          filename: `${slide.title}.png`,
          pHash: '',
          error: errorMessage
        })
      }
    }

    worker.terminate()

    // Calculate summary statistics
    const totalSlides = extractedSlides.value.length
    const processedSlides = results.filter(r => !r.error).length
    const failedSlides = results.filter(r => r.error).length
    const excludedSlides = results.filter(r => r.excluded).length

    console.log('Post-processing completed successfully:', {
      totalSlides,
      processedSlides,
      failedSlides,
      excludedSlides,
      deletedSlides: deletedSlides.length
    })

    // Show success dialog
    await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      title: 'Post-processing Completed',
      message: `Post-processing completed successfully!`,
      detail: `Processed: ${processedSlides}/${totalSlides} slides\nExcluded and deleted: ${excludedSlides} slides${failedSlides > 0 ? `\nFailed: ${failedSlides} slides` : ''}`
    })

  } catch (error) {
    console.error('Failed to execute post-processing:', error)
    // Show error dialog
    const errorMessage = error instanceof Error ? error.message : String(error)
    await window.electronAPI.dialog?.showErrorBox?.('Post-processing Failed', `Failed to execute post-processing: ${errorMessage}`)
  } finally {
    isPostProcessing.value = false
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

      // Start performance optimization mechanisms when video starts playing
      startKeepAlive()
      requestWakeLock()
      requestPowerManagement()

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

        // Update task progress if in task mode
        updateTaskProgress()

        // Check for task completion
        checkVideoCompletion()

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

    const onPauseOrEnd = () => {
      updatePlayingState()
      // Stop performance optimization mechanisms when video stops
      stopKeepAlive()
      releaseWakeLock()
      releasePowerManagement()
    }

    newPlayer.addEventListener('play', onPlayStart)
    newPlayer.addEventListener('pause', onPauseOrEnd)
    newPlayer.addEventListener('ended', onPauseOrEnd)
    newPlayer.addEventListener('ended', onVideoEnded) // Add task completion detection
    newPlayer.addEventListener('timeupdate', onTimeUpdate)

    // Store cleanup function
    currentEventListeners.push(() => {
      newPlayer.removeEventListener('play', onPlayStart)
      newPlayer.removeEventListener('pause', onPauseOrEnd)
      newPlayer.removeEventListener('ended', onPauseOrEnd)
      newPlayer.removeEventListener('ended', onVideoEnded)
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
watch(isVisible, () => {
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

// Watch for course changes to update SSIM threshold
watch(() => props.course, () => {
  updateSSIMThresholdForClassrooms()
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

// Task queue event handlers
const onTaskStart = (event: CustomEvent) => {
  const { taskId, sessionId, retryCount } = event.detail

  // Check if this task is for our session (only for recorded mode)
  if (props.mode === 'recorded' && props.sessionId === sessionId) {
    // If this is a retry and we already have this task, don't reinitialize
    if (currentTaskId.value === taskId && isTaskMode.value) {
      console.log(`Task start retry ${retryCount || 1} for already active task:`, taskId)
      return
    }

    console.log(`Task start event received (attempt ${retryCount || 1}) for:`, taskId)

    currentTaskId.value = taskId
    isTaskMode.value = true

    // Update task status to in progress (only on first attempt)
    if (!retryCount || retryCount === 1) {
      TaskQueue.updateTaskStatus(taskId, 'in_progress')
    }

    // Start the task initialization process
    initializeTask(taskId)
  }
}

const onTaskPause = (event: CustomEvent) => {
  const { taskId, sessionId } = event.detail

  // Check if this pause event is for our session (for recorded mode) or if we're in task mode
  if ((props.mode === 'recorded' && props.sessionId === sessionId) ||
      (isTaskMode.value && currentTaskId.value === taskId)) {

    console.log('Task pause received for:', taskId)

    // Pause video playback if it's playing
    if (videoPlayer.value && !videoPlayer.value.paused) {
      console.log('Pausing video playback for task:', taskId)
      videoPlayer.value.pause()
    }

    // Reset task mode but keep task ID for potential resume
    isTaskMode.value = false

    // Stop slide extraction if running
    if (isSlideExtractionEnabled.value) {
      console.log('Stopping slide extraction for task:', taskId)
      isSlideExtractionEnabled.value = false
      toggleSlideExtraction()
    }
  }
}

const onTaskResume = (event: CustomEvent) => {
  const { taskId, sessionId } = event.detail

  // Check if this is our task and session
  if (props.mode === 'recorded' && props.sessionId === sessionId && currentTaskId.value === taskId) {
    isTaskMode.value = true

    // Re-initialize task for resume
    initializeTaskResume(taskId)
  }
}

// Wait for video to be fully ready for task processing
const waitForVideoReady = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = 20000 // 20 second timeout (increased for HLS stability)
    const startTime = Date.now()
    let consecutiveReadyChecks = 0
    const requiredConsecutiveChecks = 3 // Require 3 consecutive successful checks

    const checkVideoReady = () => {
      // Check if we've exceeded timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error('Video readiness timeout'))
        return
      }

      // Check all required conditions for video readiness
      const video = videoPlayer.value
      if (!video) {
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // Check if video has loaded metadata and is ready to play
      if (video.readyState < 2) { // HAVE_CURRENT_DATA or higher (more lenient)
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // Check if HLS is ready (if using HLS) - more lenient check
      if (hls.value && hls.value.media !== video) {
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // Check if we have valid duration (allow for live streams with no duration)
      if (video.duration && (video.duration === 0 || isNaN(video.duration))) {
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // Check if playback data and stream are ready
      if (!playbackData.value || !selectedStream.value || loading.value) {
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // Check if there are any current fatal errors
      if (error.value && error.value.includes('fatal')) {
        consecutiveReadyChecks = 0
        setTimeout(checkVideoReady, 200)
        return
      }

      // All conditions met - increment consecutive checks
      consecutiveReadyChecks++

      if (consecutiveReadyChecks >= requiredConsecutiveChecks) {
        // Video has been stable for required checks - it's ready
        console.log(`Video is fully ready for task processing (${consecutiveReadyChecks} consecutive checks)`)
        resolve()
      } else {
        // Continue checking for stability
        setTimeout(checkVideoReady, 200)
      }
    }

    // Start checking
    checkVideoReady()
  })
}

// Initialize task after video is confirmed ready
const initializeTaskAfterVideoLoad = async (taskId: string, retryCount = 0) => {
  const maxRetries = 3
  const retryDelay = 2000 // 2 seconds between retries

  try {
    console.log(`Initializing task after video load (attempt ${retryCount + 1}/${maxRetries + 1}):`, taskId)

    // Update SSIM threshold based on classroom information from stored session data
    if (props.sessionId) {
      const sessionData = DataStore.getSessionData(props.sessionId)
      if (sessionData?.courseInfo?.classrooms) {
        console.log('Setting classroom context for task SSIM threshold:', sessionData.courseInfo.classrooms.map(c => c.name).join(', '))
        ssimThresholdService.setCurrentClassrooms(sessionData.courseInfo.classrooms)
      }
    }

    // Ensure we're on screen recording stream for task mode
    const screenStreamKey = Object.keys(playbackData.value?.streams || {}).find(
      key => playbackData.value?.streams[key].type === 'screen'
    )

    if (!screenStreamKey) {
      throw new Error('No screen recording stream available for task')
    }

    if (selectedStream.value !== screenStreamKey) {
      console.log('Switching to screen recording for task:', taskId)
      selectedStream.value = screenStreamKey
      await switchStream()
      // Wait a bit more for stream switch to complete
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Set task speed for playback rate (only for recorded mode)
    if (videoPlayer.value && props.mode === 'recorded') {
      currentPlaybackRate.value = taskSpeed.value
      videoPlayer.value.playbackRate = taskSpeed.value
      console.log('Set task playback rate to:', taskSpeed.value)
    }

    // Initialize slide extraction if not already enabled
    if (!isSlideExtractionEnabled.value) {
      console.log('Auto-starting slide extraction for task:', taskId)
      isSlideExtractionEnabled.value = true
      await toggleSlideExtraction()

      // Wait for slide extraction to be fully initialized with longer timeout
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verify slide extraction started successfully
      if (!slideExtractorInstance.value || !slideExtractionStatus.value.isRunning) {
        throw new Error('Failed to start slide extraction')
      }
    }

    // Update slide extractor with task speed
    if (slideExtractorInstance.value) {
      slideExtractorInstance.value.updatePlaybackRate(taskSpeed.value)
    }

    // Auto-play the video if not already playing
    if (videoPlayer.value && videoPlayer.value.paused) {
      try {
        await videoPlayer.value.play()
        console.log('Video playback started for task:', taskId)
      } catch (error) {
        throw new Error('Failed to start video playback: ' + error)
      }
    }

    // Reset progress tracking for new task
    lastReportedProgress = -1

    console.log('Task initialized successfully after video load:', taskId)
  } catch (error) {
    console.error(`Task initialization failed after video load (attempt ${retryCount + 1}):`, taskId, error)

    // Retry logic for recoverable errors
    if (retryCount < maxRetries) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if this is a recoverable error (slide extraction or temporary video issues)
      const isRecoverableError = errorMessage.includes('Failed to start slide extraction') ||
                                errorMessage.includes('Failed to start video playback') ||
                                errorMessage.includes('No screen recording stream available')

      if (isRecoverableError) {
        console.log(`Retrying task initialization in ${retryDelay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return initializeTaskAfterVideoLoad(taskId, retryCount + 1)
      }
    }

    // Final failure after all retries or non-recoverable error
    const errorMessage = error instanceof Error ? error.message : String(error)
    handleTaskError(`Task initialization failed after ${retryCount + 1} attempts: ${errorMessage}`)
  }
}

// Initialize task with improved error handling and video readiness check
const initializeTask = async (taskId: string, retryCount = 0) => {
  const maxRetries = 2
  const retryDelay = 3000 // 3 seconds between retries

  try {
    console.log(`Starting task initialization (attempt ${retryCount + 1}/${maxRetries + 1}):`, taskId)

    // First check if basic requirements are met
    if (!playbackData.value || loading.value) {
      console.log('Video data not ready, waiting for video to load...')
      // Wait for video to be ready with timeout
      await waitForVideoReady()
    }

    // Now initialize the task with the confirmed ready video
    await initializeTaskAfterVideoLoad(taskId)
  } catch (error) {
    console.error(`Task initialization failed (attempt ${retryCount + 1}):`, taskId, error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Retry logic for video readiness timeout or recoverable errors
    if (retryCount < maxRetries) {
      const isRecoverableError = errorMessage.includes('Video readiness timeout') ||
                                errorMessage.includes('Failed to start slide extraction') ||
                                errorMessage.includes('Failed to start video playback')

      if (isRecoverableError) {
        console.log(`Retrying task initialization in ${retryDelay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return initializeTask(taskId, retryCount + 1)
      }
    }

    // Final failure after all retries or non-recoverable error
    TaskQueue.updateTaskStatus(taskId, 'error', `Task initialization failed after ${retryCount + 1} attempts: ${errorMessage}`)
  }
}

// Initialize task resume with current video state
const initializeTaskResume = async (taskId: string) => {
  try {
    console.log('Resuming task:', taskId)

    // Update SSIM threshold based on classroom information from stored session data
    if (props.sessionId) {
      const sessionData = DataStore.getSessionData(props.sessionId)
      if (sessionData?.courseInfo?.classrooms) {
        console.log('Setting classroom context for resumed task SSIM threshold:', sessionData.courseInfo.classrooms.map(c => c.name).join(', '))
        ssimThresholdService.setCurrentClassrooms(sessionData.courseInfo.classrooms)
      }
    }

    // Wait for video to be ready before resuming
    await waitForVideoReady()

    // Check if we're still on the correct video source (screen recording)
    if (!isScreenRecordingSelected.value) {
      // Try to switch to screen recording if available
      const screenStreamKey = Object.keys(playbackData.value?.streams || {}).find(
        key => playbackData.value?.streams[key].type === 'screen'
      )

      if (screenStreamKey) {
        selectedStream.value = screenStreamKey
        await switchStream()
        // Wait for stream switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        throw new Error('Screen recording not available for task resume')
      }
    }

    // Set task speed for playback rate
    if (videoPlayer.value && props.mode === 'recorded') {
      currentPlaybackRate.value = taskSpeed.value
      videoPlayer.value.playbackRate = taskSpeed.value

      // Update slide extractor with task speed
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.updatePlaybackRate(taskSpeed.value)
      }
    }

    // Start slide extraction if not already enabled
    if (!isSlideExtractionEnabled.value) {
      isSlideExtractionEnabled.value = true
      await toggleSlideExtraction()

      // Wait for slide extraction to initialize
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify slide extraction started
      if (!slideExtractorInstance.value || !slideExtractionStatus.value.isRunning) {
        throw new Error('Failed to start slide extraction on resume')
      }
    }

    // Resume video playback if it was paused
    if (videoPlayer.value && videoPlayer.value.paused) {
      await videoPlayer.value.play()
      console.log('Video playback resumed for task:', taskId)
    }

    // Reset progress tracking for resumed task
    lastReportedProgress = -1

    console.log('Task resumed successfully:', taskId)
  } catch (error) {
    console.error('Failed to resume task:', taskId, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    TaskQueue.updateTaskStatus(taskId, 'error', 'Task resume failed: ' + errorMessage)
    currentTaskId.value = null
    isTaskMode.value = false
  }
}

// Track last reported progress to avoid unnecessary updates
let lastReportedProgress = -1

// Update task progress based on video playback progress
const updateTaskProgress = () => {
  if (!isTaskMode.value || !currentTaskId.value || !videoPlayer.value) return

  const video = videoPlayer.value
  const duration = video.duration
  const currentTime = video.currentTime

  // Only update progress if we have valid duration and current time
  if (duration > 0 && currentTime >= 0) {
    const progressPercentage = Math.min(99, Math.max(0, Math.floor((currentTime / duration) * 100)))

    // Only update if progress has actually changed (avoid unnecessary updates)
    if (progressPercentage !== lastReportedProgress) {
      lastReportedProgress = progressPercentage
      TaskQueue.updateTaskProgress(currentTaskId.value, progressPercentage)
    }
  }
}

const checkVideoCompletion = () => {
  if (!isTaskMode.value || !currentTaskId.value || !videoPlayer.value) return

  const video = videoPlayer.value
  const duration = video.duration
  const currentTime = video.currentTime

  // Check if video is near completion (within 5 seconds or 99% complete)
  if (duration > 0 && (currentTime >= duration - 5 || currentTime / duration >= 0.99)) {
    console.log('Video completion detected via timeupdate for task:', currentTaskId.value)
    completeCurrentTask()
  }
}

// Handle video ended event as backup completion detection
const onVideoEnded = () => {
  if (isTaskMode.value && currentTaskId.value) {
    console.log('Video completion detected via ended event for task:', currentTaskId.value)
    completeCurrentTask()
  }
}

// Complete the current task (extracted to avoid duplication)
const completeCurrentTask = () => {
  if (!isTaskMode.value || !currentTaskId.value) return

  const taskId = currentTaskId.value
  console.log('Completing task:', taskId)

  // Mark task as completed
  TaskQueue.updateTaskStatus(taskId, 'completed')

  // Clean up task state
  cleanupTaskState()
}

const handleTaskError = (errorMessage: string) => {
  if (isTaskMode.value && currentTaskId.value) {
    console.log('Task error occurred:', currentTaskId.value, errorMessage)

    // Mark task as error - this will trigger automatic continuation to next task
    TaskQueue.updateTaskStatus(currentTaskId.value, 'error', errorMessage)

    // Clean up task state
    cleanupTaskState()
  }
}

// Clean up task state when task ends (success, error, or cancellation)
const cleanupTaskState = () => {
  // Reset task mode
  currentTaskId.value = null
  isTaskMode.value = false

  // Stop slide extraction
  if (isSlideExtractionEnabled.value) {
    isSlideExtractionEnabled.value = false
    toggleSlideExtraction()
  }

  // Clear error state to allow next task to start fresh
  error.value = null
  isRetrying.value = false
  retryMessage.value = ''

  // Reset progress tracking
  lastReportedProgress = -1

  // Reset video error counters for fresh start
  videoErrorRetryCount = 0
  consecutiveErrorsAtSamePosition = 0
  lastErrorPosition = -1
  lastPlaybackRateBeforeError = 1

  console.log('Task state cleaned up')
}

// Performance optimization functions for background playback
const handleVisibilityChange = () => {
  isDocumentVisible.value = !document.hidden

  if (document.hidden) {
    console.log('Page hidden - maintaining video performance with enhanced monitoring')
    // Start enhanced monitoring when page is hidden
    startPerformanceMonitoring()
  } else {
    console.log('Page visible - normal operation')
    // Stop enhanced monitoring when page is visible
    stopPerformanceMonitoring()
  }
}

// Keep-alive mechanism to prevent browser throttling
const startKeepAlive = () => {
  if (!preventSystemSleep.value) {
    console.log('Keep-alive mechanism disabled (preventSystemSleep is off)')
    return
  }

  if (keepAliveInterval.value) return

  console.log('Starting keep-alive mechanism for background playback')
  keepAliveInterval.value = setInterval(() => {
    if (videoPlayer.value && !videoPlayer.value.paused) {
      const currentTime = videoPlayer.value.currentTime
      const expectedRate = currentPlaybackRate.value

      // Check if playback rate has been throttled
      if (Math.abs(videoPlayer.value.playbackRate - expectedRate) > 0.01) {
        console.log(`Playback rate drift detected: ${videoPlayer.value.playbackRate} vs expected ${expectedRate}, correcting...`)
        videoPlayer.value.playbackRate = expectedRate
      }

      // Light activity to prevent throttling
      if (currentTime > 0) {
        // This helps maintain JavaScript execution priority
        performance.mark(`keepalive-${Date.now()}`)
      }
    }
  }, 3000) // Check every 3 seconds
}

const stopKeepAlive = () => {
  if (keepAliveInterval.value) {
    clearInterval(keepAliveInterval.value)
    keepAliveInterval.value = null
    console.log('Keep-alive mechanism stopped')
  }
}

// Enhanced performance monitoring for background playback
const startPerformanceMonitoring = () => {
  if (!preventSystemSleep.value) {
    console.log('Enhanced performance monitoring disabled (preventSystemSleep is off)')
    return
  }

  if (performanceMonitorInterval.value) return

  console.log('Starting enhanced performance monitoring')
  performanceMonitorInterval.value = setInterval(() => {
    if (videoPlayer.value && !videoPlayer.value.paused) {
      const video = videoPlayer.value
      const currentTime = video.currentTime
      const buffered = video.buffered

      // Check buffering health
      let bufferedAhead = 0
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
          bufferedAhead = buffered.end(i) - currentTime
          break
        }
      }

      // Log performance metrics when in background
      if (document.hidden) {
        console.log(`Background playback status: time=${currentTime.toFixed(1)}s, rate=${video.playbackRate}x, buffered=${bufferedAhead.toFixed(1)}s ahead`)

        // If buffer is getting low in background, this might indicate throttling
        if (bufferedAhead < 10 && hls.value) {
          console.log('Low buffer detected in background, requesting more data')
          // Trigger HLS to load more segments
          try {
            hls.value.startLoad()
          } catch (e) {
            // Ignore errors, this is just a hint to HLS
          }
        }
      }
    }
  }, 10000) // Check every 10 seconds when in background
}

const stopPerformanceMonitoring = () => {
  if (performanceMonitorInterval.value) {
    clearInterval(performanceMonitorInterval.value)
    performanceMonitorInterval.value = null
    console.log('Enhanced performance monitoring stopped')
  }
}

// Wake Lock API support for preventing screen sleep
const requestWakeLock = async () => {
  if (!preventSystemSleep.value) {
    console.log('Wake lock disabled (preventSystemSleep is off)')
    return
  }

  try {
    if ('wakeLock' in navigator && !wakeLock.value) {
      wakeLock.value = await (navigator as any).wakeLock.request('screen')
      console.log('Wake lock acquired to prevent screen sleep')

      wakeLock.value?.addEventListener('release', () => {
        console.log('Wake lock released')
        wakeLock.value = null
      })
    }
  } catch (err) {
    console.log('Wake lock request failed (not supported or denied):', err)
  }
}

const releaseWakeLock = () => {
  if (wakeLock.value) {
    wakeLock.value.release()
    wakeLock.value = null
    console.log('Wake lock manually released')
  }
}

// Power management integration
const requestPowerManagement = async () => {
  if (!preventSystemSleep.value) {
    console.log('System sleep prevention disabled (preventSystemSleep is off)')
    return
  }

  try {
    await window.electronAPI.powerManagement?.preventSleep?.()
    console.log('System sleep prevention requested')
  } catch (err) {
    console.log('Power management request failed:', err)
  }
}

const releasePowerManagement = async () => {
  try {
    await window.electronAPI.powerManagement?.allowSleep?.()
    console.log('System sleep prevention released')
  } catch (err) {
    console.log('Power management release failed:', err)
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

  // Load connection mode, mute mode, video retry count, task speed, and prevent system sleep setting from config
  try {
    const config = await window.electronAPI.config.get()
    connectionMode.value = config.connectionMode
    muteMode.value = config.muteMode || 'normal'
    maxVideoErrorRetries.value = config.videoRetryCount || 5
    taskSpeed.value = config.taskSpeed || 10
    preventSystemSleep.value = config.preventSystemSleep || false
    console.log('Performance optimization setting (preventSystemSleep):', preventSystemSleep.value)
  } catch (error) {
    console.error('Failed to load config:', error)
  }

  // Update SSIM threshold based on classroom information
  updateSSIMThresholdForClassrooms()

  // Add slide extraction event listeners
  window.addEventListener('slideExtracted', onSlideExtracted as EventListener)
  window.addEventListener('slidesCleared', onSlidesCleared as EventListener)

  // Add task queue event listeners
  window.addEventListener('taskStart', onTaskStart as EventListener)
  window.addEventListener('taskPause', onTaskPause as EventListener)
  window.addEventListener('taskResume', onTaskResume as EventListener)

  // Add page visibility change listener for background performance optimization
  document.addEventListener('visibilitychange', handleVisibilityChange)

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

  // Remove task queue event listeners
  window.removeEventListener('taskStart', onTaskStart as EventListener)
  window.removeEventListener('taskPause', onTaskPause as EventListener)
  window.removeEventListener('taskResume', onTaskResume as EventListener)

  // Remove page visibility change listener
  document.removeEventListener('visibilitychange', handleVisibilityChange)

  // Clean up performance optimization mechanisms
  stopKeepAlive()
  stopPerformanceMonitoring()
  releaseWakeLock()
  releasePowerManagement()

  // Clean up Picture in Picture if active
  if (isPictureInPicture.value && document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture()
    } catch (error) {
      console.error('Error exiting Picture in Picture on unmount:', error)
    }
  }

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
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f8f9fa;
  margin-bottom: 24px;
  overflow: hidden;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
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

.back-btn:hover:not(:disabled) {
  border-color: #007acc;
  color: #007acc;
}

.back-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
}

.title-info {
  flex: 1;
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

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-btn:hover {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.course-details {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.course-detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
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
  gap: 12px;
}

/* Video content group - controls, video, and gallery header form a visual unit */
.video-content .controls-row {
  margin-bottom: 0;
}

.video-content .video-container {
  margin-bottom: 0;
}

.video-content .slide-gallery {
  margin-top: 0;
}

.video-content .slide-gallery .gallery-header {
  margin-bottom: 16px;
  border-top: none;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

/* Compact spacing for warning when it appears before the main content group */
.video-content .combined-warning + .controls-row {
  margin-top: 0;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
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

.stream-selector select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
}

.video-container {
  position: relative;
  width: 100%;
  background-color: #000;
  border: 1px solid #e9ecef;
  border-top: none;
  border-radius: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.video-container.collapsed {
  height: 60px;
  background-color: #f8f9fa;
  border-color: #dee2e6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-container.collapsed .video-player {
  display: none;
}

.video-container.collapsed .mute-indicator,
.video-container.collapsed .retry-indicator {
  display: none;
}

.video-container.collapsed::after {
  content: attr(data-pip-message);
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
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

.playback-rate-control select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
}

/* Picture in Picture Control */
.pip-control {
  display: flex;
  align-items: center;
}

.pip-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pip-button:hover:not(:disabled) {
  background-color: #f8f9fa;
  border-color: #007acc;
}

.pip-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
}

.pip-button svg {
  flex-shrink: 0;
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

/* Combined warning */
.combined-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  margin: 0 0 8px 0;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  color: #856404;
  font-size: 14px;
  line-height: 1.4;
}

.combined-warning svg {
  flex-shrink: 0;
  color: #f39c12;
  margin-top: 2px;
}

.warning-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-message {
  margin: 0;
}

/* Slide extraction controls */
.slide-extraction-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0 0 8px 8px;
}

.slide-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* When gallery is part of the video content group, adjust the control styling */
.video-content .slide-gallery .slide-extraction-control {
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #dee2e6;
}

.extraction-main {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* Beautiful custom toggle switch */
.extraction-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-weight: 500;
  color: #333;
  user-select: none;
}

.extraction-toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.extraction-toggle input:checked + .toggle-slider {
  background-color: #007acc;
}

.extraction-toggle input:checked + .toggle-slider::before {
  transform: translateX(24px);
}

.extraction-toggle input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.extraction-toggle:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-text {
  font-size: 15px;
  font-weight: 600;
  user-select: none;
}

/* Slide counter */
.slide-counter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 6px;
  color: #1565c0;
  font-size: 14px;
  font-weight: 500;
}

.slide-counter svg {
  flex-shrink: 0;
  color: #1976d2;
}

.counter-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

.counter-status {
  color: #1565c0;
  font-weight: 400;
  opacity: 0.8;
}

/* Slide Gallery */
.slide-gallery {
  margin-top: 24px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

/* When gallery is part of the video content group */
.video-content .slide-gallery {
  margin-top: 0;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.gallery-header {
  margin-bottom: 16px;
}

.post-process-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.post-process-btn:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.post-process-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #6c757d;
  border-color: #6c757d;
}

.processing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
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

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.content {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.content:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.content:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .playback-page {
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .header {
    background-color: #2d2d2d;
    border: 1px solid #404040;
  }

  .header-main {
    background-color: #2d2d2d;
  }

  .back-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #b0b0b0;
  }

  .back-btn:hover {
    border-color: #4da6ff;
    color: #4da6ff;
  }

  .back-btn:disabled {
    background-color: #333;
    border-color: #555;
    color: #666;
  }

  .title-info h2 {
    color: #e0e0e0;
  }

  .title-info p {
    color: #b0b0b0;
  }

  .expand-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #b0b0b0;
  }

  .expand-btn:hover {
    border-color: #4da6ff;
    background-color: #333;
  }

  .course-details {
    background-color: #2d2d2d;
    border-top: 1px solid #404040;
  }

  .detail-label {
    color: #b0b0b0;
  }

  .detail-value {
    color: #e0e0e0;
  }

  .background-mode-indicator {
    background-color: #66cc66;
    color: #1a1a1a;
  }

  /* Slide extraction controls dark mode */
  .slide-extraction-control {
    background-color: #333;
    border-color: #555;
  }

  .extraction-toggle {
    color: #e0e0e0;
  }

  .toggle-slider {
    background-color: #555;
  }

  .extraction-toggle input:checked + .toggle-slider {
    background-color: #4da6ff;
  }

  .slide-counter {
    background-color: #1a2332;
    border-color: #2d4a66;
    color: #4da6ff;
  }

  .slide-counter svg {
    color: #66b3ff;
  }

  .counter-status {
    color: #4da6ff;
  }

  .slide-gallery {
    background-color: #333;
    border-color: #555;
  }

  .controls-row {
    background-color: #333;
    border-color: #555;
  }

  .video-container {
    border-color: #555;
  }

  .video-content .slide-gallery .slide-extraction-control {
    border-top-color: #666;
  }

  /* Scrollbar styles for dark mode */
  .content {
    scrollbar-color: transparent transparent;
  }

  .content:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .content:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }

  /* Picture in Picture Control Dark Mode */
  .pip-button {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .pip-button:hover:not(:disabled) {
    background-color: #333;
    border-color: #4da6ff;
  }

  .pip-button:disabled {
    background-color: #333;
    border-color: #555;
    color: #666;
  }

  .playback-rate-control label {
    color: #e0e0e0;
  }

  .playback-rate-control select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .playback-rate-control select:focus {
    border-color: #4da6ff;
  }

  .playback-rate-control select:disabled {
    background-color: #333;
    color: #666;
  }

  /* Stream selector dark mode */
  .stream-selector label {
    color: #e0e0e0;
  }

  .stream-selector select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .stream-selector select:focus {
    border-color: #4da6ff;
  }

  .stream-selector select:disabled {
    background-color: #333;
    border-color: #555;
    color: #666;
  }

  /* Loading and error states dark mode */
  .loading-state, .error-state, .no-streams {
    color: #b0b0b0;
  }

  .error-state svg {
    color: #ff6b6b;
  }

  .error-message {
    color: #e0e0e0;
  }

  .error-info {
    background-color: #333;
    border-left-color: #4da6ff;
  }

  .playback-position {
    color: #b0b0b0;
  }

  .error-suggestion {
    background-color: #3d3520;
    border-color: #665c2a;
  }

  .suggestion-text {
    color: #d4b942;
  }

  .retry-btn {
    background-color: #4da6ff;
    border-color: #4da6ff;
    color: #1a1a1a;
  }

  .retry-btn:hover {
    background-color: #3399ff;
    border-color: #3399ff;
  }

  /* Combined warning dark mode */
  .combined-warning {
    background-color: #3d3520;
    border-color: #665c2a;
    color: #d4b942;
  }

  .combined-warning svg {
    color: #f39c12;
  }

  /* Video container dark mode */
  .video-container.collapsed {
    background-color: #333;
    border-color: #555;
  }

  .video-container.collapsed::after {
    color: #b0b0b0;
  }

  /* Mute indicator dark mode */
  .mute-indicator {
    background-color: rgba(255, 107, 107, 0.9);
    color: #1a1a1a;
  }

  /* Retry indicator dark mode */
  .retry-indicator {
    background-color: rgba(45, 45, 45, 0.9);
    color: #e0e0e0;
  }

  /* Post-processing button dark mode */
  .post-process-btn {
    background-color: #4da6ff;
    border-color: #4da6ff;
    color: #1a1a1a;
  }

  .post-process-btn:hover:not(:disabled) {
    background-color: #3399ff;
    border-color: #3399ff;
  }

  .post-process-btn:disabled {
    background-color: #666;
    border-color: #666;
    color: #999;
  }

  .processing-spinner {
    border-color: rgba(26, 26, 26, 0.3);
    border-top-color: #1a1a1a;
  }

  /* Clear all button dark mode */
  .clear-all-btn {
    background-color: #ff6b6b;
    border-color: #ff6b6b;
  }

  .clear-all-btn:hover {
    background-color: #ff5252;
    border-color: #ff5252;
  }

  /* Slide gallery dark mode */
  .gallery-grid .slide-thumbnail {
    background-color: #2d2d2d;
    border-color: #555;
  }

  .gallery-grid .slide-thumbnail:hover {
    border-color: #4da6ff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .thumbnail-overlay {
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
  }

  .delete-btn {
    background-color: rgba(255, 107, 107, 0.8);
  }

  .delete-btn:hover {
    background-color: rgba(255, 107, 107, 1);
  }

  /* Slide modal dark mode */
  .slide-modal {
    background-color: rgba(0, 0, 0, 0.9);
  }

  .modal-content {
    background-color: #2d2d2d;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    background-color: #333;
    border-bottom-color: #555;
  }

  .modal-header h3 {
    color: #e0e0e0;
  }

  .modal-delete-btn {
    background-color: #ff6b6b;
    border-color: #ff6b6b;
  }

  .modal-delete-btn:hover {
    background-color: #ff5252;
    border-color: #ff5252;
  }

  .modal-close-btn {
    background-color: #666;
    border-color: #666;
  }

  .modal-close-btn:hover {
    background-color: #777;
    border-color: #777;
  }

  .modal-body {
    background-color: #2d2d2d;
  }

  .modal-image {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .slide-metadata {
    background-color: #333;
    border-color: #555;
  }

  .slide-metadata p {
    color: #b0b0b0;
  }

  .slide-metadata strong {
    color: #e0e0e0;
  }

  /* Spinner dark mode */
  .spinner {
    border-color: #555;
    border-top-color: #4da6ff;
  }

  .retry-spinner {
    border-color: rgba(224, 224, 224, 0.3);
    border-top-color: #e0e0e0;
  }
}
</style>