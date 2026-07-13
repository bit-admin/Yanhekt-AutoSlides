<template>
  <div class="playback-page" :class="{ 'cinema-mode': isCinemaMode }">
    <div class="playback-content-wrapper">
      <!-- Back Button header -->
      <div class="playback-header" v-if="!isCinemaMode">
        <button @click="goBack" class="btn btn--ghost back-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          <span>{{ $t('playback.back') }}</span>
        </button>
      </div>

      <!-- Left Column: Video + Meta Details -->
      <div class="main-video-section">
        <!-- Video Player Panel -->
        <div class="player-panel-container">
          <div v-if="loading" class="player-loading-state">
            <div class="spinner spinner--lg"></div>
            <p>{{ $t('playback.loadingVideoStreams') }}</p>
          </div>

          <div v-else-if="error" class="player-loading-state error-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div class="error-details">
              <p class="error-message">{{ error }}</p>
              <div v-if="lastPlaybackPosition > 0" class="error-info">
                <p class="playback-position">
                  <strong>{{ $t('playback.lastPlayedPosition') }}</strong> {{ formatPlaybackTime(Math.floor(lastPlaybackPosition)) }}
                </p>
              </div>
            </div>
            <button @click="retryLoad" class="btn btn--primary">{{ $t('playback.retry') }}</button>
          </div>

          <div v-else-if="playbackData" class="video-content">
            <div class="player-panel">
              <!-- Single-stream player -->
              <div
                v-if="!isDualStreamSelected"
                ref="singleVideoContainer"
                class="video-container"
                :class="{ 'is-fullscreen': isSingleFullscreen, 'controls-hidden': !controlsVisible }"
                @mousemove="showControls"
                @mouseleave="onPlayerPointerLeave"
              >
                <video
                  ref="videoPlayer"
                  class="video-player"
                  preload="metadata"
                  playsinline
                  crossorigin="anonymous"
                  @error="onVideoError"
                  @canplay="onCanPlay"
                  @ended="onEnded"
                  @volumechange="preventUnmute"
                  @enterpictureinpicture="onEnterPictureInPicture"
                  @leavepictureinpicture="onLeavePictureInPicture"
                >
                  {{ $t('playback.browserNotSupported') }}
                </video>

                <div v-if="isRetrying" class="retry-indicator">
                  <div class="retry-spinner"></div>
                  <span>{{ retryMessage }}</span>
                </div>

                <div v-else-if="isVideoLoading" class="warming-overlay">
                  <div class="warming-spinner"></div>
                  <p class="warming-title">{{ $t('playback.warming.title') }}</p>
                  <p v-if="props.mode === 'recorded'" class="warming-hint">{{ $t('playback.warming.hint') }}</p>
                </div>

                <SingleStreamControls
                  :mode="props.mode"
                  :is-playing="isPlaying"
                  :controls-visible="controlsVisible"
                  :should-disable-controls="false"
                  :should-video-mute="shouldVideoMute"
                  :current-time="singleCurrentTime"
                  :duration="singleDuration"
                  :can-seek="singleCanSeek"
                  :seek-progress="singleSeekProgress"
                  :effective-volume="singleEffectiveVolume"
                  :volume-progress="singleVolumeProgress"
                  :is-muted="singleIsMuted"
                  :current-playback-rate="currentPlaybackRate"
                  :playback-rate-options="playbackRateOptions"
                  :show-speed-panel="showSpeedPanel"
                  :show-more-panel="showDualMorePanel"
                  :is-fullscreen="isSingleFullscreen"
                  :is-cinema-mode="isCinemaMode"
                  :is-picture-in-picture="isPictureInPicture"
                  :video-player-ready="!!videoPlayer"
                  :format-time="formatPlaybackTime"
                  @toggle-playback="toggleSinglePlayback"
                  @seek-input="onSingleSeekInput"
                  @volume-input="applySingleVolume"
                  @toggle-mute="toggleSingleMute"
                  @toggle-speed-panel="toggleSpeedPanel"
                  @set-playback-rate="setPlaybackRateFromPanel"
                  @toggle-fullscreen="toggleSingleFullscreen"
                  @toggle-more-panel="toggleDualMorePanel"
                  @toggle-cinema="toggleCinemaFromMenu"
                  @toggle-pip="togglePipFromMenu"
                  @pointer-over-controls="pointerOverControls = $event"
                />
              </div>

              <!-- Dual-stream player -->
              <div
                v-else
                ref="dualVideoContainer"
                class="dual-playback-shell"
                :class="{ 'is-fullscreen': isDualFullscreen, 'controls-hidden': !controlsVisible }"
                @mousemove="showControls"
                @mouseleave="onPlayerPointerLeave"
              >
                <div class="video-container dual-video-container">
                  <div class="dual-video-grid">
                    <div class="dual-video-panel" :style="{ order: cameraPanelOrder }">
                      <div class="dual-video-label">{{ $t('playback.streamCamera') }}</div>
                      <video
                        ref="cameraVideoPlayer"
                        class="dual-video-player"
                        preload="metadata"
                        playsinline
                        crossorigin="anonymous"
                        @timeupdate="onDualTimeUpdate"
                        @play="onDualPlayStateChanged"
                        @pause="onDualPlayStateChanged"
                        @ended="onDualEnded"
                        @volumechange="preventDualUnmute"
                      >
                        {{ $t('playback.browserNotSupported') }}
                      </video>
                    </div>
                    <div class="dual-video-panel" :style="{ order: screenPanelOrder }">
                      <div class="dual-video-label">{{ $t('playback.streamScreen') }}</div>
                      <video
                        ref="screenVideoPlayer"
                        class="dual-video-player"
                        preload="metadata"
                        playsinline
                        crossorigin="anonymous"
                        @timeupdate="onDualTimeUpdate"
                        @play="onDualPlayStateChanged"
                        @pause="onDualPlayStateChanged"
                        @ended="onDualEnded"
                        @volumechange="preventDualUnmute"
                      >
                        {{ $t('playback.browserNotSupported') }}
                      </video>
                    </div>
                  </div>

                  <div v-if="isRetrying" class="retry-indicator">
                    <div class="retry-spinner"></div>
                    <span>{{ retryMessage }}</span>
                  </div>

                  <div v-else-if="isVideoLoading" class="warming-overlay">
                    <div class="warming-spinner"></div>
                    <p class="warming-title">{{ $t('playback.warming.title') }}</p>
                    <p v-if="props.mode === 'recorded'" class="warming-hint">{{ $t('playback.warming.hint') }}</p>
                  </div>
                </div>

                <div
                  class="dual-controls-section"
                  :class="{ 'controls-hidden': !controlsVisible }"
                  @mouseenter="pointerOverControls = true"
                  @mouseleave="pointerOverControls = false"
                >
                  <div class="dual-controls-main-row">
                    <div class="dual-controls-left">
                      <button
                        class="dual-icon-button"
                        @click="toggleDualPlayback"
                        :title="isPlaying ? $t('playback.dual.pause') : $t('playback.dual.play')"
                      >
                        <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="8,5 19,12 8,19"/>
                        </svg>
                        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="5" width="4" height="14"/>
                          <rect x="14" y="5" width="4" height="14"/>
                        </svg>
                      </button>

                      <span class="dual-time">{{ formatPlaybackTime(dualCurrentTime) }} / {{ dualCanSeek ? formatPlaybackTime(dualDuration) : $t('playback.dual.live') }}</span>
                    </div>

                    <div class="dual-controls-right">
                      <div class="single-volume">
                        <button
                          class="dual-icon-button"
                          @click="toggleDualMute"
                          :title="dualIsMuted ? $t('playback.unmute') : $t('playback.mute')"
                        >
                          <svg v-if="!dualIsMuted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                          </svg>
                          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                            <line x1="23" y1="9" x2="17" y2="15"/>
                            <line x1="17" y1="9" x2="23" y2="15"/>
                          </svg>
                        </button>
                        <input
                          class="dual-seek single-volume-slider"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          :value="dualEffectiveVolume"
                          :style="{ '--dual-progress': dualVolumeProgress }"
                          :aria-label="$t('playback.volume')"
                          @input="onDualVolumeInput"
                        />
                      </div>

                      <div class="dual-popover-anchor">
                        <button
                          class="dual-icon-button"
                          @click="toggleDualAudioPanel"
                          :title="$t('playback.dual.audioSource')"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M4 14v-2a8 8 0 0 1 16 0v2"/>
                            <rect x="3" y="14" width="4" height="6" rx="1.5"/>
                            <rect x="17" y="14" width="4" height="6" rx="1.5"/>
                          </svg>
                        </button>
                        <div v-if="showDualAudioPanel" class="dual-popover dual-audio-popover">
                          <button
                            class="dual-popover-option"
                            :class="{ active: dualAudioSource === 'screen' }"
                            @click="setDualAudio('screen')"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <polyline v-if="dualAudioSource === 'screen'" points="20,6 9,17 4,12"/>
                              <rect v-else x="4" y="5" width="16" height="10" rx="2"/>
                            </svg>
                            <span>{{ $t('playback.dual.screenAudio') }}</span>
                          </button>
                          <button
                            class="dual-popover-option"
                            :class="{ active: dualAudioSource === 'camera' }"
                            @click="setDualAudio('camera')"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <polyline v-if="dualAudioSource === 'camera'" points="20,6 9,17 4,12"/>
                              <path v-else d="M23 7l-7 5 7 5V7z"/>
                            </svg>
                            <span>{{ $t('playback.dual.cameraAudio') }}</span>
                          </button>
                        </div>
                      </div>

                      <div v-if="props.mode === 'recorded'" class="dual-popover-anchor">
                        <button
                          class="dual-speed-button"
                          @click="toggleSpeedPanel"
                          :title="$t('playback.playbackSpeed')"
                        >
                          {{ currentPlaybackRate }}x
                        </button>
                        <div v-if="showSpeedPanel" class="dual-popover dual-speed-popover custom-scrollbar">
                          <button
                            v-for="rate in playbackRateOptions"
                            :key="rate"
                            class="dual-popover-option"
                            :class="{ active: Number(currentPlaybackRate) === rate }"
                            @click="setPlaybackRateFromPanel(rate)"
                          >
                            <span>{{ rate }}x</span>
                          </button>
                        </div>
                      </div>

                      <button
                        class="dual-icon-button"
                        @click="toggleDualFullscreen"
                        :title="isDualFullscreen ? $t('playback.dual.exitFullscreen') : $t('playback.dual.fullscreen')"
                      >
                        <svg v-if="!isDualFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                          <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
                          <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
                          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                        </svg>
                        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                          <path d="M16 3v3a2 2 0 0 0 2 2h3"/>
                          <path d="M8 21v-3a2 2 0 0 0-2-2H3"/>
                          <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                        </svg>
                      </button>

                      <div class="dual-popover-anchor">
                        <button
                          class="dual-icon-button"
                          @click="toggleDualMorePanel"
                          :title="$t('playback.dual.moreOptions')"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                          </svg>
                        </button>
                        <div v-if="showDualMorePanel" class="dual-popover dual-more-popover">
                          <button class="dual-popover-option" @click="toggleDualStreamOrder">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <path d="M7 7h11l-4-4"/>
                              <path d="M17 17H6l4 4"/>
                            </svg>
                            <span>{{ $t('playback.dual.swapOrder') }}</span>
                          </button>
                          <button
                            class="dual-popover-option"
                            :class="{ active: isCinemaMode }"
                            @click="toggleCinemaFromMenu"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <rect x="2" y="5" width="20" height="14" rx="2"/>
                              <path d="M2 9h20"/>
                              <path d="M2 15h20"/>
                            </svg>
                            <span>{{ isCinemaMode ? $t('playback.exitCinemaMode') : $t('playback.cinemaMode') }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <input
                    class="dual-seek"
                    type="range"
                    min="0"
                    :max="dualDuration || 0"
                    step="0.1"
                    :value="dualCurrentTime"
                    :style="{ '--dual-progress': dualSeekProgress }"
                    :disabled="!dualCanSeek"
                    @input="onDualSeekInput"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Video title and metadata -->
        <div class="video-info-section" v-if="playbackData && !loading">
          <h1 class="video-info-title">{{ session ? session.title : course?.title }}</h1>
          
          <!-- Channel Info Row (Subscribers, Pin buttons) -->
          <div class="channel-info-row">
            <div class="channel-main">
              <!-- Circular Avatar -->
              <div class="instructor-avatar" :style="{ backgroundColor: getAvatarBg(course?.instructor || course?.title || 'Course') }">
                {{ getInitials(course?.instructor || course?.title || 'CS') }}
              </div>
              <div class="channel-text">
                <span class="instructor-name">{{ course?.instructor }}</span>
                <span class="course-name">{{ course?.title }}</span>
              </div>
              
              <!-- Subscribe style Pin button (recorded only) -->
              <button
                v-if="props.mode === 'recorded'"
                @click="toggleSubscribe"
                class="btn subscribe-pill"
                :class="{ 'subscribed': subscribed }"
                :title="subscribed ? $t('sessions.unsubscribe') : $t('sessions.subscribe')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="subscribed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span>{{ subscribed ? $t('navigation.pinned') : $t('sessions.subscribe') }}</span>
              </button>
            </div>

             <!-- Action Pills -->
            <div class="action-pills">
              <!-- Select Stream Pill -->
              <div v-if="playbackData && Object.keys(playbackData.streams).length > 1" class="action-pill-select-wrapper">
                <select
                  :value="selectedStream"
                  class="action-pill-select"
                  @change="onStreamChange"
                >
                  <option v-if="hasDualStreams" :value="DUAL_STREAM_KEY">
                    {{ $t('playback.bothStreams') }}
                  </option>
                  <option v-for="(stream, key) in playbackData.streams" :key="key" :value="key">
                    {{ stream.type === 'camera' ? $t('playback.streamCamera') : stream.type === 'screen' ? $t('playback.streamScreen') : stream.name }}
                  </option>
                </select>
              </div>

              <button
                v-if="props.mode === 'live'"
                @click="copyStreamUrl"
                class="btn action-pill-btn"
                :disabled="!canCopyStreamUrl"
                :title="isDualStreamSelected ? $t('playback.selectOneStreamToCopy') : streamUrlCopied ? $t('playback.urlCopied') : $t('playback.copyStreamUrl')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span>{{ streamUrlCopied ? $t('playback.urlCopied') : $t('playback.copyStreamUrl') }}</span>
              </button>

              <button @click="refreshPage" class="btn action-pill-btn" :title="$t('playback.refresh')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>{{ $t('playback.refresh') }}</span>
              </button>
            </div>
          </div>

          <!-- YouTube style expandable Description Box -->
          <div class="description-box" :class="{ 'expanded': descriptionExpanded }" @click="!descriptionExpanded && (descriptionExpanded = true)">
            <div class="description-header">
              <span class="description-stats" v-if="session?.started_at">
                {{ formatDate(session.started_at) }}
              </span>
              <span class="description-stats" v-else-if="course?.time">
                {{ course.time }}
              </span>
              <span class="description-stats" v-if="session?.duration">
                · {{ formatDuration(session.duration) }}
              </span>
            </div>
            
            <div class="description-details-content">
              <!-- Render details inside description box -->
              <p v-if="course?.college_name"><strong>{{ $t('sessions.college') }}:</strong> {{ course.college_name }}</p>
              <p v-if="course?.classrooms && course.classrooms.length > 0">
                <strong>{{ $t('sessions.classrooms') }}:</strong> {{ course.classrooms.map(c => c.name).join(', ') }}
              </p>
              <p v-if="course?.professors && course.professors.length > 0">
                <strong>{{ $t('playback.professors') }}:</strong> {{ course.professors.join(', ') }}
              </p>
              <p v-if="course?.participant_count !== undefined">
                <strong>{{ $t('sessions.participants') }}:</strong> {{ course.participant_count }}
              </p>
              <p v-if="currentStreamData || isDualStreamSelected">
                <strong>{{ $t('playback.currentStream') }}:</strong> 
                <span v-if="isDualStreamSelected">{{ $t('playback.bothStreams') }}</span>
                <span v-else-if="currentStreamData">
                  {{ currentStreamData.type === 'camera' ? $t('playback.streamCamera') : currentStreamData.type === 'screen' ? $t('playback.streamScreen') : currentStreamData.name }}
                </span>
              </p>
            </div>

            <!-- Show more / less trigger -->
            <button class="description-toggle-btn" @click.stop="descriptionExpanded = !descriptionExpanded">
              {{ descriptionExpanded ? 'Show less' : '...more' }}
            </button>
          </div>
        </div>

        <!-- Slide extraction panel (screen or dual view only) -->
        <SlideExtractionPanel
          v-if="playbackData && !loading && !error && canExtract"
          :enabled="slideExtraction.isSlideExtractionEnabled.value"
          :status="slideExtraction.slideExtractionStatus.value"
          :slides="slideExtraction.extractedSlides.value"
          :post-status="extractionPostStatus"
          :is-post-processing="slideExtraction.isPostProcessing.value"
          :capture-not-supported="slideExtraction.captureNotSupported.value"
          @toggle="onExtractionToggle"
          @post-process="slideExtraction.executePostProcessing()"
        />
      </div>

      <!-- Right Column: Sibling Sessions Sidebar Playlist (Hidden in cinema mode on desktop) -->
      <div 
        class="playback-sidebar-playlist" 
        v-if="props.mode === 'recorded' && !isCinemaMode"
      >
        <div class="playlist-header">
          <h3 class="playlist-title">{{ course?.title }}</h3>
          <span class="playlist-subtitle">{{ siblingSessions.length }} {{ $t('playback.duration') !== 'Duration' ? '节课' : 'sessions' }}</span>
        </div>

        <div v-if="isLoadingSiblings" class="playlist-loading">
          <div class="spinner spinner--sm"></div>
        </div>

        <div v-else class="playlist-items custom-scrollbar">
          <div 
            v-for="(sib, idx) in siblingSessions" 
            :key="sib.session_id"
            class="playlist-item-row"
            :class="{ 'active-playing': sib.session_id === session?.session_id }"
            @click="playSession(sib)"
          >
            <span class="row-index">
              <span v-if="sib.session_id === session?.session_id">▶</span>
              <span v-else>{{ idx + 1 }}</span>
            </span>
            <div class="row-thumb">
              <img :src="getCourseCover(course?.id)" class="row-thumb-img" alt="" />
              <span class="row-duration" v-if="sib.duration">{{ formatDurationBadge(sib.duration) }}</span>
            </div>
            <div class="row-info">
              <h4 class="row-title" :title="sib.title">{{ sib.title }}</h4>
              <span class="row-date">{{ formatDateShort(sib.started_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRef } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DUAL_STREAM_KEY, useVideoPlayer, type DualAudioSource } from '../../composables/video/useVideoPlayer'
import { useControlsVisibility } from '../../composables/video/useControlsVisibility'
import { useSlideExtraction } from '../../composables/video/useSlideExtraction'
import { postProcessingStatus } from '../../lib/postProcessing/runner'
import { playbackStore } from '../../stores/playbackStore'
import { router } from '../../router'
import { stashCourse, stashSession } from '../../stores/courseTransfer'
import SingleStreamControls from './SingleStreamControls.vue'
import SlideExtractionPanel from './SlideExtractionPanel.vue'
import type { Course } from '../../composables/useCourseList'
import { getCourseInfo, type SessionData } from '../../lib/api'
import { authStore } from '../../stores/authStore'
import { isSubscribed, toggleSubscribedCourse } from '../../composables/subscribedCourses'
import { getCourseCover, getAvatarBg, getInitials } from '../../composables/courseCover'

const props = defineProps<{
  course: Course | null
  session?: SessionData | null
  mode: 'live' | 'recorded'
}>()

const emit = defineEmits<{
  back: []
}>()

// Local UI state
const isPictureInPicture = ref(false)
const isCinemaMode = playbackStore.cinema
const dualVideoContainer = ref<HTMLElement | null>(null)
const isDualOrderSwapped = ref(false)
const isDualFullscreen = ref(false)
const singleVideoContainer = ref<HTMLElement | null>(null)
const isSingleFullscreen = ref(false)
const singleCurrentTime = ref(0)
const singleDuration = ref(0)
const singleVolume = ref(1)
const lastNonZeroVolume = ref(1)
const showSpeedPanel = ref(false)
const showDualAudioPanel = ref(false)
const showDualMorePanel = ref(false)
const streamUrlCopied = ref(false)

// Expandable description box state
const descriptionExpanded = ref(false)

// Sibling sessions sidebar state
const siblingSessions = ref<SessionData[]>([])
const isLoadingSiblings = ref(false)

const playbackRateOptions = [1, 1.25, 1.5, 2]

const courseRef = toRef(props, 'course')
const sessionRef = computed(() => props.session ?? null)

const videoPlayerComposable = useVideoPlayer({
  mode: props.mode,
  course: courseRef,
  session: sessionRef,
})

const videoPlayer = videoPlayerComposable.videoPlayer
const cameraVideoPlayer = videoPlayerComposable.cameraVideoPlayer
const screenVideoPlayer = videoPlayerComposable.screenVideoPlayer
void cameraVideoPlayer
void screenVideoPlayer

const {
  loading,
  error,
  playbackData,
  selectedStream,
  isPlaying,
  isVideoLoading,
  currentPlaybackRate,
  isRetrying,
  retryMessage,
  shouldVideoMute,
  isDualStreamSelected,
  hasDualStreams,
  currentStreamData,
  dualAudioSource,
  dualVolume,
  dualCurrentTime,
  dualDuration,
  dualCanSeek,
} = videoPlayerComposable

const {
  switchStream,
  changePlaybackRate,
  retryLoad,
  onVideoError,
  onCanPlay,
  onEnded,
  preventUnmute,
  toggleDualPlayback,
  seekDualStreams,
  setDualAudioSource,
  setDualVolume,
  applyDualAudioState,
  onDualTimeUpdate,
  onDualPlayStateChanged,
  onDualEnded,
  preventDualUnmute,
} = videoPlayerComposable

const cameraPanelOrder = computed(() => (isDualOrderSwapped.value ? 2 : 1))
const screenPanelOrder = computed(() => (isDualOrderSwapped.value ? 1 : 2))

const dualSeekProgress = computed(() => {
  if (!dualCanSeek.value || dualDuration.value <= 0) return '0%'
  const progress = (dualCurrentTime.value / dualDuration.value) * 100
  return `${Math.min(100, Math.max(0, progress))}%`
})
const singleCanSeek = computed(() => Number.isFinite(singleDuration.value) && singleDuration.value > 0)
const singleSeekProgress = computed(() => {
  if (!singleCanSeek.value) return '0%'
  const progress = (singleCurrentTime.value / singleDuration.value) * 100
  return `${Math.min(100, Math.max(0, progress))}%`
})
const singleEffectiveVolume = computed(() => (shouldVideoMute.value ? 0 : singleVolume.value))
const singleVolumeProgress = computed(() => `${Math.min(100, Math.max(0, singleEffectiveVolume.value * 100))}%`)
const singleIsMuted = computed(() => singleEffectiveVolume.value <= 0)
const dualEffectiveVolume = computed(() => (shouldVideoMute.value ? 0 : dualVolume.value))
const dualVolumeProgress = computed(() => `${Math.min(100, Math.max(0, dualEffectiveVolume.value * 100))}%`)
const dualIsMuted = computed(() => dualEffectiveVolume.value <= 0)

const lastPlaybackPosition = computed(() => videoPlayerComposable.lastPlaybackPosition)

// Slide extraction (always watch-mode on the web). The provider targets the
// screen (vga) element in dual view, the single player otherwise; it's read
// live on every capture tick.
const slideExtraction = useSlideExtraction({
  mode: props.mode,
  course: courseRef,
  session: sessionRef,
  currentPlaybackRate,
})
slideExtraction.videoElementProvider.value = () =>
  isDualStreamSelected.value ? screenVideoPlayer.value : videoPlayer.value

// Extraction is possible when the capture source shows the screen stream.
const canExtract = computed(
  () => isDualStreamSelected.value || currentStreamData.value?.type === 'screen',
)

const extractionPostStatus = computed(() => {
  const folder = slideExtraction.currentFolder.value
  return folder ? postProcessingStatus[folder] ?? null : null
})

const onExtractionToggle = (checked: boolean) => {
  slideExtraction.isSlideExtractionEnabled.value = checked
  void slideExtraction.toggleSlideExtraction()
}

// Switching to a camera-only view mid-extraction force-stops it (desktop parity).
watch(canExtract, (can) => {
  if (!can) {
    slideExtraction.forceStopSlideExtraction()
  }
})

// Leaving this page mid-extraction (sidebar nav, browser back, the player's
// back button, a sibling-session switch) unmounts it and kills the run —
// confirm first. beforeunload covers reload/tab-close the same way.
const { t } = useI18n()
const extractionActive = computed(
  () =>
    slideExtraction.isSlideExtractionEnabled.value ||
    slideExtraction.slideExtractionStatus.value.isRunning,
)
const confirmLeaveExtraction = () =>
  !extractionActive.value || window.confirm(t('playback.confirmLeaveExtraction'))

onBeforeRouteLeave(() => confirmLeaveExtraction())
onBeforeRouteUpdate((to, from) => {
  if (to.params.sessionId === from.params.sessionId) return true
  return confirmLeaveExtraction()
})

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (extractionActive.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

// Pinned / Subscription state
const subscribed = computed(() => !!props.course?.id && isSubscribed(props.course.id))
const toggleSubscribe = () => {
  if (!props.course) return
  toggleSubscribedCourse(props.course)
}

// Methods
const goBack = () => emit('back')
const refreshPage = () => {
  videoPlayerComposable.error.value = null
  videoPlayerComposable.resetErrorCounters()
  videoPlayerComposable.loadVideoStreams()
}

const onStreamChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  selectedStream.value = value
  switchStream()
}

const playSession = (targetSession: SessionData) => {
  if (!props.course) return
  // The player route is keyed by fullPath, so this remounts the whole page —
  // same teardown/reload as the old in-place playbackStore mutation.
  stashCourse(props.course)
  stashSession(props.course.id, targetSession)
  void router.push({
    name: 'player-recorded',
    params: { courseId: props.course.id, sessionId: targetSession.session_id },
  })
}

// Sibling fetching
const loadSiblingSessions = async () => {
  if (props.mode !== 'recorded' || !props.course?.id) return
  const token = authStore.token.value
  if (!token) return
  isLoadingSiblings.value = true
  try {
    const response = await getCourseInfo(props.course.id, token)
    siblingSessions.value = response.videos || []
  } catch (err) {
    console.error('Failed to load sibling sessions in playback watch page:', err)
  } finally {
    isLoadingSiblings.value = false
  }
}

// Live stream URL copy
const canCopyStreamUrl = computed(
  () => props.mode === 'live' && !isDualStreamSelected.value && !!currentStreamData.value?.original_url,
)
const copyStreamUrl = async () => {
  const url = currentStreamData.value?.original_url
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    streamUrlCopied.value = true
    setTimeout(() => {
      streamUrlCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy stream URL:', err)
  }
}

// Picture in Picture
const togglePictureInPicture = async () => {
  const video = videoPlayer.value
  if (!video) return

  try {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
    } else {
      await video.requestPictureInPicture()
    }
  } catch (err) {
    console.error('Error toggling Picture in Picture:', err)
  }
}

const onEnterPictureInPicture = () => {
  isPictureInPicture.value = true
}

const onLeavePictureInPicture = () => {
  isPictureInPicture.value = false
}

// Cinema mode
const toggleCinemaMode = () => {
  isCinemaMode.value = !isCinemaMode.value
}

// Dual controls
const setDualAudio = (source: DualAudioSource) => {
  setDualAudioSource(source)
  showDualAudioPanel.value = false
}

const lastNonZeroDualVolume = ref(1)
const onDualVolumeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (value > 0) lastNonZeroDualVolume.value = value
  setDualVolume(value)
}
const toggleDualMute = () => {
  if (dualVolume.value > 0) {
    setDualVolume(0)
  } else {
    setDualVolume(lastNonZeroDualVolume.value || 1)
  }
}

const onDualSeekInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  seekDualStreams(Number(target.value))
}

const toggleDualStreamOrder = () => {
  isDualOrderSwapped.value = !isDualOrderSwapped.value
  showDualMorePanel.value = false
}

const toggleCinemaFromMenu = () => {
  toggleCinemaMode()
  showDualMorePanel.value = false
}

const togglePipFromMenu = () => {
  void togglePictureInPicture()
  showDualMorePanel.value = false
}

const toggleDualAudioPanel = () => {
  showDualAudioPanel.value = !showDualAudioPanel.value
  if (showDualAudioPanel.value) {
    showDualMorePanel.value = false
    showSpeedPanel.value = false
  }
}

const toggleDualMorePanel = () => {
  showDualMorePanel.value = !showDualMorePanel.value
  if (showDualMorePanel.value) {
    showDualAudioPanel.value = false
    showSpeedPanel.value = false
  }
}

const toggleDualFullscreen = async () => {
  const container = dualVideoContainer.value
  if (!container) return

  try {
    if (document.fullscreenElement === container) {
      await document.exitFullscreen()
    } else {
      await container.requestFullscreen()
    }
  } catch (err) {
    console.error('Error toggling dual fullscreen:', err)
  }
}

// Single-stream control-bar actions
const toggleSinglePlayback = () => {
  const video = videoPlayer.value
  if (!video) return
  if (video.paused) {
    video.play().catch(() => {})
  } else {
    video.pause()
  }
}

const seekSingle = (time: number) => {
  const video = videoPlayer.value
  if (!video || !Number.isFinite(video.duration)) return
  video.currentTime = Math.min(Math.max(time, 0), video.duration)
}

const onSingleSeekInput = (next: number) => {
  singleCurrentTime.value = next
  seekSingle(next)
}

const toggleSingleFullscreen = async () => {
  const container = singleVideoContainer.value
  if (!container) return

  try {
    if (document.fullscreenElement === container) {
      await document.exitFullscreen()
    } else {
      await container.requestFullscreen()
    }
  } catch (err) {
    console.error('Error toggling single fullscreen:', err)
  }
}

const applySingleVolume = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value))
  singleVolume.value = clamped
  if (clamped > 0) lastNonZeroVolume.value = clamped
  const video = videoPlayer.value
  if (video && !shouldVideoMute.value) {
    video.volume = clamped
  }
}

const toggleSingleMute = () => {
  if (singleVolume.value > 0) {
    applySingleVolume(0)
  } else {
    applySingleVolume(lastNonZeroVolume.value || 1)
  }
}

const toggleSpeedPanel = () => {
  showSpeedPanel.value = !showSpeedPanel.value
  if (showSpeedPanel.value) {
    showDualAudioPanel.value = false
    showDualMorePanel.value = false
  }
}

const setPlaybackRateFromPanel = (rate: number) => {
  currentPlaybackRate.value = rate
  changePlaybackRate()
  showSpeedPanel.value = false
  // Keep the extraction check interval in step with the playback rate.
  if (slideExtraction.isSlideExtractionEnabled.value) {
    slideExtraction.slideExtractorInstance.value?.setPlaybackRate(rate)
  }
}

// Auto-hide the control overlay
const { controlsVisible, pointerOverControls, showControls, onPlayerPointerLeave } =
  useControlsVisibility({
    isPlaying,
    persistSources: [showSpeedPanel, showDualAudioPanel, showDualMorePanel],
  })

// Utility functions
const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString()
  } catch {
    return dateString
  }
}

const formatDateShort = (dateString: string): string => {
  try {
    const d = new Date(dateString)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
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

const formatPlaybackTime = (duration: string | number): string => {
  const totalSeconds = Math.max(0, Math.floor(typeof duration === 'string' ? parseInt(duration) : duration))
  if (isNaN(totalSeconds)) return '0:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatDurationBadge = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Keep control bar in sync
let currentEventListeners: (() => void)[] = []

watch(
  () => videoPlayer.value,
  (newPlayer) => {
    currentEventListeners.forEach((cleanup) => cleanup())
    currentEventListeners = []

    if (newPlayer) {
      const updatePlayingState = () => {
        videoPlayerComposable.isPlaying.value = !newPlayer.paused
      }
      const onTimeUpdate = () => {
        singleCurrentTime.value = newPlayer.currentTime
      }
      const onLoadedMeta = () => {
        singleDuration.value = Number.isFinite(newPlayer.duration) ? newPlayer.duration : 0
        singleCurrentTime.value = newPlayer.currentTime
      }

      singleDuration.value = Number.isFinite(newPlayer.duration) ? newPlayer.duration : 0
      singleCurrentTime.value = newPlayer.currentTime || 0
      if (!shouldVideoMute.value) {
        singleVolume.value = newPlayer.volume
        if (newPlayer.volume > 0) lastNonZeroVolume.value = newPlayer.volume
      }

      const onBufferWaiting = () => {
        if (slideExtraction.isSlideExtractionEnabled.value) {
          slideExtraction.slideExtractorInstance.value?.pauseForBuffering()
        }
      }
      const onBufferReady = () => {
        slideExtraction.slideExtractorInstance.value?.resumeAfterBuffering()
      }

      newPlayer.addEventListener('play', updatePlayingState)
      newPlayer.addEventListener('pause', updatePlayingState)
      newPlayer.addEventListener('ended', updatePlayingState)
      newPlayer.addEventListener('timeupdate', onTimeUpdate)
      newPlayer.addEventListener('durationchange', onLoadedMeta)
      newPlayer.addEventListener('loadedmetadata', onLoadedMeta)
      newPlayer.addEventListener('waiting', onBufferWaiting)
      newPlayer.addEventListener('canplay', onBufferReady)
      newPlayer.addEventListener('canplaythrough', onBufferReady)

      currentEventListeners.push(() => {
        newPlayer.removeEventListener('play', updatePlayingState)
        newPlayer.removeEventListener('pause', updatePlayingState)
        newPlayer.removeEventListener('ended', updatePlayingState)
        newPlayer.removeEventListener('timeupdate', onTimeUpdate)
        newPlayer.removeEventListener('durationchange', onLoadedMeta)
        newPlayer.removeEventListener('loadedmetadata', onLoadedMeta)
        newPlayer.removeEventListener('waiting', onBufferWaiting)
        newPlayer.removeEventListener('canplay', onBufferReady)
        newPlayer.removeEventListener('canplaythrough', onBufferReady)
      })

      if (currentStreamData.value && playbackData.value && !isDualStreamSelected.value) {
        nextTick(() => {
          videoPlayerComposable.loadVideoSource()
        })
      }
    }
  },
)

// Buffering hooks for the dual-view capture source (the screen element).
let screenBufferListeners: (() => void)[] = []
watch(
  () => screenVideoPlayer.value,
  (newPlayer) => {
    screenBufferListeners.forEach((cleanup) => cleanup())
    screenBufferListeners = []
    if (newPlayer) {
      const onBufferWaiting = () => {
        if (slideExtraction.isSlideExtractionEnabled.value) {
          slideExtraction.slideExtractorInstance.value?.pauseForBuffering()
        }
      }
      const onBufferReady = () => {
        slideExtraction.slideExtractorInstance.value?.resumeAfterBuffering()
      }
      newPlayer.addEventListener('waiting', onBufferWaiting)
      newPlayer.addEventListener('canplay', onBufferReady)
      newPlayer.addEventListener('canplaythrough', onBufferReady)
      screenBufferListeners.push(() => {
        newPlayer.removeEventListener('waiting', onBufferWaiting)
        newPlayer.removeEventListener('canplay', onBufferReady)
        newPlayer.removeEventListener('canplaythrough', onBufferReady)
      })
    }
  },
)

watch(isDualStreamSelected, async (isDual) => {
  if (isDual) {
    await nextTick()
    applyDualAudioState()
  } else {
    showDualAudioPanel.value = false
    showDualMorePanel.value = false
    showSpeedPanel.value = false
  }
})

const onFullscreenChange = () => {
  isDualFullscreen.value = document.fullscreenElement === dualVideoContainer.value
  isSingleFullscreen.value = document.fullscreenElement === singleVideoContainer.value
}

// Initial session fetching
onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('beforeunload', onBeforeUnload)
  await nextTick()
  videoPlayerComposable.loadVideoStreams()
  void loadSiblingSessions()
})

onUnmounted(async () => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (document.pictureInPictureElement && document.pictureInPictureElement === videoPlayer.value) {
    try {
      await document.exitPictureInPicture()
    } catch (err) {
      console.error('Error exiting Picture in Picture on unmount:', err)
    }
  }
  // Stops any running extraction, which kicks off the detached auto
  // post-processing run for the folder.
  slideExtraction.cleanupSlideExtraction()
  videoPlayerComposable.cleanup()
  currentEventListeners.forEach((cleanupFn) => cleanupFn())
  currentEventListeners = []
  screenBufferListeners.forEach((cleanupFn) => cleanupFn())
  screenBufferListeners = []
})
</script>

<style scoped>
.playback-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
  overflow-y: auto;
}

.playback-content-wrapper {
  display: flex;
  max-width: none;
  margin: 0 auto;
  padding: 1.5rem 3rem;
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

/* Main video column */
.main-video-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.playback-header {
  margin-bottom: 0;
  flex-shrink: 0;
  padding-top: 0.5rem;
}

.back-btn {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Fused Player Container */
.player-panel-container {
  position: relative; /* Anchor absolute elements within the player bounds */
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  background-color: #000000;
  border: 1px solid var(--border-color);
}

.player-loading-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #aaaaaa;
}

.video-content {
  width: 100%;
  height: 100%;
}

.player-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.video-container {
  position: relative;
  width: 100%;
  flex: 1;
  background-color: #000000;
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.retry-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background-color: rgba(15, 15, 15, 0.95);
  color: #ffffff;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 20;
  backdrop-filter: blur(4px);
}

.retry-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.warming-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.875rem;
  padding: 1.5rem;
  text-align: center;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 20;
}

.warming-spinner {
  width: 2.25rem;
  height: 2.25rem;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.warming-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}

.warming-hint {
  margin: 0;
  max-width: 26.25rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
}

/* Dual layout */
.dual-playback-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.dual-video-container {
  width: 100%;
  height: 100%;
}

.dual-video-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background-color: #1a1a1a;
  height: 100%;
}

.dual-video-panel {
  position: relative;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dual-video-label {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 5;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background-color: rgba(15, 15, 15, 0.8);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
}

.dual-video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* Video metadata */
.video-info-section {
  margin-top: 1.25rem;
  padding: 0 0.25rem;
}

.video-info-title {
  margin: 0;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.75rem;
  color: var(--text-primary);
}

/* Channel Row (Subscribe button) */
.channel-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.channel-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.instructor-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.channel-text {
  display: flex;
  flex-direction: column;
}

.instructor-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.course-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}

.subscribe-pill {
  background-color: var(--text-primary);
  border-color: var(--text-primary);
  color: var(--bg-page-alt);
  font-weight: 600;
  padding: 0.4375rem 1.125rem;
  height: 2.125rem;
  border-radius: 6.25rem;
  font-size: 0.8125rem;
  margin-left: 1rem;
}

.subscribe-pill.subscribed {
  background-color: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.action-pills {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-pill-btn {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.8125rem;
  border-radius: 6.25rem;
  height: 2.125rem;
  padding: 0 0.875rem;
}

/* Expandable Description Box */
.description-box {
  background-color: var(--bg-elevated);
  border-radius: 0.75rem;
  padding: 0.75rem 0.875rem;
  margin-top: 0.875rem;
  font-size: 0.875rem;
  line-height: 1.4rem;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s;
}

.description-box:hover {
  background-color: var(--bg-hover);
}

.description-box.expanded {
  cursor: default;
}

.description-header {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.375rem;
}

.description-stats {
  margin-right: 0.5rem;
}

.description-details-content {
  color: var(--text-primary);
  max-height: 2.8rem;
  overflow: hidden;
}

.description-box.expanded .description-details-content {
  max-height: none;
}

.description-details-content p {
  margin: 0.25rem 0;
}

.description-toggle-btn {
  background: transparent;
  border: none;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
  margin-top: 0.5rem;
  display: block;
}

/* Sibling Sessions Sidebar Playlist */
.playback-sidebar-playlist {
  width: 25rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-page-alt);
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height) - 3rem);
  flex-shrink: 0;
}

.playlist-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
  border-radius: 0.75rem 0.75rem 0 0;
}

.playlist-header .playlist-title {
  margin: 0;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-header .playlist-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  display: block;
}

.playlist-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.playlist-items {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.playlist-item-row {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
  user-select: none;
  gap: 0.625rem;
}

.playlist-item-row:hover {
  background-color: var(--bg-hover);
}

.playlist-item-row.active-playing {
  background-color: var(--focus-ring);
}

.row-index {
  width: 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.playlist-item-row.active-playing .row-index {
  color: var(--accent);
  font-weight: 700;
}

.row-thumb {
  position: relative;
  width: 5.5rem;
  aspect-ratio: 16 / 9;
  border-radius: 0.375rem;
  overflow: hidden;
  background-color: var(--bg-elevated);
  flex-shrink: 0;
}

.row-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-duration {
  position: absolute;
  bottom: 0.125rem;
  right: 0.125rem;
  background-color: rgba(15, 15, 15, 0.85);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.0625rem 0.1875rem;
  border-radius: 0.125rem;
}

.row-info {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  display: block;
}

/* Cinema Mode overrules */
.playback-page.cinema-mode .playback-content-wrapper {
  max-width: none;
  padding: 0;
  flex-direction: column;
}

.playback-page.cinema-mode .main-video-section {
  width: 100%;
}

.playback-page.cinema-mode .player-panel-container {
  border-left: none;
  border-right: none;
  border-radius: 0;
  height: calc(80vh - var(--header-height));
  max-height: 48rem;
  aspect-ratio: auto;
}

.playback-page.cinema-mode .video-info-section {
  max-width: 80rem;
  width: 100%;
  margin: 1.5rem auto 0;
  padding: 0 1.5rem 2rem;
}

/* Responsive queries */
@media (max-width: 1120px) {
  .playback-content-wrapper {
    flex-direction: column;
  }
  .playback-sidebar-playlist {
    width: 100%;
    height: auto;
    max-height: 25rem;
  }
}

.action-pill-select-wrapper {
  display: inline-flex;
  position: relative;
}

.action-pill-select {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.8125rem;
  border-radius: 6.25rem;
  height: 2.125rem;
  padding: 0 1.75rem 0 0.875rem;
  outline: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.625rem center;
  background-size: 0.75rem;
  transition: background-color 0.2s, border-color 0.2s;
}

.action-pill-select:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.action-pill-select option {
  background-color: var(--bg-modal);
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .playback-content-wrapper {
    padding: 0.5rem;
    gap: 1rem;
  }
  .player-panel-container {
    border-radius: 0.5rem;
  }
}

@media (max-width: 480px) {
  .action-pills {
    margin-top: 0.25rem;
    width: 100%;
  }
  .subscribe-pill {
    margin-left: auto;
  }
}
</style>

<style scoped src="./playerControlBar.css"></style>
