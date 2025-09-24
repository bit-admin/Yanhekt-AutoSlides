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

          <div class="playback-controls">
            <button @click="togglePlayPause" class="control-btn">
              <svg v-if="isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              {{ isPlaying ? 'Pause' : 'Play' }}
            </button>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { DataStore } from '../services/dataStore'

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
}>()

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

// Computed properties
const currentStreamData = computed(() => {
  if (!playbackData.value || !selectedStream.value) return null
  return playbackData.value.streams[selectedStream.value]
})

// Methods
const goBack = () => {
  emit('back')
}

const loadVideoStreams = async () => {
  try {
    loading.value = true
    error.value = null

    const token = localStorage.getItem('authToken')
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

      result = await window.electronAPI.video.getLiveStreamUrls(streamData, token)
    } else if (props.mode === 'recorded' && props.session) {
      // Load recorded video data
      result = await window.electronAPI.video.getVideoPlaybackUrls(props.session, token)
    } else {
      throw new Error('Invalid playback parameters')
    }

    playbackData.value = result

    // Select first available stream
    const streamKeys = Object.keys(result.streams)
    if (streamKeys.length > 0) {
      selectedStream.value = streamKeys[0]
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
  if (!videoPlayer.value || !currentStreamData.value) return

  try {
    videoPlayer.value.src = currentStreamData.value.url
    await videoPlayer.value.load()
  } catch (err: any) {
    console.error('Failed to load video source:', err)
    error.value = 'Failed to load video source'
  }
}

const switchStream = async () => {
  if (videoPlayer.value) {
    const wasPlaying = !videoPlayer.value.paused
    const currentTime = videoPlayer.value.currentTime

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

const togglePlayPause = async () => {
  if (!videoPlayer.value) return

  try {
    if (videoPlayer.value.paused) {
      await videoPlayer.value.play()
    } else {
      videoPlayer.value.pause()
    }
  } catch (err) {
    console.error('Failed to toggle playback:', err)
  }
}

const retryLoad = () => {
  loadVideoStreams()
}

// Video event handlers
const onLoadStart = () => {
  console.log('Video load started')
}

const onLoadedMetadata = () => {
  console.log('Video metadata loaded')
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
  console.log('Video can start playing')
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
watch(() => videoPlayer.value, (newPlayer) => {
  if (newPlayer) {
    const updatePlayingState = () => {
      isPlaying.value = !newPlayer.paused
    }

    newPlayer.addEventListener('play', updatePlayingState)
    newPlayer.addEventListener('pause', updatePlayingState)
    newPlayer.addEventListener('ended', updatePlayingState)

    // Cleanup on component unmount
    onUnmounted(() => {
      newPlayer.removeEventListener('play', updatePlayingState)
      newPlayer.removeEventListener('pause', updatePlayingState)
      newPlayer.removeEventListener('ended', updatePlayingState)
    })
  }
})

// Lifecycle
onMounted(() => {
  loadVideoStreams()
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

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

.control-btn:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
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