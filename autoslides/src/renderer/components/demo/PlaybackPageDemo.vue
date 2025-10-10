<template>
  <div class="playback-page">
    <div class="header">
      <div class="header-main">
        <button class="back-btn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="title-info">
          <h2>{{ $t('demo.course.title') }}</h2>
          <p>{{ $t('demo.session.title') }}</p>
        </div>
        <button class="expand-btn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="course-details">
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ $t('demo.course.instructor') }}</span>
        </div>
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.academicTerm') }}</span>
          <span class="detail-value">{{ $t('demo.course.term') }}</span>
        </div>
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ $t('demo.course.classroom') }}</span>
        </div>
        <div class="course-detail-item">
          <span class="detail-label">{{ $t('playback.duration') }}</span>
          <span class="detail-value">{{ formatDuration(totalTime) }}</span>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="video-content">
        <!-- Controls Row -->
        <div class="controls-row">
          <div class="stream-selector">
            <label>{{ $t('playback.selectStream') }}</label>
            <select v-model="selectedStream" class="demo-disabled">
              <option value="camera">{{ $t('demo.stream.camera') }}</option>
              <option value="screen">{{ $t('demo.stream.screen') }}</option>
            </select>
          </div>

          <div class="playback-rate-control">
            <label>{{ $t('playback.playbackSpeed') }}</label>
            <select v-model="currentPlaybackRate" class="demo-disabled">
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
              <option value="4">4x</option>
            </select>
          </div>

          <div class="pip-control">
            <button class="pip-button demo-disabled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <rect x="14" y="12" width="6" height="4" rx="1" fill="currentColor"/>
              </svg>
              <span>{{ $t('playback.picInPic') }}</span>
            </button>
          </div>
        </div>

        <!-- Mock Video Player -->
        <div class="video-container">
          <div class="mock-video-player">
            <div class="video-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              <p>{{ $t('demo.video.playing') }}</p>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progress + '%' }"></div>
              </div>
              <p class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(totalTime) }}</p>
            </div>
          </div>
        </div>

        <!-- Slide Gallery -->
        <div v-if="selectedStream === 'screen'" class="slide-gallery">
          <div class="gallery-header">
            <div class="slide-extraction-control">
              <div class="extraction-main">
                <label class="extraction-toggle demo-disabled">
                  <input
                    type="checkbox"
                    v-model="isSlideExtractionEnabled"
                    disabled
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
                    {{ isSlideExtractionEnabled ? mockSlides.length : 0 }} {{ $t('playback.slides') }}
                    <span v-if="isSlideExtractionEnabled" class="counter-status">{{ $t('playback.extracted') }}</span>
                  </span>
                </div>
              </div>

              <button
                v-if="isSlideExtractionEnabled && mockSlides.length > 0"
                class="clear-all-btn demo-disabled"
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

          <!-- Gallery Grid -->
          <div v-if="isSlideExtractionEnabled && mockSlides.length > 0" class="gallery-grid">
            <div
              v-for="slide in mockSlides"
              :key="slide.id"
              class="slide-thumbnail demo-disabled"
            >
              <div class="mock-slide-image">
                <div class="slide-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span>{{ $t('demo.slide.preview') }}</span>
                </div>
              </div>
              <div class="thumbnail-overlay">
                <div class="slide-info">
                  <span class="slide-title">{{ slide.title }}</span>
                  <span class="slide-time">{{ slide.time }}</span>
                </div>
                <button class="delete-btn demo-disabled">
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
    </div>

    <!-- Slide Preview Modal -->
    <div v-if="selectedSlide" class="slide-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ selectedSlide.title }}</h3>
          <div class="modal-actions">
            <button class="modal-delete-btn demo-disabled" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              {{ $t('playback.moveToTrash') }}
            </button>
            <button class="modal-close-btn" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {{ $t('playback.close') }}
            </button>
          </div>
        </div>
        <div class="modal-body">
          <div class="mock-slide-image-large">
            <div class="slide-placeholder-large">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>{{ $t('demo.slide.fullPreview') }}</span>
            </div>
          </div>
          <div class="slide-metadata">
            <p><strong>{{ $t('playback.extractedAt') }}</strong> {{ selectedSlide.time }}</p>
            <p><strong>{{ $t('playback.fileName') }}</strong> {{ selectedSlide.title }}.png</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  back: []
}>()

// Reactive state
const showDetails = ref(false)
const selectedStream = ref('screen')
const currentPlaybackRate = ref(2)
const isSlideExtractionEnabled = ref(true)
const selectedSlide = ref<any>(null)

// Mock video progress
const progress = ref(35)
const currentTime = ref(2130) // 35:30
const totalTime = ref(6330) // 1:45:30

// Mock slides data
const mockSlides = ref([
  {
    id: 1,
    title: 'slide_001',
    time: '10:23'
  }
])

// Methods
const goBack = () => {
  emit('back')
}

const toggleCourseDetails = () => {
  showDetails.value = !showDetails.value
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Demo mode - modal functionality disabled
const openSlideModal = (slide: any) => {
  // Disabled in demo mode
}

const closeSlideModal = () => {
  selectedSlide.value = null
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Simulate video progress
let progressInterval: NodeJS.Timeout | null = null

onMounted(() => {
  // Simulate video playback progress
  progressInterval = setInterval(() => {
    if (progress.value < 100) {
      progress.value += 0.5
      currentTime.value += 30 // 30 seconds per update
    }
  }, 1000)
})

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval)
  }
})
</script>

<style scoped>
/* Import all styles from the original PlaybackPage.vue */
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

.back-btn:hover {
  border-color: #007acc;
  color: #007acc;
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

.video-content {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.pip-button:hover {
  background-color: #f8f9fa;
  border-color: #007acc;
}

.video-container {
  position: relative;
  width: 100%;
  background-color: #000;
  border: 1px solid #e9ecef;
  border-top: none;
  border-radius: 0;
  overflow: hidden;
}

.mock-video-player {
  width: 100%;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #ffffff;
  text-align: center;
}

.video-placeholder svg {
  opacity: 0.7;
}

.video-placeholder p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.progress-bar {
  width: 300px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007acc;
  transition: width 0.3s ease;
}

.time-display {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-family: monospace;
}

/* Slide Gallery */
.slide-gallery {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.gallery-header {
  margin-bottom: 16px;
}

.slide-extraction-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.extraction-main {
  display: flex;
  align-items: center;
  gap: 20px;
}

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

.toggle-text {
  font-size: 15px;
  font-weight: 600;
  user-select: none;
}

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
  padding: 0 16px 16px 16px;
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

.mock-slide-image {
  width: 100%;
  height: 120px;
  background-color: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  text-align: center;
}

.slide-placeholder svg {
  opacity: 0.7;
}

.slide-placeholder span {
  font-size: 12px;
  opacity: 0.8;
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

.mock-slide-image-large {
  width: 100%;
  height: 400px;
  background-color: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.slide-placeholder-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #ffffff;
  text-align: center;
}

.slide-placeholder-large svg {
  opacity: 0.7;
}

.slide-placeholder-large span {
  font-size: 16px;
  opacity: 0.8;
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

/* Demo mode disabled styles */
.demo-disabled {
  pointer-events: none !important;
  cursor: default !important;
  opacity: 0.8 !important;
}

.demo-disabled:hover {
  background-color: inherit !important;
  border-color: inherit !important;
  transform: none !important;
  box-shadow: none !important;
}

.slide-thumbnail.demo-disabled:hover {
  border-color: #e9ecef !important;
  transform: none !important;
  box-shadow: none !important;
}

.extraction-toggle.demo-disabled {
  cursor: default !important;
  opacity: 0.8 !important;
}

.extraction-toggle.demo-disabled .toggle-slider {
  cursor: default !important;
}
</style>