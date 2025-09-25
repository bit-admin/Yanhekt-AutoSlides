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
        <h2>{{ playbackData?.title || course?.title }}</h2>
        <p v-if="session">{{ session.title }}</p>
        <div v-if="!isVisible && isPlaying" class="background-mode-indicator">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          Playing in background
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
        <!-- Stream Selection -->
        <div v-if="Object.keys(playbackData.streams).length > 1" class="stream-selector">
          <label>Select Stream:</label>
          <select v-model="selectedStream" @change="switchStream">
            <option v-for="(stream, key) in playbackData.streams" :key="key" :value="key">
              {{ stream.name }}
            </option>
          </select>
        </div>

        <!-- Video Player -->
        <div class="video-container">
          <video
            ref="videoPlayer"
            class="video-player"
            controls
            preload="metadata"
            @loadstart="onLoadStart"
            @loadedmetadata="onLoadedMetadata"
            @error="onVideoError"
            @canplay="onCanPlay"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <!-- Stream Info -->
        <div class="stream-info">
          <div class="current-stream">
            <h4>{{ currentStreamData?.name }}</h4>
            <p class="stream-type">{{ currentStreamData?.type === 'camera' ? 'Camera View' : 'Screen Recording' }}</p>
          </div>

        </div>

        <!-- Course Information -->
        <div class="info-section">
          <h3>Course Information</h3>
          <p><strong>Course:</strong> {{ playbackData.title }}</p>
          <p v-if="course?.instructor"><strong>Instructor:</strong> {{ course.instructor }}</p>
          <p v-if="session"><strong>Session:</strong> {{ session.title }}</p>
          <p v-if="session"><strong>Date:</strong> {{ formatDate(session.started_at) }}</p>
          <p v-if="playbackData.duration"><strong>Duration:</strong> {{ formatDuration(playbackData.duration) }}</p>
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
        debug: false
      })

      hls.value.loadSource(videoUrl)
      hls.value.attachMedia(videoPlayer.value)

      hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully')
      })

      hls.value.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS media attached')
      })

      hls.value.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', event, data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to restart load')
              hls.value?.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover')
              hls.value?.recoverMediaError()
              break
            default:
              error.value = 'Video playback error: ' + data.details
              break
          }
        }
      })
    } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      console.log('Using native HLS support')
      videoPlayer.value.src = videoUrl
      await videoPlayer.value.load()
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
      if (wasPlaying) {
        try {
          await videoPlayer.value.play()
        } catch (err) {
          console.warn('Could not resume playback:', err)
        }
      }
    }
  }
}


const retryLoad = () => {
  loadVideoStreams()
}

// Video event handlers
const onLoadStart = () => {
  // Video load started
}

const onLoadedMetadata = () => {
  // Video metadata loaded
}

const onVideoError = (event: Event) => {
  const target = event.target as HTMLVideoElement
  const errorCode = target.error?.code
  const errorMessage = target.error?.message

  console.error('Video error:', { errorCode, errorMessage })

  let userMessage = 'Video playback error'
  switch (errorCode) {
    case 1: // MEDIA_ERR_ABORTED
      userMessage = 'Video playback was aborted'
      break
    case 2: // MEDIA_ERR_NETWORK
      userMessage = 'Network error occurred while loading video'
      break
    case 3: // MEDIA_ERR_DECODE
      userMessage = 'Video decoding error'
      break
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      userMessage = 'Video format not supported'
      break
  }

  error.value = userMessage
}

const onCanPlay = () => {
  // Video can start playing
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

watch(() => videoPlayer.value, (newPlayer, oldPlayer) => {
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

// Cleanup function
const cleanup = () => {
  if (hls.value) {
    hls.value.destroy()
    hls.value = null
  }
}

// Lifecycle
onMounted(async () => {
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

.stream-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
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

.video-player {
  width: 100%;
  height: auto;
  min-height: 400px;
  display: block;
}

.stream-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.current-stream h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.stream-type {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.playback-controls {
  display: flex;
  gap: 8px;
}


.info-section {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
}

.info-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.info-section p {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.info-section strong {
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
}
</style>