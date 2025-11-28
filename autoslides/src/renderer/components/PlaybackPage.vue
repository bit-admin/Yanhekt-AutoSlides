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
        <button @click="refreshPage" class="refresh-btn" :disabled="shouldDisableControls" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
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
        <div v-if="isTaskRunning || (props.mode === 'recorded' && showSpeedWarning) || aiFilteringError.type !== 'none'" class="combined-warning">
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
            <div v-if="aiFilteringError.type === '403'" class="warning-message ai-error">
              {{ $t('playback.aiError403') }}
              <button @click="dismissAIError" class="dismiss-btn" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === '413'" class="warning-message ai-error">
              {{ $t('playback.aiError413') }}
              <button @click="dismissAIError" class="dismiss-btn" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'http'" class="warning-message ai-error">
              {{ $t('playback.aiErrorHttp', { code: aiFilteringError.httpCode }) }}
              <button @click="dismissAIError" class="dismiss-btn" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'unknown'" class="warning-message ai-error">
              {{ $t('playback.aiErrorUnknown') }}
              <button @click="dismissAIError" class="dismiss-btn" :title="$t('playback.dismiss')">×</button>
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
                  @click="executePostProcessing()"
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

          <!-- Post-processing Status Bar (always visible when slides exist) -->
          <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0" class="post-process-status-bar">
            <div class="status-bar-content">
              <!-- Phase 1: Duplicate Removal -->
              <div class="phase-progress-item">
                <div class="phase-header">
                  <span class="phase-name">{{ $t('playback.postProcessStatus.phase1Name') }}</span>
                  <span v-if="postProcessStatus.phase1Skipped" class="phase-status skipped">
                    {{ $t('playback.postProcessStatus.disabled') }}
                  </span>
                  <span v-else-if="postProcessStatus.currentPhase === 'phase1'" class="phase-status active">
                    {{ postProcessStatus.currentIndex }}/{{ postProcessStatus.totalCount }}
                  </span>
                  <span v-else-if="postProcessStatus.duplicatesRemoved > 0" class="phase-status completed">
                    -{{ postProcessStatus.duplicatesRemoved }}
                  </span>
                </div>
                <div class="phase-progress-bar" :class="{ disabled: postProcessStatus.phase1Skipped }">
                  <div
                    class="phase-progress-fill"
                    :class="{
                      'active': postProcessStatus.currentPhase === 'phase1',
                      'completed': postProcessStatus.currentPhase !== 'idle' && postProcessStatus.currentPhase !== 'phase1' && !postProcessStatus.phase1Skipped
                    }"
                    :style="{
                      width: postProcessStatus.phase1Skipped ? '0%' :
                             postProcessStatus.currentPhase === 'phase1' ? `${(postProcessStatus.currentIndex / postProcessStatus.totalCount) * 100}%` :
                             (postProcessStatus.currentPhase === 'phase2' || postProcessStatus.currentPhase === 'phase3' || postProcessStatus.currentPhase === 'completed') ? '100%' : '0%'
                    }"
                  ></div>
                </div>
              </div>

              <!-- Phase 2: Exclusion List -->
              <div class="phase-progress-item">
                <div class="phase-header">
                  <span class="phase-name">{{ $t('playback.postProcessStatus.phase2Name') }}</span>
                  <span v-if="postProcessStatus.phase2Skipped" class="phase-status skipped">
                    {{ $t('playback.postProcessStatus.disabled') }}
                  </span>
                  <span v-else-if="postProcessStatus.currentPhase === 'phase2'" class="phase-status active">
                    {{ postProcessStatus.currentIndex }}/{{ postProcessStatus.totalCount }}
                  </span>
                  <span v-else-if="postProcessStatus.excludedRemoved > 0" class="phase-status completed">
                    -{{ postProcessStatus.excludedRemoved }}
                  </span>
                </div>
                <div class="phase-progress-bar" :class="{ disabled: postProcessStatus.phase2Skipped }">
                  <div
                    class="phase-progress-fill"
                    :class="{
                      'active': postProcessStatus.currentPhase === 'phase2',
                      'completed': (postProcessStatus.currentPhase === 'phase3' || postProcessStatus.currentPhase === 'completed') && !postProcessStatus.phase2Skipped
                    }"
                    :style="{
                      width: postProcessStatus.phase2Skipped ? '0%' :
                             postProcessStatus.currentPhase === 'phase2' ? `${(postProcessStatus.currentIndex / postProcessStatus.totalCount) * 100}%` :
                             (postProcessStatus.currentPhase === 'phase3' || postProcessStatus.currentPhase === 'completed') ? '100%' : '0%'
                    }"
                  ></div>
                </div>
              </div>

              <!-- Phase 3: AI Processing -->
              <div class="phase-progress-item">
                <div class="phase-header">
                  <span class="phase-name">{{ $t('playback.postProcessStatus.phase3Name') }}</span>
                  <span v-if="postProcessStatus.phase3Skipped" class="phase-status skipped">
                    {{ $t('playback.postProcessStatus.disabled') }}
                  </span>
                  <span v-else-if="postProcessStatus.currentPhase === 'phase3'" class="phase-status active">
                    {{ postProcessStatus.currentIndex }}/{{ postProcessStatus.totalCount }}
                  </span>
                  <span v-else-if="postProcessStatus.aiFiltered > 0" class="phase-status completed">
                    -{{ postProcessStatus.aiFiltered }}
                  </span>
                </div>
                <div class="phase-progress-bar" :class="{ disabled: postProcessStatus.phase3Skipped }">
                  <div
                    class="phase-progress-fill"
                    :class="{
                      'active': postProcessStatus.currentPhase === 'phase3',
                      'completed': postProcessStatus.currentPhase === 'completed' && !postProcessStatus.phase3Skipped
                    }"
                    :style="{
                      width: postProcessStatus.phase3Skipped ? '0%' :
                             postProcessStatus.currentPhase === 'phase3' ? `${(postProcessStatus.currentIndex / postProcessStatus.totalCount) * 100}%` :
                             postProcessStatus.currentPhase === 'completed' ? '100%' : '0%'
                    }"
                  ></div>
                </div>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRef } from 'vue'
import { useVideoPlayer } from '../composables/useVideoPlayer'
import { useSlideExtraction, type Course, type Session } from '../composables/useSlideExtraction'
import { usePostProcessing } from '../composables/usePostProcessing'
import { useTaskQueue } from '../composables/useTaskQueue'
import { usePerformanceOptimization } from '../composables/usePerformanceOptimization'
import { useSlideGallery } from '../composables/useSlideGallery'

// Props
const props = defineProps<{
  course: Course | null
  session?: Session | null
  mode: 'live' | 'recorded'
  streamId?: string
  sessionId?: string
  isVisible?: boolean
}>()

// Emits
const emit = defineEmits<{
  back: []
}>()

// Default isVisible to true for backward compatibility
const isVisible = computed(() => props.isVisible ?? true)

// Local UI state
const showDetails = ref(false)
const isPictureInPicture = ref(false)
const isVideoContainerCollapsed = ref(false)

// Convert props to refs for composables
const courseRef = toRef(props, 'course')
const sessionRef = computed(() => props.session ?? null)

// Initialize slide extraction composable first (needed by other composables)
const slideExtraction = useSlideExtraction({
  mode: props.mode,
  course: courseRef,
  session: sessionRef,
  currentPlaybackRate: ref(1) // Will be synced after videoPlayer init
})

// Initialize slide gallery composable
const slideGallery = useSlideGallery({
  extractedSlides: slideExtraction.extractedSlides,
  slideExtractorInstance: slideExtraction.slideExtractorInstance
})

// Initialize video player composable
const videoPlayerComposable = useVideoPlayer({
  mode: props.mode,
  streamId: props.streamId,
  sessionId: props.sessionId,
  course: courseRef,
  session: sessionRef,
  slideExtractorInstance: slideExtraction.slideExtractorInstance
})

// Expose videoPlayer ref for template binding
const videoPlayer = videoPlayerComposable.videoPlayer

// Initialize post-processing composable
const postProcessing = usePostProcessing({
  mode: props.mode,
  extractedSlides: slideExtraction.extractedSlides,
  slideExtractorInstance: slideExtraction.slideExtractorInstance,
  deleteSlide: slideGallery.deleteSlide
})

// Initialize task queue composable
const taskQueue = useTaskQueue({
  mode: props.mode,
  sessionId: props.sessionId,
  videoPlayer: videoPlayerComposable.videoPlayer,
  hls: videoPlayerComposable.hls,
  playbackData: videoPlayerComposable.playbackData,
  selectedStream: videoPlayerComposable.selectedStream,
  loading: videoPlayerComposable.loading,
  error: videoPlayerComposable.error,
  currentPlaybackRate: videoPlayerComposable.currentPlaybackRate,
  isSlideExtractionEnabled: slideExtraction.isSlideExtractionEnabled,
  slideExtractorInstance: slideExtraction.slideExtractorInstance,
  slideExtractionStatus: slideExtraction.slideExtractionStatus,
  extractedSlides: slideExtraction.extractedSlides,
  isRetrying: videoPlayerComposable.isRetrying,
  retryMessage: videoPlayerComposable.retryMessage,
  autoPostProcessing: postProcessing.autoPostProcessing,
  switchStream: videoPlayerComposable.switchStream,
  toggleSlideExtraction: slideExtraction.toggleSlideExtraction,
  executePostProcessing: postProcessing.executePostProcessing,
  resetErrorCounters: videoPlayerComposable.resetErrorCounters
})

// Initialize performance optimization composable
const performanceOptimization = usePerformanceOptimization({
  mode: props.mode,
  videoPlayer: videoPlayerComposable.videoPlayer,
  hls: videoPlayerComposable.hls,
  currentPlaybackRate: videoPlayerComposable.currentPlaybackRate,
  shouldVideoMute: videoPlayerComposable.shouldVideoMute
})

// Expose state from composables for template
const { loading, error, playbackData, selectedStream, isPlaying, currentPlaybackRate, muteMode, isRetrying, retryMessage, shouldVideoMute, isScreenRecordingSelected, currentStreamData, showSpeedWarning } = videoPlayerComposable
const { isSlideExtractionEnabled, extractedSlides } = slideExtraction
const { isPostProcessing, postProcessStatus, aiFilteringError } = postProcessing
const { isTaskRunning, shouldDisableControls } = taskQueue
const { selectedSlide } = slideGallery

// Methods exposed to template
const goBack = () => emit('back')
const toggleCourseDetails = () => { showDetails.value = !showDetails.value }
const refreshPage = () => {
  videoPlayerComposable.error.value = null
  videoPlayerComposable.resetErrorCounters()
  videoPlayerComposable.loadVideoStreams()
}

// Picture in Picture methods
const togglePictureInPicture = async () => {
  const video = videoPlayer.value
  if (!video) return

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await video.requestPictureInPicture()
    }
  } catch (error) {
    console.error('Error toggling Picture in Picture:', error)
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

// Delegate methods to composables
const { switchStream, changePlaybackRate, retryLoad, onLoadStart, onLoadedMetadata, onVideoError, onCanPlay, preventUnmute } = videoPlayerComposable
const { toggleSlideExtraction } = slideExtraction
const { executePostProcessing, dismissAIError } = postProcessing
const { openSlideModal, closeSlideModal, deleteSlide, clearAllSlides, formatSlideTime } = slideGallery

// Utility functions
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch {
    return dateString
  }
}

const formatDuration = (duration: string | number): string => {
  const seconds = typeof duration === 'string' ? parseInt(duration) : duration
  if (isNaN(seconds)) return duration.toString()
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  return `${minutes}m ${secs}s`
}

// Track last playback position for error display
const lastPlaybackPosition = computed(() => videoPlayerComposable.lastPlaybackPosition)

// Watch effects
let currentEventListeners: (() => void)[] = []

watch(() => videoPlayer.value, (newPlayer) => {
  // Clean up old listeners
  currentEventListeners.forEach(cleanup => cleanup())
  currentEventListeners = []

  if (newPlayer) {
    const updatePlayingState = () => {
      videoPlayerComposable.isPlaying.value = !newPlayer.paused
    }

    const onPlayStart = () => {
      updatePlayingState()
      performanceOptimization.startKeepAlive()
      performanceOptimization.requestWakeLock()
      performanceOptimization.requestPowerManagement()
      if (shouldVideoMute.value) {
        performanceOptimization.startSilentAudio()
      }
    }

    const onTimeUpdate = () => {
      taskQueue.updateTaskProgress()
      taskQueue.checkVideoCompletion()
    }

    const onWaiting = () => {
      if (slideExtraction.slideExtractorInstance.value && isSlideExtractionEnabled.value) {
        if (props.mode === 'recorded') {
          slideExtraction.slideExtractorInstance.value.pauseForBuffering()
        }
      }
    }

    const onCanPlayHandler = () => {
      if (slideExtraction.slideExtractorInstance.value && isSlideExtractionEnabled.value) {
        slideExtraction.slideExtractorInstance.value.resumeAfterBuffering()
      }
    }

    const onPauseOrEnd = () => {
      updatePlayingState()
      performanceOptimization.stopKeepAlive()
      performanceOptimization.releaseWakeLock()
      performanceOptimization.releasePowerManagement()
      performanceOptimization.stopSilentAudio()
    }

    newPlayer.addEventListener('play', onPlayStart)
    newPlayer.addEventListener('pause', onPauseOrEnd)
    newPlayer.addEventListener('ended', onPauseOrEnd)
    newPlayer.addEventListener('ended', taskQueue.onVideoEnded)
    newPlayer.addEventListener('timeupdate', onTimeUpdate)
    newPlayer.addEventListener('waiting', onWaiting)
    newPlayer.addEventListener('canplay', onCanPlayHandler)
    newPlayer.addEventListener('canplaythrough', onCanPlayHandler)

    currentEventListeners.push(() => {
      newPlayer.removeEventListener('play', onPlayStart)
      newPlayer.removeEventListener('pause', onPauseOrEnd)
      newPlayer.removeEventListener('ended', onPauseOrEnd)
      newPlayer.removeEventListener('ended', taskQueue.onVideoEnded)
      newPlayer.removeEventListener('timeupdate', onTimeUpdate)
      newPlayer.removeEventListener('waiting', onWaiting)
      newPlayer.removeEventListener('canplay', onCanPlayHandler)
      newPlayer.removeEventListener('canplaythrough', onCanPlayHandler)
    })

    // Apply mute settings immediately when video player is ready
    if (shouldVideoMute.value) {
      newPlayer.volume = 0
      newPlayer.setAttribute('data-muted-by-app', 'true')
    }

    // If we have stream data ready, load it now
    if (currentStreamData.value && playbackData.value) {
      nextTick(() => {
        videoPlayerComposable.loadVideoSource()
      })
    }
  }
})

// Watch for stream data changes
watch(() => currentStreamData.value, (newStreamData) => {
  if (newStreamData && videoPlayer.value && playbackData.value) {
    nextTick(() => {
      videoPlayerComposable.loadVideoSource()
    })
  }
})

// Watch for mute mode changes
watch(shouldVideoMute, (shouldMute) => {
  if (videoPlayer.value) {
    videoPlayer.value.volume = shouldMute ? 0 : 1
    if (shouldMute) {
      videoPlayer.value.setAttribute('data-muted-by-app', 'true')
      performanceOptimization.startSilentAudio()
    } else {
      videoPlayer.value.removeAttribute('data-muted-by-app')
      performanceOptimization.stopSilentAudio()
    }
  }
}, { immediate: true })

// Watch for stream changes to disable slide extraction if not screen recording
watch(isScreenRecordingSelected, (isScreenRecording) => {
  if (!isScreenRecording && isSlideExtractionEnabled.value) {
    slideExtraction.isSlideExtractionEnabled.value = false
    if (slideExtraction.slideExtractorInstance.value) {
      slideExtraction.slideExtractorInstance.value.stopExtraction()
    }
    slideExtraction.slideExtractionStatus.value.isRunning = false
  }
})

// Watch for slide extraction toggle
watch(isSlideExtractionEnabled, (enabled) => {
  if (enabled && videoPlayer.value && slideExtraction.slideExtractorInstance.value) {
    slideExtraction.slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))
  }
})

// Watch for course changes to update SSIM threshold
watch(() => props.course, () => {
  slideExtraction.updateSSIMThresholdForClassrooms()
}, { immediate: true })

// Handle slide extracted event for post-processing
const onSlideExtracted = async (event: CustomEvent) => {
  const { slide, instanceId, mode } = event.detail
  if (instanceId === slideExtraction.extractorInstanceId.value && mode === props.mode) {
    slideExtraction.extractedSlides.value.push(slide)
    slideExtraction.updateSlideExtractionStatus()
    
    // Live mode auto post-processing
    if (props.mode === 'live' && postProcessing.autoPostProcessingLive.value && !postProcessing.isPostProcessing.value) {
      await postProcessing.executePostProcessing(false)
    }
    
    // Recorded mode batch post-processing
    if (props.mode === 'recorded' && taskQueue.isTaskMode.value && postProcessing.autoPostProcessing.value && !postProcessing.isPostProcessing.value) {
      const unprocessedSlides = slideExtraction.extractedSlides.value.filter(s => s.aiDecision === null || s.aiDecision === undefined)
      if (unprocessedSlides.length >= postProcessing.aiBatchSize.value) {
        await postProcessing.executePostProcessing(false)
      }
    }
  }
}

const onSlidesCleared = (event: CustomEvent) => {
  const { instanceId, mode } = event.detail
  if (instanceId === slideExtraction.extractorInstanceId.value && mode === props.mode) {
    slideExtraction.extractedSlides.value = []
    slideGallery.selectedSlide.value = null
    slideExtraction.updateSlideExtractionStatus()
  }
}

// Lifecycle
onMounted(async () => {
  // Register video proxy client
  await videoPlayerComposable.registerClient()

  // Load config
  await videoPlayerComposable.initConfig()
  await taskQueue.initConfig()
  await postProcessing.initConfig()
  await performanceOptimization.initConfig()

  // Update SSIM threshold based on classroom information
  slideExtraction.updateSSIMThresholdForClassrooms()

  // Add event listeners
  window.addEventListener('slideExtracted', onSlideExtracted as unknown as EventListener)
  window.addEventListener('slidesCleared', onSlidesCleared as EventListener)
  taskQueue.setupEventListeners()
  performanceOptimization.setupEventListeners()

  // Wait for next tick to ensure video element is in DOM
  await nextTick()
  videoPlayerComposable.loadVideoStreams()
})

onUnmounted(async () => {
  // Stop slide extraction if running
  if (isSlideExtractionEnabled.value && slideExtraction.slideExtractorInstance.value) {
    slideExtraction.slideExtractorInstance.value.stopExtraction()
  }

  // Cleanup slide extraction
  slideExtraction.cleanupSlideExtraction()

  // Remove event listeners
  window.removeEventListener('slideExtracted', onSlideExtracted as unknown as EventListener)
  window.removeEventListener('slidesCleared', onSlidesCleared as EventListener)
  taskQueue.removeEventListeners()

  // Clean up performance optimization
  await performanceOptimization.cleanupAll()

  // Clean up Picture in Picture if active
  if (isPictureInPicture.value && document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture()
    } catch (error) {
      console.error('Error exiting Picture in Picture on unmount:', error)
    }
  }

  // Clean up HLS
  videoPlayerComposable.cleanup()

  // Clean up event listeners
  currentEventListeners.forEach(cleanupFn => cleanupFn())
  currentEventListeners = []

  // Unregister video proxy client
  await videoPlayerComposable.unregisterClient()
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

.refresh-btn {
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

.refresh-btn:hover:not(:disabled) {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
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
  margin-bottom: 8px;
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

.warning-message.ai-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #c0392b;
}

[data-theme="dark"] .warning-message.ai-error {
  color: #e74c3c;
}

.warning-message .dismiss-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.warning-message .dismiss-btn:hover {
  opacity: 1;
  color: #333;
}

[data-theme="dark"] .warning-message .dismiss-btn {
  color: #aaa;
}

[data-theme="dark"] .warning-message .dismiss-btn:hover {
  color: #fff;
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
  margin-bottom: 8px;
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

/* Post-processing status bar styles */
.post-process-status-bar {
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.status-bar-content {
  display: flex;
  align-items: stretch;
  gap: 12px;
  font-size: 11px;
}

.phase-progress-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.phase-name {
  font-weight: 500;
  color: #333;
  font-size: 10px;
}

.phase-status {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
}

.phase-status.active {
  background-color: #007acc;
  color: white;
}

.phase-status.completed {
  background-color: #28a745;
  color: white;
}

.phase-status.skipped {
  background-color: #e2e3e5;
  color: #6c757d;
  font-style: italic;
}

.phase-status.placeholder {
  background-color: #e2e3e5;
  color: #999;
  font-style: italic;
}

.phase-progress-bar {
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.phase-progress-bar.disabled {
  background-color: #f0f0f0;
}

.phase-progress-bar.placeholder {
  background: repeating-linear-gradient(
    45deg,
    #f0f0f0,
    #f0f0f0 4px,
    #e8e8e8 4px,
    #e8e8e8 8px
  );
}

.phase-progress-fill {
  height: 100%;
  background-color: #e0e0e0;
  transition: width 0.3s ease;
}

.phase-progress-fill.active {
  background-color: #007acc;
  animation: progressPulse 1.5s infinite;
}

.phase-progress-fill.completed {
  background-color: #28a745;
}

@keyframes progressPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
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

  .refresh-btn {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #b0b0b0;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: #4da6ff;
    background-color: #333;
  }

  .refresh-btn:disabled {
    background-color: #333;
    border-color: #555;
    color: #666;
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

  /* Post-processing status bar dark mode */
  .post-process-status-bar {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .phase-name {
    color: #e0e0e0;
  }

  .phase-status.active {
    background-color: #4da6ff;
    color: #1a1a1a;
  }

  .phase-status.completed {
    background-color: #28a745;
    color: white;
  }

  .phase-status.skipped {
    background-color: #3d3d3d;
    color: #888;
  }

  .phase-status.placeholder {
    background-color: #3d3d3d;
    color: #666;
  }

  .phase-progress-bar {
    background-color: #404040;
  }

  .phase-progress-bar.disabled {
    background-color: #363636;
  }

  .phase-progress-bar.placeholder {
    background: repeating-linear-gradient(
      45deg,
      #363636,
      #363636 4px,
      #404040 4px,
      #404040 8px
    );
  }

  .phase-progress-fill {
    background-color: #404040;
  }

  .phase-progress-fill.active {
    background-color: #4da6ff;
  }

  .phase-progress-fill.completed {
    background-color: #28a745;
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