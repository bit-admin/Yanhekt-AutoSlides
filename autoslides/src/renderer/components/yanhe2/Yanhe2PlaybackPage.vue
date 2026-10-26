<template>
  <div class="playback-page" :class="{ 'cinema-mode': isCinemaMode }">
    <div class="header">
      <div class="header-main">
        <button @click="emit('back')" class="btn back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="title-info">
          <h2>{{ title || $t('playback.unknownCourse') }}</h2>
          <p v-if="subLine">{{ subLine }}</p>
          <div v-if="!isVisible && isPlaying" class="background-mode-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {{ $t('playback.playingInBackground') }}
          </div>
        </div>
        <!-- The Recorded player's download button: the stream on screen, or both. Filed under
             the same lecture on Yanhekt; one that is not there gets a message box. -->
        <button
          v-if="isRecording"
          @click="downloadCurrent"
          class="btn download-btn"
          :disabled="loading || downloadKinds.length === 0 || preparingDownload"
          :title="downloadTitle"
        >
          <span v-if="preparingDownload" class="download-spinner" aria-hidden="true"></span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button @click="load" class="btn refresh-btn" :disabled="loading || isTaskRunning" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button @click="showDetails = !showDetails" class="btn expand-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotated': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="course-details">
        <div class="course-detail-item" v-if="teacher">
          <span class="detail-label">{{ $t('playback.instructor') }}</span>
          <span class="detail-value">{{ teacher }}</span>
        </div>
        <div class="course-detail-item" v-if="room">
          <span class="detail-label">{{ $t('sessions.classrooms') }}</span>
          <span class="detail-value">{{ room }}</span>
        </div>
        <div class="course-detail-item" v-if="session.college">
          <span class="detail-label">{{ $t('sessions.college') }}</span>
          <span class="detail-value">{{ session.college }}</span>
        </div>
        <div class="course-detail-item" v-if="dateLine">
          <span class="detail-label">{{ $t('playback.sessionDate') }}</span>
          <span class="detail-value">{{ dateLine }}</span>
        </div>
        <div class="course-detail-item" v-if="playback?.duration">
          <span class="detail-label">{{ $t('playback.duration') }}</span>
          <span class="detail-value">{{ formatPlaybackTime(playback.duration) }}</span>
        </div>
        <div class="course-detail-item" v-if="currentStream">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span class="detail-value">{{ streamLabel(currentStream.type) }}</span>
        </div>
        <div class="course-detail-item" v-else-if="isDualSelected">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span class="detail-value">{{ $t('playback.bothStreams') }}</span>
        </div>
      </div>
    </div>

    <div class="content custom-scrollbar">
      <div v-if="loading" class="loading-state">
        <div class="spinner spinner--lg"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
      </div>

      <div v-else-if="problem" class="loading-state error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <div class="error-details">
          <p class="error-message">{{ problemMessage }}</p>
        </div>
        <button @click="load" class="btn btn--primary btn--lg">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playback" class="video-content" :data-playback-mode="mode">
        <div v-if="fallbackMessage" class="combined-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          <div class="warning-messages">
            <div class="warning-message">{{ fallbackMessage }}</div>
          </div>
        </div>

        <div class="player-panel">
          <DualStreamControls
            :selected-stream="selected"
            :current-playback-rate="playbackRate"
            :streams="selectorStreams"
            :playback-rate-options="playbackRateOptions"
            :mode="mode"
            :is-dual-stream-selected="isDualSelected"
            :is-picture-in-picture="isPictureInPicture"
            :is-cinema-mode="isCinemaMode"
            :should-disable-controls="isTaskRunning"
            :video-player-ready="!!videoPlayer"
            :has-dual-streams="hasDualStreams"
            :dual-stream-key="YANHE2_BOTH_STREAMS"
            @update:selectedStream="onSelectStream"
            @update:currentPlaybackRate="setPlaybackRate"
            @toggle-picture-in-picture="togglePictureInPicture"
            @toggle-cinema-mode="toggleCinemaMode"
          />

          <!-- Classroom mic track. Outside the single/dual switch so a layout
               change does not remount it and refetch the file. -->
          <audio v-if="hasMicAudio" ref="micAudioPlayer" preload="auto"></audio>

          <div
            v-if="!isDualSelected"
            ref="videoContainer"
            class="video-container"
            :class="{ 'collapsed': isPictureInPicture, 'is-fullscreen': isFullscreen, 'controls-hidden': !controlsVisible }"
            :data-pip-message="$t('playback.videoPlayingInPiP')"
            @mousemove="showControls"
            @mouseleave="onPlayerPointerLeave"
          >
            <video
              ref="videoPlayer"
              class="video-player"
              preload="metadata"
              @error="onVideoError"
              @enterpictureinpicture="isPictureInPicture = true"
              @leavepictureinpicture="isPictureInPicture = false"
            >
              {{ $t('playback.browserNotSupported') }}
            </video>
            <BufferingOverlay v-if="isBuffering" />
            <div v-if="captionText && !isPictureInPicture" class="caption-layer" :class="{ 'above-controls': controlsVisible }">
              <span class="caption-text">{{ captionText }}</span>
            </div>

            <SingleStreamControls
              v-if="!isPictureInPicture"
              :mode="mode"
              :is-playing="isPlaying"
              :controls-visible="controlsVisible"
              :should-disable-controls="isTaskRunning"
              :should-video-mute="audioModeMuted"
              :mute-label-key="audioModeLabel"
              :current-time="currentTime"
              :duration="duration"
              :can-seek="canSeek"
              :seek-progress="seekProgress"
              :effective-volume="effectiveVolume"
              :volume-progress="volumeProgress"
              :is-muted="effectiveVolume <= 0"
              :current-playback-rate="playbackRate"
              :playback-rate-options="playbackRateOptions"
              :show-speed-panel="showSpeedPanel"
              :show-more-panel="showMorePanel"
              :has-mic-audio="hasMicAudio"
              :show-audio-panel="showAudioPanel"
              :audio-source="micAudioOn ? 'mic' : 'video'"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="isPictureInPicture"
              :video-player-ready="!!videoPlayer"
              :captions-available="captionsAvailable"
              :captions-on="captionsOn"
              :format-time="formatPlaybackTime"
              @toggle-playback="togglePlayback"
              @seek-input="onSeekInput"
              @volume-input="applyVolume"
              @toggle-mute="toggleMute"
              @toggle-speed-panel="toggleSpeedPanel"
              @toggle-audio-panel="toggleAudioPanel"
              @set-audio-source="pickSingleAudio"
              @set-playback-rate="setRateFromPanel"
              @toggle-fullscreen="toggleFullscreen"
              @toggle-more-panel="toggleMorePanel"
              @toggle-cinema="toggleCinemaFromMenu"
              @toggle-captions="toggleCaptions"
              @toggle-pip="togglePipFromMenu"
              @pointer-over-controls="pointerOverControls = $event"
            />
          </div>

          <!-- Both Streams: camera + screen side by side, the screen leading. -->
          <div
            v-else
            ref="dualContainer"
            class="dual-playback-shell"
            :class="{ 'is-fullscreen': isFullscreen, 'controls-hidden': !controlsVisible }"
            @mousemove="showControls"
            @mouseleave="onPlayerPointerLeave"
          >
            <div class="video-container dual-video-container">
              <div class="dual-video-grid">
                <div class="dual-video-panel" :style="{ order: isOrderSwapped ? 2 : 1 }">
                  <div class="dual-video-label">{{ $t('playback.streamCamera') }}</div>
                  <video ref="cameraVideoPlayer" class="dual-video-player" preload="metadata" playsinline @error="onVideoError">
                    {{ $t('playback.browserNotSupported') }}
                  </video>
                </div>
                <div class="dual-video-panel" :style="{ order: isOrderSwapped ? 1 : 2 }">
                  <div class="dual-video-label">{{ $t('playback.streamScreen') }}</div>
                  <video ref="screenVideoPlayer" class="dual-video-player" preload="metadata" playsinline @error="onVideoError">
                    {{ $t('playback.browserNotSupported') }}
                  </video>
                </div>
              </div>
              <BufferingOverlay v-if="isBuffering" />
            </div>
            <div v-if="captionText" class="caption-layer" :class="{ 'above-controls': controlsVisible }">
              <span class="caption-text">{{ captionText }}</span>
            </div>

            <SingleStreamControls
              :mode="mode"
              :is-playing="isPlaying"
              :controls-visible="controlsVisible"
              :should-disable-controls="isTaskRunning"
              :should-video-mute="audioModeMuted"
              :mute-label-key="audioModeLabel"
              :current-time="currentTime"
              :duration="duration"
              :can-seek="canSeek"
              :seek-progress="seekProgress"
              :effective-volume="effectiveVolume"
              :volume-progress="volumeProgress"
              :is-muted="effectiveVolume <= 0"
              :current-playback-rate="playbackRate"
              :playback-rate-options="playbackRateOptions"
              :show-speed-panel="showSpeedPanel"
              :show-more-panel="showMorePanel"
              :has-mic-audio="false"
              :show-audio-panel="showAudioPanel"
              audio-source="video"
              :audio-sources="dualAudioSources"
              :picked-audio="micAudioOn ? 'mic' : dualAudioSource"
              can-swap-order
              :pip-available="false"
              :is-fullscreen="isFullscreen"
              :is-cinema-mode="isCinemaMode"
              :is-picture-in-picture="false"
              :video-player-ready="true"
              :captions-available="captionsAvailable"
              :captions-on="captionsOn"
              :format-time="formatPlaybackTime"
              @toggle-playback="togglePlayback"
              @seek-input="onSeekInput"
              @volume-input="applyVolume"
              @toggle-mute="toggleMute"
              @toggle-speed-panel="toggleSpeedPanel"
              @toggle-audio-panel="toggleAudioPanel"
              @pick-audio="pickDualAudio"
              @set-playback-rate="setRateFromPanel"
              @toggle-fullscreen="toggleFullscreen"
              @toggle-more-panel="toggleMorePanel"
              @toggle-cinema="toggleCinemaFromMenu"
              @toggle-captions="toggleCaptions"
              @swap-order="swapOrder"
              @pointer-over-controls="pointerOverControls = $event"
            />
          </div>

          <!-- Under a recording: slide extraction (the Yanhekt player's switch and
               gallery), or what Yanhe 2.0 made of it itself, its slides (Save hands
               them to the task queue) or its transcript. The view switch sits on the
               right; it opens on Server Slides when Yanhe 2.0 has slides, otherwise
               on Slide Extraction. A running extraction (a task's too) always shows
               its own gallery, and the switch is hidden meanwhile. -->
          <div v-if="isRecording" class="slide-gallery">
            <div class="gallery-header server-slides-header">
              <div class="server-slides-main">
                <template v-if="galleryView === 'extraction'">
                  <label class="extraction-toggle" :title="canExtract ? undefined : $t('yanhe2Playback.extractionNeedsScreen')">
                    <input
                      type="checkbox"
                      v-model="isSlideExtractionEnabled"
                      @change="toggleSlideExtraction"
                      :disabled="isTaskRunning || (!isSlideExtractionEnabled && !canExtract)"
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
                </template>
                <div v-else-if="galleryView === 'transcript'" class="slide-counter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="4" y1="6" x2="20" y2="6"/>
                    <line x1="4" y1="12" x2="20" y2="12"/>
                    <line x1="4" y1="18" x2="14" y2="18"/>
                  </svg>
                  <span class="counter-text">{{ transcriptLines.length }} {{ $t('yanhe2Playback.transcriptLines') }}</span>
                </div>
                <div v-else-if="slidesState === 'ready' && serverSlides.length > 0" class="slide-counter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="counter-text">{{ serverSlides.length }} {{ $t('playback.slides') }}</span>
                </div>
              </div>

              <div class="server-slides-side">
                <div v-if="galleryView === 'extraction'" class="slide-actions">
                  <button
                    v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                    @click="executePostProcessing()"
                    class="btn btn--primary"
                    :disabled="isPostProcessing"
                    :title="$t('playback.postProcessTip')"
                  >
                    <svg v-if="!isPostProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="m2 17 10 5 10-5"/>
                      <path d="m2 12 10 5 10-5"/>
                    </svg>
                    <div v-else class="processing-spinner"></div>
                    {{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}
                  </button>
                  <button
                    v-if="isSlideExtractionEnabled && extractedSlides.length > 0 && !isTaskRunning"
                    @click="clearAllSlides"
                    class="btn btn--danger-outline"
                    :title="$t('playback.clearAllTip')"
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
                <!-- Offered on the captions' terms: no button on a lecture whose timing could not be measured. -->
                <div v-else-if="galleryView === 'transcript'" class="slide-actions">
                  <button v-if="captionsAvailable" class="btn btn--primary" :disabled="preparingSubtitles" @click="downloadSubtitles">
                    <svg v-if="!preparingSubtitles" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <div v-else class="processing-spinner"></div>
                    {{ $t('yanhe2Playback.downloadSubtitles') }}
                  </button>
                </div>
                <button v-else-if="slidesState === 'failed'" @click="loadSlides" class="btn">
                  {{ $t('playback.retry') }}
                </button>
                <div v-else-if="serverSlides.length > 0" class="slide-actions">
                  <button class="btn btn--primary" :disabled="savingSlides" @click="saveSlides">
                    <svg v-if="!savingSlides" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <div v-else class="processing-spinner"></div>
                    {{ savingSlides ? $t('yanhe2Playback.savingSlides') : $t('yanhe2Playback.saveSlides') }}
                  </button>
                </div>

                <!-- The Search page's segmented control. Server Transcript only on a lecture
                     that has one. Hidden while extraction runs: the view is then its gallery. -->
                <div v-if="!isSlideExtractionEnabled" class="mode-switch">
                  <button
                    type="button"
                    :class="['mode-pill', { active: galleryView === 'extraction' }]"
                    :disabled="isTaskRunning"
                    @click="pickView('extraction')"
                  >
                    {{ $t('playback.slideExtraction') }}
                  </button>
                  <button
                    type="button"
                    :class="['mode-pill', { active: galleryView === 'server' }]"
                    :disabled="isTaskRunning"
                    @click="pickView('server')"
                  >
                    {{ $t('yanhe2Playback.serverSlides') }}
                  </button>
                  <button
                    v-if="hasTranscript"
                    type="button"
                    :class="['mode-pill', { active: galleryView === 'transcript' }]"
                    :disabled="isTaskRunning"
                    @click="pickView('transcript')"
                  >
                    {{ $t('yanhe2Playback.serverTranscript') }}
                  </button>
                </div>
              </div>
            </div>

            <template v-if="galleryView === 'extraction'">
              <!-- As in the Yanhekt player: a task's post-processing shows in Tasks instead. -->
              <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0 && !isTaskRunning" class="post-process-status-bar">
                <div class="status-bar-content">
                  <PostProcessingProgressBar :state="fromPlaybackStatus(postProcessStatus)" labels="long" />
                </div>
              </div>
              <SlideGallery
                v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                :slides="extractedSlides"
                :format-slide-time="formatSlideTime"
                @preview="openSlideModal"
                @delete="deleteSlide"
              />
            </template>
            <Yanhe2TranscriptPanel
              v-else-if="galleryView === 'transcript'"
              :lines="transcriptLines"
              :current-index="transcriptIndex"
              :shift="captionDelay ?? 0"
              :format-time="formatPlaybackTime"
            />
            <template v-else>
              <SlideGallery
                v-if="gallerySlides.length > 0"
                :slides="gallerySlides"
                :format-slide-time="formatPlaybackTime"
                :deletable="false"
                @preview="openSlidePreview"
              />
              <!-- Loading, failed or none: said in the gallery's place, not in the header. -->
              <p v-else-if="slidesNote" class="server-slides-note">{{ slidesNote }}</p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <PreviewModal
      :slide="previewedSlide"
      :format-slide-time="formatPlaybackTime"
      :deletable="false"
      :show-file-name="false"
      :time-label="$t('yanhe2Playback.slideShownAt')"
      @close="previewedId = null"
    />
    <PreviewModal
      :slide="selectedSlide"
      :format-slide-time="formatSlideTime"
      @close="closeSlideModal"
      @delete="deleteSlide"
    />
  </div>
</template>

<script setup lang="ts">
// A Yanhe 2.0 session opened from the Calendar or Curriculum, or by a task.
// Looks like PlaybackPage and shares its player chrome. One stream, or camera +
// screen side by side (Both Streams), driven by the same control bar. Under a
// recording: slide extraction from the screen stream, as in the Yanhekt player
// (watch mode here, task mode when the queue drives it), filed under the same
// lecture on Yanhekt; the slides Yanhe 2.0 detected itself, to look at, copy
// and save; and its transcript. No notes and no watch-position report.
import { computed, onMounted, onUnmounted, ref, shallowRef, toRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { beijingClock, beijingDate, type Yanhe2CalendarSession } from '@common/yanhe2Calendar'
import type { Yanhe2DownloadKind } from '@common/yanhe2Download'
import type { Yanhe2StreamType } from '@common/yanhe2Playback'
import { transcriptIndexAt } from '@common/yanhe2Transcript'
import { useYanhe2Player, YANHE2_BOTH_STREAMS, type Yanhe2StreamChoice } from '@features/yanhe2/useYanhe2Player'
import { useYanhe2Captions, yanhe2TranscriptView as transcriptView } from '@features/yanhe2/useYanhe2Captions'
import { useYanhe2Slides } from '@features/yanhe2/useYanhe2Slides'
import { useYanhe2TaskDriver } from '@features/yanhe2/useYanhe2TaskDriver'
import { usePostProcessing } from '@features/download/usePostProcessing'
import { useSlideExtraction, type Course, type ExtractionLecture, type Session } from '@features/video/useSlideExtraction'
import { useSlideGallery } from '@features/video/useSlideGallery'
import { usePerformanceOptimization } from '@features/video/usePerformanceOptimization'
import { fromPlaybackStatus } from '@shared/postProcessing/displayAdapter'
import { isSavingYanhe2Slides, saveYanhe2Slides } from '@features/yanhe2/yanhe2SlideSave'
import { downloadYanhe2Subtitles, isPreparingYanhe2Subtitles } from '@features/yanhe2/yanhe2SubtitleDownload'
import { downloadYanhe2Recording, isPreparingYanhe2Download } from '@features/yanhe2/yanhe2Download'
import type { GallerySlide } from '@features/video/gallerySlide'
import { audioModeLabelKey, isMutedByAudioMode } from '@features/video/audioMode'
import { useBufferingIndicator } from '@features/video/useBufferingIndicator'
import { streamFallbackMessageKey } from '@features/video/streamFallback'
import { useControlsVisibility } from '@features/video/useControlsVisibility'
import { useVideoKeyboard } from '@features/video/useVideoKeyboard'
import type { VideoStream } from '@features/video/useVideoPlayer'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { createLogger } from '@shared/utils/logger'
import BufferingOverlay from '../video/BufferingOverlay.vue'
import DualStreamControls from '../video/DualStreamControls.vue'
import PostProcessingProgressBar from '../video/PostProcessingProgressBar.vue'
import PreviewModal from '../video/PreviewModal.vue'
import SlideGallery from '../video/SlideGallery.vue'
import SingleStreamControls from '../video/SingleStreamControls.vue'
import Yanhe2TranscriptPanel from './Yanhe2TranscriptPanel.vue'

const log = createLogger('Yanhe2PlaybackPage')

const props = defineProps<{
  /** The calendar row the tab was opened from. */
  session: Yanhe2CalendarSession
  /** The AutoSlides account (badge) whose Yanhe 2.0 session plays it. */
  account: string
  isVisible: boolean
}>()

const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const videoPlayer = ref<HTMLVideoElement | null>(null)
const cameraVideoPlayer = ref<HTMLVideoElement | null>(null)
const micAudioPlayer = ref<HTMLAudioElement | null>(null)
const screenVideoPlayer = ref<HTMLVideoElement | null>(null)
const videoContainer = ref<HTMLElement | null>(null)
const dualContainer = ref<HTMLElement | null>(null)

const {
  loading,
  problem,
  sessionStatus,
  playback,
  mode,
  streams,
  selected,
  currentStream,
  hasDualStreams,
  isDualSelected,
  masterVideo,
  playbackRate,
  fallbackNotice,
  hasMicAudio,
  micAudioOn,
  setMicAudio,
  load,
  selectStream,
  setPlaybackRate,
  togglePlayback,
  seekTo,
  onVideoError,
} = useYanhe2Player({
  account: props.account,
  courseId: props.session.courseId,
  subId: props.session.subId,
  videoPlayer,
  cameraVideoPlayer,
  screenVideoPlayer,
  developerMode: toRef(configStore, 'developerMode'),
  micAudioPlayer,
  preferMicAudio: toRef(configStore, 'preferMicAudioByDefault'),
  // `taskDriver` is created below; this runs only when a stream fails, long after setup.
  canFallBack: () => !taskDriver.isTaskMode.value,
})

const { isBuffering } = useBufferingIndicator([videoPlayer, cameraVideoPlayer, screenVideoPlayer])

// Header. The calendar row is on hand before the session loads; the session's
// own answer replaces it where the two overlap.
const title = computed(() => playback.value?.title || props.session.title)
const teacher = computed(() => playback.value?.teacher || props.session.teacher)
const room = computed(() => playback.value?.room || props.session.room)
const subLine = computed(() => [teacher.value, room.value].filter(Boolean).join(' · '))
const dateLine = computed(() => {
  const startAt = playback.value?.startAt || props.session.startAt
  const endAt = playback.value?.endAt || props.session.endAt
  if (!startAt) return ''
  const end = beijingClock(endAt)
  return `${beijingDate(startAt * 1000)} ${beijingClock(startAt)}${end ? ` – ${end}` : ''}`
})
const showDetails = ref(false)

const streamLabel = (type: Yanhe2StreamType) => {
  if (type === 'screen') return t('playback.streamScreen')
  if (type === 'room') return t('playback.streamRoom')
  return t('playback.streamCamera')
}

// The selector component is the Yanhekt player's; give it the shape it lists.
const selectorStreams = computed(() => {
  const out: Record<string, VideoStream> = {}
  for (const stream of streams.value) {
    out[stream.type] = { type: stream.type, name: stream.type, url: stream.url, original_url: '' }
  }
  return out
})
const onSelectStream = (key: string) => selectStream(key as Yanhe2StreamChoice)

// The player moved on from a stream it could not play: say which and why.
const fallbackMessage = computed(() => {
  const notice = fallbackNotice.value
  if (!notice) return ''
  return t(streamFallbackMessageKey(notice.reason), { from: streamLabel(notice.from), to: streamLabel(notice.to) })
})

const problemMessage = computed(() => {
  switch (problem.value) {
    case 'signed_out': return t('yanhe2Playback.errorSignedOut')
    case 'network': return t('yanhe2Calendar.errorNetwork')
    case 'player': return t('yanhe2Playback.errorPlayer')
    case 'missing': return t('yanhe2Playback.errorMissing')
    case 'not_playable':
      if (sessionStatus.value === 'upcoming') return t('yanhe2Playback.notStarted')
      if (sessionStatus.value === 'processing') return t('yanhe2Playback.processing')
      return t('yanhe2Playback.noRecording')
    default: return t('yanhe2Playback.errorFailed')
  }
})

// Server slides. Shown as they come: Yanhe 2.0 neither filters nor
// deduplicates them, and their times are on the screen recording's clock.
const { slides: serverSlides, state: slidesState, load: loadSlides } = useYanhe2Slides({
  account: props.account,
  courseId: props.session.courseId,
  subId: props.session.subId,
  playback,
})
const gallerySlides = computed<GallerySlide[]>(() =>
  serverSlides.value.map((slide, index) => ({
    id: String(index),
    title: t('yanhe2Playback.slideTitle', { n: index + 1 }),
    timestamp: String(slide.seconds),
    dataUrl: slide.src,
  })),
)
// By id, not by object: the list is rebuilt as each image arrives, and an open
// preview must survive that. A reload empties the list, which closes it.
const previewedId = ref<string | null>(null)
const previewedSlide = computed(() => gallerySlides.value.find((slide) => slide.id === previewedId.value) ?? null)
const openSlidePreview = (slide: GallerySlide) => {
  if (slide.dataUrl) previewedId.value = slide.id
}
// Saving is the task queue's: the page only starts it. A refusal is a message box, the rest is the task row.
const savingSlides = computed(() => isSavingYanhe2Slides(props.session.subId))
const saveSlides = () =>
  void saveYanhe2Slides({ account: props.account, courseId: props.session.courseId, subId: props.session.subId })

// Where the server-slides view says what it has instead of a gallery.
const slidesNote = computed(() => {
  if (slidesState.value === 'loading') return t('yanhe2Playback.slidesLoading')
  if (slidesState.value === 'failed') return t('yanhe2Playback.slidesFailed')
  return serverSlides.value.length > 0 ? '' : t('yanhe2Playback.slidesEmpty')
})

// The transcript as a subtitle file, through the download list, with the
// delay the captions use. Offered where captions are; a lecture not measured
// yet is measured first, and one that gives no answer gets a message box.
const preparingSubtitles = computed(() => isPreparingYanhe2Subtitles(props.session.subId))
const downloadSubtitles = () => {
  void downloadYanhe2Subtitles({ account: props.account, courseId: props.session.courseId, subId: props.session.subId })
}

// Downloading what is on screen, like the Recorded player: the stream shown,
// or camera + screen under Both Streams. The room camera is not offered.
const isRecording = computed(() => !problem.value && playback.value?.mode === 'recorded')
const downloadKinds = computed<Yanhe2DownloadKind[]>(() => {
  if (isDualSelected.value) return ['camera', 'screen']
  const type = currentStream.value?.type
  return type === 'camera' || type === 'screen' ? [type] : []
})
const downloadTitle = computed(() => {
  if (isDualSelected.value) return t('playback.downloadBoth')
  const type = currentStream.value?.type
  if (type === 'screen') return t('sessions.downloadScreen')
  if (type === 'camera') return t('sessions.downloadCamera')
  return t('yanhe2Playback.downloadRoomUnavailable')
})
const preparingDownload = computed(() => isPreparingYanhe2Download(props.session.subId))
const downloadCurrent = () => {
  void downloadYanhe2Recording(
    { account: props.account, courseId: props.session.courseId, subId: props.session.subId },
    [...downloadKinds.value],
  )
}

// Slide extraction from the screen stream, as in the Yanhekt player. The
// folder and metadata are the same lecture's on Yanhekt (main finds it when
// extraction starts); a lecture it cannot look up does not start, and the
// switch goes back off with a message box (a task's row says it instead).
let extractionRefusal: string | null = null
const notify = (message: string) => void window.electronAPI.dialog?.showMessageBox?.({ type: 'info', message })
const resolveLecture = async (): Promise<ExtractionLecture | null> => {
  extractionRefusal = null
  try {
    // Plain strings only: nothing reactive crosses the bridge.
    const prepared = await window.electronAPI.yanhe2.prepareExtraction(props.account, {
      courseId: props.session.courseId,
      subId: props.session.subId,
    })
    if (prepared.kind === 'ok') return { ...prepared.target, source: prepared.source }
    extractionRefusal = t(`yanhe2Playback.extractionRefused.${prepared.kind}`)
  } catch (error) {
    log.error('Yanhe 2.0 extraction could not be prepared:', error)
    extractionRefusal = t('yanhe2Playback.extractionRefused.failed')
  }
  if (!taskDriver.isTaskMode.value) notify(extractionRefusal)
  return null
}

const slideExtraction = useSlideExtraction({
  mode: 'recorded',
  course: ref<Course | null>(null),
  session: ref<Session | null>(null),
  currentPlaybackRate: playbackRate,
  // Read at each start; the driver is created below.
  isTaskExtraction: () => taskDriver.isTaskMode.value,
  resolveLecture,
})
// This tab's own element, never a querySelector that could find another tab's.
slideExtraction.videoElementProvider.value = () => videoPlayer.value
const { isSlideExtractionEnabled, extractedSlides, toggleSlideExtraction } = slideExtraction

const slideGallery = useSlideGallery({
  extractedSlides,
  slideExtractorInstance: slideExtraction.slideExtractorInstance,
  t,
})
const { selectedSlide, openSlideModal, closeSlideModal, deleteSlide, clearAllSlides, formatSlideTime } = slideGallery

const postProcessing = usePostProcessing({
  extractedSlides,
  slideExtractorInstance: slideExtraction.slideExtractorInstance,
  deleteSlide,
  getExtractorInstanceId: () => slideExtraction.extractorInstanceId.value,
})
const { isPostProcessing, postProcessStatus, executePostProcessing } = postProcessing

/** Extraction reads the single screen stream, as in the Yanhekt player. */
const canExtract = computed(() => !isDualSelected.value && currentStream.value?.type === 'screen')

const startExtraction = async (): Promise<string | null> => {
  if (!isSlideExtractionEnabled.value) {
    isSlideExtractionEnabled.value = true
    await toggleSlideExtraction()
  }
  if (isSlideExtractionEnabled.value && slideExtraction.slideExtractorInstance.value) return null
  return extractionRefusal ?? 'Failed to start slide extraction'
}
const stopExtraction = () => {
  if (!isSlideExtractionEnabled.value) return
  isSlideExtractionEnabled.value = false
  void toggleSlideExtraction()
}

// Another stream on screen (or a reload) ends the extraction.
watch(canExtract, (ok) => {
  if (!ok) stopExtraction()
})
watch(playbackRate, (rate) => {
  if (isSlideExtractionEnabled.value) slideExtraction.slideExtractorInstance.value?.setPlaybackRate(Number(rate))
})

// Each slide joins the gallery; while watching, each one also gets a
// post-processing pass, as in the Yanhekt player (a task's run once at the end).
const isOurs = (event: Event) => {
  const detail = (event as CustomEvent).detail
  return detail?.instanceId === slideExtraction.extractorInstanceId.value && detail?.mode === 'recorded'
}
const onSlideExtracted = async (event: Event) => {
  if (!isOurs(event)) return
  extractedSlides.value.push((event as CustomEvent).detail.slide)
  slideExtraction.updateSlideExtractionStatus()
  if (!taskDriver.isTaskMode.value && configStore.autoPostProcessingLive !== false) {
    await executePostProcessing(false)
  }
}
const onSlidesCleared = (event: Event) => {
  if (!isOurs(event)) return
  extractedSlides.value = []
  selectedSlide.value = null
  slideExtraction.updateSlideExtractionStatus()
}

// Task mode: the queue plays the lecture here, at the task speed, from the start.
const taskDriver = useYanhe2TaskDriver({
  subId: props.session.subId,
  videoPlayer,
  loading,
  problem,
  hasScreen: computed(() => streams.value.some((stream) => stream.type === 'screen')),
  onScreen: canExtract,
  selectScreen: () => selectStream('screen'),
  setPlaybackRate,
  startExtraction,
  stopExtraction,
  outputPath: () => slideExtraction.slideExtractorInstance.value?.getOutputPath() ?? null,
  slideFiles: () => extractedSlides.value.map((slide) => `${slide.title}.png`),
})
const { isTaskRunning } = taskDriver

// The section's view: picked by hand, or Server Slides when Yanhe 2.0 has
// slides (or is still being asked) and Slide Extraction when it has none. The
// transcript choice is the shared switch the captions also read.
type GalleryView = 'extraction' | 'server' | 'transcript'
const pickedView = ref<'extraction' | 'server' | null>(null)
const galleryView = computed<GalleryView>(() => {
  if (isTaskRunning.value || isSlideExtractionEnabled.value) return 'extraction'
  if (transcriptView.value && hasTranscript.value) return 'transcript'
  if (pickedView.value) return pickedView.value
  const hasServerSlides = slidesState.value === 'loading' || (slidesState.value === 'ready' && serverSlides.value.length > 0)
  return hasServerSlides ? 'server' : 'extraction'
})
const pickView = (view: GalleryView) => {
  transcriptView.value = view === 'transcript'
  if (view !== 'transcript') pickedView.value = view
}

// Playback speed (recorded only; the bars hide it for live).
const defaultPlaybackRates = [1, 1.25, 1.5, 2, 5, 10, 16]
const allPlaybackRates = [0.5, 0.75, 0.8, 0.9, 1, 1.1, 1.15, 1.2, 1.25, 1.5, 1.75, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const playbackRateOptions = computed(() => (configStore.showMorePlaybackSpeed ? allPlaybackRates : defaultPlaybackRates))

const stepPlaybackRate = (dir: 1 | -1) => {
  const options = playbackRateOptions.value
  const current = Number(playbackRate.value)
  let idx = options.indexOf(current)
  if (idx === -1) {
    idx = options.reduce(
      (best, val, i) => (Math.abs(val - current) < Math.abs(options[best] - current) ? i : best),
      0,
    )
  }
  const next = Math.min(options.length - 1, Math.max(0, idx + dir))
  if (next !== idx) setPlaybackRate(options[next])
}

// Control-bar state, mirrored off the element that owns the clock (the screen
// in Both Streams).
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const lastNonZeroVolume = ref(1)
const canSeek = computed(() => Number.isFinite(duration.value) && duration.value > 0)
const seekProgress = computed(() => {
  if (!canSeek.value) return '0%'
  return `${Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))}%`
})
// Settings → General → Audio Mode silences the player the way it does the
// Yanhekt one: every element at 0, the slider swapped for the mode's label.
const audioModeMuted = computed(() => isMutedByAudioMode(configStore.muteMode, mode.value))
const audioModeLabel = computed(() => audioModeLabelKey(configStore.muteMode))
const effectiveVolume = computed(() => (audioModeMuted.value ? 0 : volume.value))
const volumeProgress = computed(() => `${Math.min(100, Math.max(0, effectiveVolume.value * 100))}%`)

// Keeps playback (and extraction) going in the background, as the Yanhekt
// player does: keep-alive, wake lock, the power blocker. Live and recorded
// alike, so Prevent System Sleep covers both sites. `mode` only labels logs.
const perf = usePerformanceOptimization({
  mode: 'recorded',
  // Only read: whichever element owns the clock.
  videoPlayer: masterVideo as unknown as Ref<HTMLVideoElement | null>,
  hls: shallowRef(null),
  currentPlaybackRate: playbackRate,
  shouldVideoMute: audioModeMuted,
})

let detachVideoListeners: (() => void) | null = null
watch(masterVideo, (video) => {
  detachVideoListeners?.()
  detachVideoListeners = null
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  if (!video) return

  const onPlayState = () => {
    isPlaying.value = !video.paused && !video.ended
    if (isPlaying.value) {
      perf.startKeepAlive()
      void perf.requestWakeLock()
      void perf.requestPowerManagement()
      if (audioModeMuted.value) perf.startSilentAudio()
    } else {
      perf.stopKeepAlive()
      perf.releaseWakeLock()
      void perf.releasePowerManagement()
      perf.stopSilentAudio()
    }
  }
  // A stall holds the extraction's clock, as in the Yanhekt player.
  const onWaiting = () => {
    if (isSlideExtractionEnabled.value) slideExtraction.slideExtractorInstance.value?.pauseForBuffering()
  }
  const onCanPlay = () => {
    if (isSlideExtractionEnabled.value) slideExtraction.slideExtractorInstance.value?.resumeAfterBuffering()
  }
  const onTime = () => { currentTime.value = video.currentTime }
  const onDuration = () => {
    duration.value = Number.isFinite(video.duration) ? video.duration : 0
    currentTime.value = video.currentTime
  }
  const listeners: [string, () => void][] = [
    ['play', onPlayState],
    ['pause', onPlayState],
    ['ended', onPlayState],
    ['emptied', onDuration],
    ['timeupdate', onTime],
    ['loadedmetadata', onDuration],
    ['durationchange', onDuration],
    ['waiting', onWaiting],
    ['canplay', onCanPlay],
  ]
  listeners.forEach(([name, handler]) => video.addEventListener(name, handler))
  detachVideoListeners = () => listeners.forEach(([name, handler]) => video.removeEventListener(name, handler))
})

// Captions, from Yanhe 2.0's own transcript of the recording.
const {
  lines: transcriptLines,
  delay: captionDelay,
  hasTranscript,
  available: captionsAvailable,
  syncing: captionsSyncing,
  captionsOn,
  caption,
  toggle: toggleCaptions,
} = useYanhe2Captions({
  account: props.account,
  courseId: props.session.courseId,
  subId: props.session.subId,
  playback,
  currentTime,
})
// While the lecture's delay is being measured the caption line says so.
const captionText = computed(() => caption.value || (captionsSyncing.value ? t('yanhe2Playback.captionsSyncing') : ''))

// The row being spoken, on the same terms as the captions: where the
// transcript's delay is not known (`captionDelay` null) no row is marked.
const transcriptIndex = computed(() =>
  captionDelay.value === null ? -1 : transcriptIndexAt(transcriptLines.value, currentTime.value - captionDelay.value),
)

const onSeekInput = (time: number) => {
  currentTime.value = time
  seekTo(time)
}

// Audio. One element is audible at a time: the single stream, in Both Streams
// whichever of the pair is picked, or the classroom mic when the recording has
// one and it is chosen. The others play at volume 0.
const dualAudioSource = ref<'screen' | 'camera'>('screen')
const dualAudioSources = computed(() => [
  { value: 'screen', label: t('playback.dual.screenAudio') },
  { value: 'camera', label: t('playback.dual.cameraAudio') },
  ...(hasMicAudio.value ? [{ value: 'mic', label: t('playback.dual.micAudio') }] : []),
])
const applyAudio = () => {
  const mic = micAudioOn.value
  const level = effectiveVolume.value
  if (videoPlayer.value) videoPlayer.value.volume = mic ? 0 : level
  if (screenVideoPlayer.value) screenVideoPlayer.value.volume = !mic && dualAudioSource.value === 'screen' ? level : 0
  if (cameraVideoPlayer.value) cameraVideoPlayer.value.volume = !mic && dualAudioSource.value === 'camera' ? level : 0
  if (micAudioPlayer.value) micAudioPlayer.value.volume = mic ? level : 0
}
watch([videoPlayer, cameraVideoPlayer, screenVideoPlayer, micAudioPlayer, dualAudioSource, micAudioOn, audioModeMuted], applyAudio)

const applyVolume = (value: number) => {
  // The bar disables its volume controls; this keeps the keyboard out too.
  if (audioModeMuted.value) return
  const clamped = Math.min(1, Math.max(0, value))
  volume.value = clamped
  if (clamped > 0) lastNonZeroVolume.value = clamped
  applyAudio()
}

const toggleMute = () => applyVolume(volume.value > 0 ? 0 : lastNonZeroVolume.value || 1)

// Popovers: one open at a time, and any of them keeps the bar pinned.
const showSpeedPanel = ref(false)
const showMorePanel = ref(false)
const showAudioPanel = ref(false)
const openOnly = (panel: typeof showSpeedPanel) => {
  const next = !panel.value
  showSpeedPanel.value = showMorePanel.value = showAudioPanel.value = false
  panel.value = next
}
const toggleSpeedPanel = () => openOnly(showSpeedPanel)
const toggleMorePanel = () => openOnly(showMorePanel)
const toggleAudioPanel = () => openOnly(showAudioPanel)
const pickDualAudio = (value: string) => {
  setMicAudio(value === 'mic')
  if (value !== 'mic') dualAudioSource.value = value === 'camera' ? 'camera' : 'screen'
  showAudioPanel.value = false
}
const pickSingleAudio = (source: 'video' | 'mic') => {
  setMicAudio(source === 'mic')
  showAudioPanel.value = false
}

const isOrderSwapped = ref(false)
const swapOrder = () => {
  isOrderSwapped.value = !isOrderSwapped.value
  showMorePanel.value = false
}
const setRateFromPanel = (rate: number) => {
  setPlaybackRate(rate)
  showSpeedPanel.value = false
}

const { controlsVisible, pointerOverControls, showControls, onPlayerPointerLeave } = useControlsVisibility({
  isPlaying,
  persistSources: [showSpeedPanel, showMorePanel, showAudioPanel],
})

// Fullscreen: whichever frame is on screen, the single one or the pair.
const isFullscreen = ref(false)
const playerContainer = () => (isDualSelected.value ? dualContainer.value : videoContainer.value)
const toggleFullscreen = async () => {
  const container = playerContainer()
  if (!container) return
  try {
    if (document.fullscreenElement === container) await document.exitFullscreen()
    else await container.requestFullscreen()
  } catch (error) {
    log.error('Error toggling fullscreen:', error)
  }
}
const onFullscreenChange = () => {
  const container = playerContainer()
  isFullscreen.value = !!container && document.fullscreenElement === container
}

// Picture in Picture. The API is document-global, so compare against this
// tab's own element rather than "is anything in PiP".
const isPictureInPicture = ref(false)
const togglePictureInPicture = async () => {
  const video = videoPlayer.value
  if (!video) return
  try {
    if (document.pictureInPictureElement === video) await document.exitPictureInPicture()
    else await video.requestPictureInPicture()
  } catch (error) {
    log.error('Error toggling Picture in Picture:', error)
  }
}

// Cinema mode: collapse both side panels and hide the header, restoring the
// panels to what they were on the way out.
const isCinemaMode = ref(false)
let preCinemaLeftCollapsed = false
let preCinemaRightCollapsed = false
const toggleCinemaMode = () => {
  if (isCinemaMode.value) {
    layoutStore.leftCollapsed = preCinemaLeftCollapsed
    layoutStore.rightCollapsed = preCinemaRightCollapsed
    isCinemaMode.value = false
  } else {
    preCinemaLeftCollapsed = layoutStore.leftCollapsed
    preCinemaRightCollapsed = layoutStore.rightCollapsed
    layoutStore.leftCollapsed = true
    layoutStore.rightCollapsed = true
    isCinemaMode.value = true
  }
}
const toggleCinemaFromMenu = () => {
  toggleCinemaMode()
  showMorePanel.value = false
}
const togglePipFromMenu = () => {
  void togglePictureInPicture()
  showMorePanel.value = false
}

const formatPlaybackTime = (value: string | number): string => {
  const total = Math.max(0, Math.floor(typeof value === 'string' ? parseInt(value) : value))
  if (isNaN(total)) return '0:00'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Same keymap as the Yanhekt player. The listener is window-wide, so it only
// acts while this tab is the one on screen.
const videoKeyboard = useVideoKeyboard({
  mode: props.session.status === 'live' ? 'live' : 'recorded',
  seekSeconds: 5,
  volumeStep: 0.05,
  isModalOpen: () => !!previewedSlide.value || !!selectedSlide.value,
  isDisabled: () => !props.isVisible || !masterVideo.value,
  isAnyFullscreen: () => isFullscreen.value,
  seekBy: (delta) => seekTo(currentTime.value + delta),
  togglePlayback,
  stepPlaybackRate,
  toggleMute,
  toggleFullscreen: () => void toggleFullscreen(),
  adjustVolume: (delta) => applyVolume(volume.value + delta),
})

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('slideExtracted', onSlideExtracted)
  window.addEventListener('slidesCleared', onSlidesCleared)
  videoKeyboard.attach()
  taskDriver.register()
  void postProcessing.initConfig()
  void perf.initConfig().then(() => perf.setupEventListeners())
  void load()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('slideExtracted', onSlideExtracted)
  window.removeEventListener('slidesCleared', onSlidesCleared)
  videoKeyboard.detach()
  taskDriver.dispose()
  slideExtraction.cleanupSlideExtraction()
  void perf.cleanupAll()
  detachVideoListeners?.()
  if (isCinemaMode.value) toggleCinemaMode()
})
</script>

<style scoped src="../video/playbackPageChrome.css"></style>

<style scoped>
/* The download button's busy state: a hairline ring in place of the arrow. */
.download-spinner {
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: yanhe2-download-spin 0.8s linear infinite;
}

@keyframes yanhe2-download-spin {
  to { transform: rotate(360deg); }
}

/* Captions sit over the picture, and step up out of the control bar's way. */
.caption-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  z-index: var(--z-sticky);
  display: flex;
  justify-content: center;
  padding: 0 5%;
  pointer-events: none;
  transition: bottom 0.2s ease;
}

.caption-layer.above-controls {
  bottom: 68px;
}

.caption-text {
  max-width: 100%;
  padding: 4px 12px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.72);
  color: var(--text-on-fill);
  font-size: clamp(15px, 2.2cqw, 28px);
  line-height: 1.4;
  text-align: center;
}

.video-container,
.dual-playback-shell {
  container-type: inline-size;
}

/* Same band as the Yanhekt player's Slide Extraction row. */
.server-slides-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.slide-gallery:has(.gallery-grid) .server-slides-header,
.slide-gallery:has(.transcript-panel) .server-slides-header,
.slide-gallery:has(.post-process-status-bar) .server-slides-header,
.slide-gallery:has(.server-slides-note) .server-slides-header {
  border-bottom: 1px solid var(--border-color);
}

.server-slides-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

/* The switch and the counter keep their one line; the actions wrap below instead. */
.server-slides-main > * {
  flex-shrink: 0;
  white-space: nowrap;
}

/* The view's own actions, then the view switch at the far right. */
.server-slides-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}


/* The Search page's segmented control: a grouped track, the view on show a
   raised pill. Its height is not that page's fixed control height: it
   stretches to the row, so it is exactly as tall as the buttons beside it. */
.mode-switch {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: var(--control-height);
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-pill:hover:not(:disabled) {
  color: var(--text-primary);
}

.mode-pill:disabled:not(.active) {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-pill:disabled.active {
  cursor: default;
}

.mode-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

/* No server slides to show: said in the gallery's place. */
.server-slides-note {
  margin: 0;
  padding: 24px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
