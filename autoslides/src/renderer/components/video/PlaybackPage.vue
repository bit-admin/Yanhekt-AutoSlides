<template>
  <div class="playback-page" :class="{ 'cinema-mode': isCinemaMode }">
    <div class="header">
      <div class="header-main">
        <button @click="goBack" class="btn btn--ghost back-btn" :disabled="shouldDisableControls">
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
        <button
          v-if="props.mode === 'live'"
          @click="copyStreamUrl"
          class="btn copy-url-btn"
          :disabled="!canCopyStreamUrl"
          :title="isDualStreamSelected ? $t('playback.selectOneStreamToCopy') : streamUrlCopied ? $t('playback.urlCopied') : $t('playback.copyStreamUrl')"
        >
          <svg v-if="streamUrlCopied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button
          v-if="props.mode === 'recorded'"
          @click="downloadCurrentStream"
          class="btn download-btn"
          :disabled="shouldDisableControls"
          :title="isDualStreamSelected ? $t('playback.downloadBoth') : isScreenRecordingSelected ? $t('sessions.downloadScreen') : $t('sessions.downloadCamera')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button @click="refreshPage" class="btn refresh-btn" :disabled="shouldDisableControls" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button @click="toggleCourseDetails" class="btn expand-btn">
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
        <div class="course-detail-item" v-if="currentStreamData || isDualStreamSelected">
          <span class="detail-label">{{ $t('playback.currentStream') }}</span>
          <span v-if="isDualStreamSelected" class="detail-value">{{ $t('playback.bothStreams') }}</span>
          <span v-else-if="currentStreamData" class="detail-value">
            {{ currentStreamData.type === 'camera' ? $t('playback.streamCamera') : currentStreamData.type === 'screen' ? $t('playback.streamScreen') : currentStreamData.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="content custom-scrollbar">
      <div v-if="loading" class="loading-state">
        <div class="spinner spinner--lg"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
      </div>

      <div v-else-if="error" class="loading-state error-state">
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
        <button @click="retryLoad" class="btn btn--primary btn--lg">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playbackData" class="video-content" :data-playback-mode="props.mode" :data-extractor-instance="slideExtraction.extractorInstanceId.value">

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
            <div v-if="aiFilteringError.type === '429'" class="warning-message ai-error">
              {{ $t('playback.aiError429') }}
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

        <div class="player-panel">
        <DualStreamControls
          v-model:selected-stream="selectedStream"
          v-model:current-playback-rate="currentPlaybackRate"
          :streams="playbackData.streams"
          :playback-rate-options="playbackRateOptions"
          :mode="props.mode"
          :is-dual-stream-selected="isDualStreamSelected"
          :is-picture-in-picture="isPictureInPicture"
          :is-cinema-mode="isCinemaMode"
          :should-disable-controls="shouldDisableControls"
          :video-player-ready="!!videoPlayer"
          :has-dual-streams="hasDualStreams"
          :dual-stream-key="DUAL_STREAM_KEY"
          @switch-stream="switchStream"
          @change-playback-rate="changePlaybackRate"
          @toggle-picture-in-picture="togglePictureInPicture"
          @toggle-cinema-mode="toggleCinemaMode"
        />

        <!-- Video Player -->
        <div
          v-if="!isDualStreamSelected"
          ref="singleVideoContainer"
          class="video-container"
          :class="{ 'collapsed': isVideoContainerCollapsed, 'is-fullscreen': isSingleFullscreen, 'controls-hidden': !controlsVisible }"
          :data-pip-message="$t('playback.videoPlayingInPiP')"
          @mousemove="showControls"
          @mouseleave="onPlayerPointerLeave"
        >
          <video
            ref="videoPlayer"
            class="video-player"
            preload="metadata"
            :poster="overrides.playbackDemo?.poster(isScreenRecordingSelected ? 'screen' : 'camera')"
            @error="onVideoError"
            @canplay="onCanPlay"
            @ended="onEnded"
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

          <!-- Custom single-stream control bar (replaces native <video controls>) -->
          <div
            v-if="!isVideoContainerCollapsed"
            class="dual-controls-section single-controls-section"
            :class="{ 'controls-hidden': !controlsVisible }"
            @mouseenter="pointerOverControls = true"
            @mouseleave="pointerOverControls = false"
          >
            <div class="dual-controls-main-row">
              <div class="dual-controls-left">
                <button
                  class="dual-icon-button"
                  @click="toggleSinglePlayback"
                  :disabled="shouldDisableControls"
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

                <span class="dual-time">{{ formatPlaybackTime(singleCurrentTime) }} / {{ singleCanSeek ? formatPlaybackTime(singleDuration) : $t('playback.dual.live') }}</span>
              </div>

              <div class="dual-controls-right">
                <div class="single-volume">
                  <button
                    class="dual-icon-button"
                    @click="toggleSingleMute"
                    :disabled="shouldDisableControls || shouldVideoMute"
                    :title="singleIsMuted ? $t('playback.unmute') : $t('playback.mute')"
                  >
                    <svg v-if="!singleIsMuted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
                    :value="singleEffectiveVolume"
                    :style="{ '--dual-progress': singleVolumeProgress }"
                    :disabled="shouldDisableControls || shouldVideoMute"
                    :aria-label="$t('playback.volume')"
                    @input="onSingleVolumeInput"
                  />
                </div>

                <div v-if="props.mode === 'recorded'" class="dual-popover-anchor">
                  <button
                    class="dual-speed-button"
                    @click="toggleSpeedPanel"
                    :disabled="shouldDisableControls"
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
                  @click="toggleSingleFullscreen"
                  :disabled="shouldDisableControls"
                  :title="isSingleFullscreen ? $t('playback.dual.exitFullscreen') : $t('playback.dual.fullscreen')"
                >
                  <svg v-if="!isSingleFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
                    :disabled="shouldDisableControls"
                    :title="$t('playback.dual.moreOptions')"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="12" cy="5" r="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                  <div v-if="showDualMorePanel" class="dual-popover dual-more-popover">
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
                    <button
                      class="dual-popover-option"
                      :class="{ active: isPictureInPicture }"
                      :disabled="!videoPlayer"
                      @click="togglePipFromMenu"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <rect x="14" y="12" width="6" height="4" rx="1" fill="currentColor"/>
                      </svg>
                      <span>{{ isPictureInPicture ? $t('playback.exitPictureInPicture') : $t('playback.enterPictureInPicture') }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <input
              class="dual-seek"
              type="range"
              min="0"
              :max="singleDuration || 0"
              step="0.1"
              :value="singleCurrentTime"
              :style="{ '--dual-progress': singleSeekProgress }"
              :disabled="shouldDisableControls || !singleCanSeek"
              @input="onSingleSeekInput"
            />
          </div>
        </div>

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
                  :poster="overrides.playbackDemo?.poster('camera')"
                  @timeupdate="onDualTimeUpdate"
                  @play="handleDualPlayStateChanged"
                  @pause="handleDualPlayStateChanged"
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
                  :poster="overrides.playbackDemo?.poster('screen')"
                  @timeupdate="onDualTimeUpdate"
                  @play="handleDualPlayStateChanged"
                  @pause="handleDualPlayStateChanged"
                  @ended="onDualEnded"
                  @volumechange="preventDualUnmute"
                >
                  {{ $t('playback.browserNotSupported') }}
                </video>
              </div>
            </div>

            <div v-if="shouldVideoMute" class="mute-indicator">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
              <span>{{ $t(globalMuteModeLabelKey) }}</span>
            </div>

            <div v-if="isRetrying" class="retry-indicator">
              <div class="retry-spinner"></div>
              <span>{{ retryMessage }}</span>
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
                  @click="toggleDualPlaybackControl"
                  :disabled="shouldDisableControls"
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
                    :disabled="shouldDisableControls || shouldVideoMute"
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
                    :disabled="shouldDisableControls || shouldVideoMute"
                    :aria-label="$t('playback.volume')"
                    @input="onDualVolumeInput"
                  />
                </div>

                <div class="dual-popover-anchor">
                  <button
                    class="dual-icon-button"
                    @click="toggleDualAudioPanel"
                    :disabled="shouldDisableControls || shouldVideoMute"
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
                        <path v-if="dualAudioSource !== 'screen'" d="M8 19h8"/>
                        <path v-if="dualAudioSource !== 'screen'" d="M12 15v4"/>
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
                        <rect v-if="dualAudioSource !== 'camera'" x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                      <span>{{ $t('playback.dual.cameraAudio') }}</span>
                    </button>
                  </div>
                </div>

                <div v-if="props.mode === 'recorded'" class="dual-popover-anchor">
                  <button
                    class="dual-speed-button"
                    @click="toggleSpeedPanel"
                    :disabled="shouldDisableControls"
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
                  :disabled="shouldDisableControls"
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
                    :disabled="shouldDisableControls"
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
              :disabled="shouldDisableControls || !dualCanSeek"
              @input="onDualSeekInput"
            />

          </div>
        </div>

        <!-- Slide Gallery -->
        <div v-if="isScreenRecordingSelected && !isDualStreamSelected" class="slide-gallery">
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
                  class="btn btn--primary"
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
                  class="btn btn--danger"
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

          <!-- Post-processing Status Bar (only visible for manual post-processing or live mode) -->
          <!-- In recorded task mode, post-processing progress is shown in RightPanel.vue -->
          <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0 && (mode === 'live' || !isTaskRunning)" class="post-process-status-bar">
            <div class="status-bar-content">
              <PostProcessingProgressBar :state="fromPlaybackStatus(postProcessStatus)" labels="long" />
            </div>
          </div>

          <!-- Gallery Grid (only show when slides exist) -->
          <SlideGallery
            v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
            :slides="extractedSlides"
            :format-slide-time="formatSlideTime"
            @preview="openSlideModal"
            @delete="deleteSlide"
          />
        </div>
        </div>

      </div>

      <div v-else class="loading-state no-streams">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
        <p>{{ $t('playback.noVideoStreams') }}</p>
      </div>
    </div>

    <PreviewModal
      :slide="selectedSlide"
      :format-slide-time="formatSlideTime"
      @close="closeSlideModal"
      @delete="deleteSlide"
    />
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('PlaybackPage');
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRef } from 'vue'
import { configStore } from '@shared/services/configStore'
import { layoutStore } from '@shared/services/layoutStore'
import { DUAL_STREAM_KEY, useVideoPlayer, type DualAudioSource } from '@features/video/useVideoPlayer'
import { useSlideExtraction, type Course, type Session } from '@features/video/useSlideExtraction'
import { usePlaybackStreamUrl } from '@features/video/usePlaybackStreamUrl'
import { usePostProcessing } from '@features/download/usePostProcessing'
import { useTaskQueue } from '@features/download/useTaskQueue'
import { usePlaybackDownload } from '@features/download/usePlaybackDownload'
import { usePerformanceOptimization } from '@features/video/usePerformanceOptimization'
import { useSlideGallery } from '@features/video/useSlideGallery'
import PostProcessingProgressBar from './PostProcessingProgressBar.vue'
import SlideGallery from './SlideGallery.vue'
import PreviewModal from './PreviewModal.vue'
import DualStreamControls from './DualStreamControls.vue'
import { fromPlaybackStatus } from '@shared/postProcessing/displayAdapter'
import { overrides } from '@shared/overrideRegistry'

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
// Cinema mode: collapse both side panels and hide the page chrome (header,
// warnings, slide gallery) so only the player fills the main content. The
// panels' pre-cinema collapse state is captured so exiting restores it exactly.
const isCinemaMode = ref(false)
let preCinemaLeftCollapsed = false
let preCinemaRightCollapsed = false
const isVideoContainerCollapsed = ref(false)
const showMorePlaybackSpeed = ref(false)
const dualVideoContainer = ref<HTMLElement | null>(null)
const isDualOrderSwapped = ref(false)
const isDualFullscreen = ref(false)
// Single-stream custom control bar state (native <video controls> removed)
const singleVideoContainer = ref<HTMLElement | null>(null)
const isSingleFullscreen = ref(false)
const singleCurrentTime = ref(0)
const singleDuration = ref(0)
const singleVolume = ref(1)
const lastNonZeroVolume = ref(1)
// Playback-speed drop-up panel shared by the single and dual control bars
// (only one bar is mounted at a time, so a single flag is sufficient).
const showSpeedPanel = ref(false)
const showDualAudioPanel = ref(false)
const showDualMorePanel = ref(false)

const defaultPlaybackRates = [1, 1.25, 1.5, 2, 5, 10, 16]
const allPlaybackRates = [0.5, 0.75, 0.8, 0.9, 1, 1.1, 1.15, 1.2, 1.25, 1.5, 1.75, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

const SEEK_SECONDS = 5

const playbackRateOptions = computed(() => {
  return showMorePlaybackSpeed.value ? allPlaybackRates : defaultPlaybackRates
})

// Convert props to refs for composables
const courseRef = toRef(props, 'course')
const sessionRef = computed(() => props.session ?? null)

// Create shared playback rate ref that will be updated by video player
// and used by slide extraction for interval calculation
const sharedPlaybackRate = ref(1)

// Initialize slide extraction composable first (needed by other composables)
const slideExtraction = useSlideExtraction({
  mode: props.mode,
  course: courseRef,
  session: sessionRef,
  currentPlaybackRate: sharedPlaybackRate
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
  session: sessionRef,
  slideExtractorInstance: slideExtraction.slideExtractorInstance
})

// Sync sharedPlaybackRate with video player's currentPlaybackRate
// This ensures slide extraction uses the correct interval when started
watch(videoPlayerComposable.currentPlaybackRate, (newRate) => {
  sharedPlaybackRate.value = newRate
}, { immediate: true })

// Give the slide-extraction pipeline a direct handle to THIS page's <video>
// element (attached here, after useVideoPlayer is created, because
// useVideoPlayer depends on slideExtraction.slideExtractorInstance and so must
// be constructed second). The closure reads the live ref each capture tick so
// the pipeline never falls back to a global-DOM querySelector that could match
// another playback tab's <video>.
slideExtraction.videoElementProvider.value = () => videoPlayerComposable.videoPlayer.value

// Expose videoPlayer ref for template binding
const videoPlayer = videoPlayerComposable.videoPlayer
const cameraVideoPlayer = videoPlayerComposable.cameraVideoPlayer
const screenVideoPlayer = videoPlayerComposable.screenVideoPlayer

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
  resetErrorCounters: videoPlayerComposable.resetErrorCounters
})

// Initialize live stream URL copy composable
const { canCopyStreamUrl, streamUrlCopied, copyStreamUrl } = usePlaybackStreamUrl({
  mode: props.mode,
  currentStreamData: videoPlayerComposable.currentStreamData,
  isDualStreamSelected: videoPlayerComposable.isDualStreamSelected
})

// Initialize playback download composable (download current/both streams)
const { downloadCurrentStream } = usePlaybackDownload({
  mode: props.mode,
  course: courseRef,
  session: sessionRef,
  sessionId: props.sessionId,
  isDualStreamSelected: videoPlayerComposable.isDualStreamSelected,
  isScreenRecordingSelected: videoPlayerComposable.isScreenRecordingSelected
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
const {
  loading,
  error,
  playbackData,
  selectedStream,
  isPlaying,
  currentPlaybackRate,
  muteMode,
  isRetrying,
  retryMessage,
  shouldVideoMute,
  isScreenRecordingSelected,
  isDualStreamSelected,
  hasDualStreams,
  currentStreamData,
  dualAudioSource,
  dualVolume,
  dualCurrentTime,
  dualDuration,
  dualCanSeek,
  showSpeedWarning
} = videoPlayerComposable
const { isSlideExtractionEnabled, extractedSlides } = slideExtraction
const { isPostProcessing, postProcessStatus, aiFilteringError } = postProcessing
const { isTaskRunning, shouldDisableControls } = taskQueue
const { selectedSlide } = slideGallery

const cameraPanelOrder = computed(() => isDualOrderSwapped.value ? 2 : 1)
const screenPanelOrder = computed(() => isDualOrderSwapped.value ? 1 : 2)
const globalMuteModeLabelKey = computed(() => {
  if (muteMode.value === 'mute_live') return 'playback.liveMuted'
  if (muteMode.value === 'mute_recorded') return 'playback.recordedMuted'
  return 'playback.mutedByApp'
})
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
// Effective volume shown by the slider: forced to 0 while the app mute policy
// is active (volume is policy-locked), otherwise the user-set level.
const singleEffectiveVolume = computed(() => (shouldVideoMute.value ? 0 : singleVolume.value))
const singleVolumeProgress = computed(() => `${Math.min(100, Math.max(0, singleEffectiveVolume.value * 100))}%`)
const singleIsMuted = computed(() => singleEffectiveVolume.value <= 0)
// Dual-stream volume mirrors the single-stream control (speaker button + slider).
const dualEffectiveVolume = computed(() => (shouldVideoMute.value ? 0 : dualVolume.value))
const dualVolumeProgress = computed(() => `${Math.min(100, Math.max(0, dualEffectiveVolume.value * 100))}%`)
const dualIsMuted = computed(() => dualEffectiveVolume.value <= 0)

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
    // Compare against THIS tab's video, not just any PiP element. The PiP API
    // is document-global (only one PiP window exists at a time), so with
    // multiple playback tabs a bare `document.pictureInPictureElement` check
    // would exit another tab's PiP instead of opening this one's. Requesting
    // PiP here while another tab holds it hands the single PiP window over to
    // this video — Chromium fires `leavepictureinpicture` on the old one, which
    // resets that tab's state via its own onLeavePictureInPicture.
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
    } else {
      await video.requestPictureInPicture()
    }
  } catch (error) {
    log.error('Error toggling Picture in Picture:', error)
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

// Cinema mode toggle
const toggleCinemaMode = () => {
  if (isCinemaMode.value) {
    // Exit: restore the panels to whatever they were before cinema.
    layoutStore.leftCollapsed = preCinemaLeftCollapsed
    layoutStore.rightCollapsed = preCinemaRightCollapsed
    isCinemaMode.value = false
  } else {
    // Enter: remember the current collapse state, then collapse both panels.
    preCinemaLeftCollapsed = layoutStore.leftCollapsed
    preCinemaRightCollapsed = layoutStore.rightCollapsed
    layoutStore.leftCollapsed = true
    layoutStore.rightCollapsed = true
    isCinemaMode.value = true
  }
}

// Delegate methods to composables
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
  preventDualUnmute
} = videoPlayerComposable
const { toggleSlideExtraction } = slideExtraction
const { executePostProcessing, dismissAIError } = postProcessing
const { openSlideModal, closeSlideModal, deleteSlide, clearAllSlides, formatSlideTime } = slideGallery

const toggleDualPlaybackControl = async () => {
  await toggleDualPlayback()
  if (isPlaying.value) {
    performanceOptimization.requestWakeLock()
    performanceOptimization.requestPowerManagement()
    if (shouldVideoMute.value) {
      performanceOptimization.startSilentAudio()
    }
  } else {
    performanceOptimization.releaseWakeLock()
    performanceOptimization.releasePowerManagement()
    performanceOptimization.stopSilentAudio()
  }
}

const handleDualPlayStateChanged = () => {
  const wasPlaying = isPlaying.value
  onDualPlayStateChanged()

  if (!wasPlaying && isPlaying.value) {
    performanceOptimization.requestWakeLock()
    performanceOptimization.requestPowerManagement()
    if (shouldVideoMute.value) {
      performanceOptimization.startSilentAudio()
    }
  } else if (wasPlaying && !isPlaying.value) {
    performanceOptimization.releaseWakeLock()
    performanceOptimization.releasePowerManagement()
    performanceOptimization.stopSilentAudio()
  }
}

const onDualSeekInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  seekDualStreams(Number(target.value))
}

// Step the playback rate to the next/previous entry of the visible options,
// then apply it through the same path the rate selector uses.
const stepPlaybackRate = (dir: 1 | -1) => {
  const options = playbackRateOptions.value
  if (!options.length) return
  const current = Number(currentPlaybackRate.value)
  let idx = options.indexOf(current)
  if (idx === -1) {
    idx = options.reduce(
      (best, val, i) => (Math.abs(val - current) < Math.abs(options[best] - current) ? i : best),
      0
    )
  }
  const nextIdx = Math.min(options.length - 1, Math.max(0, idx + dir))
  if (nextIdx === idx) return
  currentPlaybackRate.value = options[nextIdx]
  changePlaybackRate()
}

const seekActive = (delta: number) => {
  if (isDualStreamSelected.value) {
    if (!dualCanSeek.value) return
    seekDualStreams(dualCurrentTime.value + delta)
  } else {
    seekSingle(singleCurrentTime.value + delta)
  }
}

const togglePlaybackActive = () => {
  if (isDualStreamSelected.value) {
    void toggleDualPlaybackControl()
  } else {
    toggleSinglePlayback()
  }
}

const VOLUME_STEP = 0.05

const toggleMuteActive = () => {
  if (shouldVideoMute.value) return
  if (isDualStreamSelected.value) {
    toggleDualMute()
  } else {
    toggleSingleMute()
  }
}

const toggleFullscreenActive = () => {
  if (isDualStreamSelected.value) {
    void toggleDualFullscreen()
  } else {
    void toggleSingleFullscreen()
  }
}

const adjustVolumeActive = (delta: number) => {
  if (shouldVideoMute.value) return
  if (isDualStreamSelected.value) {
    const next = Math.min(1, Math.max(0, dualVolume.value + delta))
    if (next > 0) lastNonZeroDualVolume.value = next
    setDualVolume(next)
  } else {
    applySingleVolume(singleVolume.value + delta)
  }
}

// Capture-phase keymap for the player. Attached in capture phase so it owns
// these keys regardless of focus; the single-stream native controls are gone,
// so there is no longer a double-seek. Seek / play-pause / speed are
// recorded-only (live can't seek and has no speed control); mute, fullscreen,
// and volume work in both live and recorded modes.
const handleVideoKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return

  const target = event.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }

  if (selectedSlide.value) return
  if (shouldDisableControls.value) return

  const recordedOnly = props.mode === 'recorded'

  switch (event.key) {
    case 'ArrowLeft':
      if (!recordedOnly || event.shiftKey) return
      event.preventDefault()
      seekActive(-SEEK_SECONDS)
      break
    case 'ArrowRight':
      if (!recordedOnly || event.shiftKey) return
      event.preventDefault()
      seekActive(SEEK_SECONDS)
      break
    case ' ':
    case 'k':
    case 'K':
      if (!recordedOnly) return
      event.preventDefault()
      togglePlaybackActive()
      break
    case '.':
    case '>':
      if (!recordedOnly) return
      event.preventDefault()
      stepPlaybackRate(1)
      break
    case ',':
    case '<':
      if (!recordedOnly) return
      event.preventDefault()
      stepPlaybackRate(-1)
      break
    case 'm':
    case 'M':
      event.preventDefault()
      toggleMuteActive()
      break
    case 'f':
    case 'F':
      event.preventDefault()
      toggleFullscreenActive()
      break
    case 'Escape':
      if (isSingleFullscreen.value || isDualFullscreen.value) {
        event.preventDefault()
        void document.exitFullscreen()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      adjustVolumeActive(VOLUME_STEP)
      break
    case 'ArrowDown':
      event.preventDefault()
      adjustVolumeActive(-VOLUME_STEP)
      break
    default:
      break
  }
}

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
  if (shouldVideoMute.value) return
  if (dualVolume.value > 0) {
    setDualVolume(0)
  } else {
    setDualVolume(lastNonZeroDualVolume.value || 1)
  }
}

const toggleDualStreamOrder = () => {
  isDualOrderSwapped.value = !isDualOrderSwapped.value
  showDualMorePanel.value = false
}

// More-menu actions (shared three-dots menu in both bars).
const toggleCinemaFromMenu = () => {
  toggleCinemaMode()
  showDualMorePanel.value = false
}

const togglePipFromMenu = () => {
  void togglePictureInPicture()
  showDualMorePanel.value = false
}

const toggleDualAudioPanel = () => {
  if (shouldVideoMute.value) return
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
  } catch (error) {
    log.error('Error toggling dual fullscreen:', error)
  }
}

// Single-stream control-bar actions (replace native <video controls>).
// Play/pause side-effects (wake lock, power, silent audio, isPlaying) are
// handled by the play/pause listeners attached in the videoPlayer watcher.
const toggleSinglePlayback = () => {
  const video = videoPlayer.value
  if (!video) return
  if (video.paused) {
    video.play().catch(() => { /* Ignore play rejection (autoplay/buffer) */ })
  } else {
    video.pause()
  }
}

const seekSingle = (time: number) => {
  const video = videoPlayer.value
  if (!video || !Number.isFinite(video.duration)) return
  video.currentTime = Math.min(Math.max(time, 0), video.duration)
}

const onSingleSeekInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const next = Number(target.value)
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
  } catch (error) {
    log.error('Error toggling single fullscreen:', error)
  }
}

// Volume control for the single-stream bar. No-op while the app mute policy is
// active (the control is disabled in that state). Uses volume (not muted) to
// match the rest of the player's policy-based muting.
const applySingleVolume = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value))
  singleVolume.value = clamped
  if (clamped > 0) lastNonZeroVolume.value = clamped
  const video = videoPlayer.value
  if (video && !shouldVideoMute.value) {
    video.volume = clamped
  }
}

const onSingleVolumeInput = (event: Event) => {
  applySingleVolume(Number((event.target as HTMLInputElement).value))
}

const toggleSingleMute = () => {
  if (shouldVideoMute.value) return
  if (singleVolume.value > 0) {
    applySingleVolume(0)
  } else {
    applySingleVolume(lastNonZeroVolume.value || 1)
  }
}

// Playback-speed drop-up (shared by both bars). Mirrors the dual popover toggles.
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
}

// Auto-hide the control overlay (single + dual). Visible on pointer movement,
// hidden after a short idle while playing. Stays up when paused, while the
// pointer is over the controls, or while a popover is open.
const CONTROLS_IDLE_MS = 2500
const controlsVisible = ref(true)
const pointerOverControls = ref(false)
let controlsHideTimer: ReturnType<typeof setTimeout> | null = null

const controlsShouldPersist = () =>
  !isPlaying.value ||
  pointerOverControls.value ||
  showSpeedPanel.value ||
  showDualAudioPanel.value ||
  showDualMorePanel.value

const clearControlsTimer = () => {
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer)
    controlsHideTimer = null
  }
}

const scheduleControlsHide = () => {
  clearControlsTimer()
  if (controlsShouldPersist()) return
  controlsHideTimer = setTimeout(() => {
    controlsVisible.value = false
  }, CONTROLS_IDLE_MS)
}

const showControls = () => {
  controlsVisible.value = true
  scheduleControlsHide()
}

const onPlayerPointerLeave = () => {
  if (controlsShouldPersist()) return
  clearControlsTimer()
  controlsVisible.value = false
}

watch([isPlaying, pointerOverControls, showSpeedPanel, showDualAudioPanel, showDualMorePanel], () => {
  if (controlsShouldPersist()) {
    clearControlsTimer()
    controlsVisible.value = true
  } else {
    scheduleControlsHide()
  }
})

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

// Track last playback position for error display
const lastPlaybackPosition = computed(() => videoPlayerComposable.lastPlaybackPosition)

const ensureCurrentPlaybackRateVisible = () => {
  const currentRate = Number(currentPlaybackRate.value)
  if (!playbackRateOptions.value.includes(currentRate)) {
    currentPlaybackRate.value = 1
    changePlaybackRate()
  }
}

const loadShowMorePlaybackSpeedConfig = async () => {
  try {
    const config = configStore
    showMorePlaybackSpeed.value = config.showMorePlaybackSpeed ?? false
  } catch (error) {
    log.error('Failed to load show-more playback speed config:', error)
  }
}

const onShowMorePlaybackSpeedChanged = (event: Event) => {
  const customEvent = event as CustomEvent<boolean>
  showMorePlaybackSpeed.value = customEvent.detail === true
}

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
      singleCurrentTime.value = newPlayer.currentTime
      taskQueue.updateTaskProgress()
      taskQueue.checkVideoCompletion()
    }

    // Keep the custom control bar's duration in sync (native controls removed).
    const onLoadedMeta = () => {
      singleDuration.value = Number.isFinite(newPlayer.duration) ? newPlayer.duration : 0
      singleCurrentTime.value = newPlayer.currentTime
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

    // Seed control-bar state from the freshly attached element.
    singleDuration.value = Number.isFinite(newPlayer.duration) ? newPlayer.duration : 0
    singleCurrentTime.value = newPlayer.currentTime || 0
    if (!shouldVideoMute.value) {
      singleVolume.value = newPlayer.volume
      if (newPlayer.volume > 0) lastNonZeroVolume.value = newPlayer.volume
    }

    newPlayer.addEventListener('play', onPlayStart)
    newPlayer.addEventListener('pause', onPauseOrEnd)
    newPlayer.addEventListener('ended', onPauseOrEnd)
    newPlayer.addEventListener('ended', taskQueue.onVideoEnded)
    newPlayer.addEventListener('timeupdate', onTimeUpdate)
    newPlayer.addEventListener('durationchange', onLoadedMeta)
    newPlayer.addEventListener('loadedmetadata', onLoadedMeta)
    newPlayer.addEventListener('waiting', onWaiting)
    newPlayer.addEventListener('canplay', onCanPlayHandler)
    newPlayer.addEventListener('canplaythrough', onCanPlayHandler)

    currentEventListeners.push(() => {
      newPlayer.removeEventListener('play', onPlayStart)
      newPlayer.removeEventListener('pause', onPauseOrEnd)
      newPlayer.removeEventListener('ended', onPauseOrEnd)
      newPlayer.removeEventListener('ended', taskQueue.onVideoEnded)
      newPlayer.removeEventListener('timeupdate', onTimeUpdate)
      newPlayer.removeEventListener('durationchange', onLoadedMeta)
      newPlayer.removeEventListener('loadedmetadata', onLoadedMeta)
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
    if (currentStreamData.value && playbackData.value && !isDualStreamSelected.value) {
      nextTick(() => {
        videoPlayerComposable.loadVideoSource()
      })
    }
  }
})

// Watch for stream data changes
watch(() => currentStreamData.value, (newStreamData) => {
  if (newStreamData && videoPlayer.value && playbackData.value && !isDualStreamSelected.value) {
    nextTick(() => {
      videoPlayerComposable.loadVideoSource()
    })
  }
})

// Watch for mute mode changes
watch(shouldVideoMute, (shouldMute) => {
  if (shouldMute) {
    showDualAudioPanel.value = false
  }

  if (isDualStreamSelected.value) {
    applyDualAudioState()
    if (shouldMute) {
      performanceOptimization.startSilentAudio()
    } else {
      performanceOptimization.stopSilentAudio()
    }
    return
  }

  if (videoPlayer.value) {
    // When leaving policy mute, restore the user's chosen volume (not a hard 1)
    // so the custom volume control stays authoritative.
    videoPlayer.value.volume = shouldMute ? 0 : singleVolume.value
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
      slideExtraction.slideExtractorInstance.value.stop()
    }
    slideExtraction.slideExtractionStatus.value.isRunning = false
  }

  // Demo mode (override registered): entering the screen-recording view enables
  // extraction and seeds the gallery with fabricated slides (seeded once). Done
  // here rather than on mount so the isDualStreamSelected watcher doesn't disable
  // it (demo starts in dual view). No real extraction runs — the demo video never plays.
  if (isScreenRecording && overrides.playbackDemo) {
    slideExtraction.isSlideExtractionEnabled.value = true
    if (extractedSlides.value.length === 0) {
      extractedSlides.value = overrides.playbackDemo.gallerySlides() as typeof extractedSlides.value
    }
  }
})

watch(isDualStreamSelected, async (isDual) => {
  if (isDual && isSlideExtractionEnabled.value) {
    slideExtraction.isSlideExtractionEnabled.value = false
    if (slideExtraction.slideExtractorInstance.value) {
      slideExtraction.slideExtractorInstance.value.stop()
    }
    slideExtraction.slideExtractionStatus.value.isRunning = false
  }

  if (isDual) {
    await nextTick()
    applyDualAudioState()
  } else {
    showDualAudioPanel.value = false
    showDualMorePanel.value = false
    showSpeedPanel.value = false
  }
})

// Watch for slide extraction toggle
watch(isSlideExtractionEnabled, (enabled) => {
  if (enabled && videoPlayer.value && slideExtraction.slideExtractorInstance.value) {
    slideExtraction.slideExtractorInstance.value.setPlaybackRate(Number(currentPlaybackRate.value))
  }
})

watch(showMorePlaybackSpeed, () => {
  ensureCurrentPlaybackRateVisible()
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

    // Live mode auto post-processing (unchanged)
    if (props.mode === 'live' && postProcessing.autoPostProcessingLive.value && !postProcessing.isPostProcessing.value) {
      await postProcessing.executePostProcessing(false)
    }

    // Note: Recorded mode batch post-processing is now handled by PostProcessingService
    // after task completion (non-blocking, runs in parallel with next task)
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

const onFullscreenChange = () => {
  isDualFullscreen.value = document.fullscreenElement === dualVideoContainer.value
  isSingleFullscreen.value = document.fullscreenElement === singleVideoContainer.value
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
  await loadShowMorePlaybackSpeedConfig()
  ensureCurrentPlaybackRateVisible()

  // Update SSIM threshold based on classroom information
  slideExtraction.updateSSIMThresholdForClassrooms()

  // Add event listeners
  window.addEventListener('slideExtracted', onSlideExtracted as unknown as EventListener)
  window.addEventListener('slidesCleared', onSlidesCleared as EventListener)
  window.addEventListener('showMorePlaybackSpeedChanged', onShowMorePlaybackSpeedChanged as EventListener)
  window.addEventListener('keydown', handleVideoKeydown, { capture: true })
  document.addEventListener('fullscreenchange', onFullscreenChange)
  taskQueue.setupEventListeners()
  performanceOptimization.setupEventListeners()

  // Wait for next tick to ensure video element is in DOM
  await nextTick()
  videoPlayerComposable.loadVideoStreams()
})

onUnmounted(async () => {
  // Stop slide extraction if running
  if (isSlideExtractionEnabled.value && slideExtraction.slideExtractorInstance.value) {
    slideExtraction.slideExtractorInstance.value.stop()
  }

  // Cleanup slide extraction
  slideExtraction.cleanupSlideExtraction()

  // Remove event listeners
  window.removeEventListener('slideExtracted', onSlideExtracted as unknown as EventListener)
  window.removeEventListener('slidesCleared', onSlidesCleared as EventListener)
  window.removeEventListener('showMorePlaybackSpeedChanged', onShowMorePlaybackSpeedChanged as EventListener)
  window.removeEventListener('keydown', handleVideoKeydown, { capture: true })
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  clearControlsTimer()
  taskQueue.removeEventListeners()

  // Clean up performance optimization
  await performanceOptimization.cleanupAll()

  // Clean up Picture in Picture if active — only if THIS tab's video owns the
  // single PiP window (another tab may have taken it over since).
  if (document.pictureInPictureElement && document.pictureInPictureElement === videoPlayer.value) {
    try {
      await document.exitPictureInPicture()
    } catch (error) {
      log.error('Error exiting Picture in Picture on unmount:', error)
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
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Cinema mode: hide the page chrome and let the player fill the whole main
   content. Side panels are collapsed via layoutStore (see toggleCinemaMode).
   The DualStreamControls bar stays visible so the Cinema toggle remains
   reachable to exit. */
.playback-page.cinema-mode .header,
.playback-page.cinema-mode .combined-warning,
.playback-page.cinema-mode .slide-gallery {
  display: none;
}

.playback-page.cinema-mode .content {
  padding: 0;
}

.playback-page.cinema-mode .video-content {
  flex: 1;
  min-height: 0;
}

.playback-page.cinema-mode .player-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: none;
  border-radius: 0;
}

.playback-page.cinema-mode .video-container {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Letterbox the video to fit the available height instead of overflowing. */
.playback-page.cinema-mode .video-player {
  min-height: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Dual ("both streams") cinema: fill height the same way (mirrors the dual
   :fullscreen rules). The dual controls overlay the video, so nothing else
   needs hiding. */
.playback-page.cinema-mode .dual-playback-shell,
.playback-page.cinema-mode .dual-video-container {
  flex: 1;
  min-height: 0;
}

.playback-page.cinema-mode .dual-video-grid {
  height: 100%;
  min-height: 0;
}

.playback-page.cinema-mode .dual-video-player {
  min-height: 0;
}

/* Apple Music style title band: full-width tinted bar, hairline underline */
.header {
  flex-shrink: 0;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
}

.back-btn {
  flex-shrink: 0;
}

.title-info {
  flex: 1;
}

.title-info h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: var(--text-primary);
}

.title-info p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.background-mode-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 6px;
  background-color: var(--success);
  color: var(--text-on-accent);
  font-size: 12px;
  border-radius: 4px;
  width: fit-content;
}

.background-mode-indicator svg {
  animation: pulse 2s infinite;
}

/* Square 32×32 icon buttons */
.copy-url-btn,
.download-btn,
.refresh-btn,
.expand-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

.copy-url-btn:hover:not(:disabled),
.download-btn:hover:not(:disabled),
.refresh-btn:hover:not(:disabled),
.expand-btn:hover {
  border-color: var(--accent);
  background-color: var(--bg-hover);
}

.copy-url-btn:disabled,
.download-btn:disabled,
.refresh-btn:disabled {
  background-color: var(--bg-elevated);
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.course-details {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
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
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px 16px;
}

/* Loading and Error States */
.loading-state {
  height: 400px;
  color: var(--text-secondary);
}

.error-state svg {
  color: var(--danger-bright);
}

.error-details {
  text-align: center;
  max-width: 500px;
}

.error-message {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.error-info {
  margin: 12px 0;
  padding: 8px 12px;
  background-color: var(--bg-elevated);
  border-radius: 4px;
  border-left: 3px solid var(--accent);
}

.playback-position {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.error-suggestion {
  margin: 16px 0;
  padding: 12px;
  background-color: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 4px;
}

.suggestion-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-warning);
  line-height: 1.4;
}

/* Video Content */
.video-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Seamless player panel: control bar + video + slide-extraction/gallery fused
   into one bordered, rounded card; inner sections divided by hairlines. */
.player-panel {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--bg-elevated);
}

.video-container {
  position: relative;
  width: 100%;
  background-color: #000;
  overflow: hidden;
  transition: all 0.3s ease;
}

.video-container.collapsed {
  height: 60px;
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* While collapsed for PiP, keep the source <video> rendered (just shrunk to an
   invisible 1px and lifted out of layout) instead of display:none. drawImage
   reads the decoded frame buffer regardless of paint size, so slide extraction
   keeps capturing from this element while it plays in the PiP window — the same
   opacity-based technique that keeps background tabs decoding. display:none
   would risk the media pipeline being throttled. */
.video-container.collapsed .video-player {
  position: absolute;
  width: 1px;
  height: 1px;
  min-height: 0;
  opacity: 0;
  pointer-events: none;
}

.video-container.collapsed .mute-indicator,
.video-container.collapsed .retry-indicator {
  display: none;
}

.video-container.collapsed::after {
  content: attr(data-pip-message);
  color: var(--text-secondary);
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
  color: var(--text-on-accent);
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
  color: var(--text-on-accent);
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

.video-player {
  width: 100%;
  height: auto;
  min-height: 400px;
  display: block;
}

/* Single-stream custom control bar reuses the .dual-controls-* styling and
   overlays the bottom of the (position: relative) .video-container. */
.single-controls-section {
  padding-bottom: 8px;
}

/* Inline volume control (single-stream bar). */
.single-volume {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Two-class selector to outrank `.dual-seek { width: 100% }`, which is declared
   later in this stylesheet and would otherwise stretch the volume slider. */
.single-volume .single-volume-slider {
  width: 72px;
  flex-shrink: 0;
}

/* Playback-speed drop-up trigger (both bars). Pill variant of the icon button. */
.dual-speed-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 14px;
  background-color: transparent;
  color: #f5f5f5;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.dual-speed-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.14);
}

.dual-speed-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dual-speed-popover {
  min-width: 0;
  max-height: 220px;
  overflow-y: auto;
}

.dual-speed-popover .dual-popover-option {
  justify-content: center;
}

.video-container:fullscreen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background-color: #000;
}

.video-container:fullscreen .video-player {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
}

.dual-playback-shell {
  display: flex;
  flex-direction: column;
  position: relative;
}

.dual-video-container {
  min-height: 400px;
}

.dual-video-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1px;
  background-color: #111;
  min-height: 400px;
}

.dual-video-panel {
  position: relative;
  min-width: 0;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dual-video-label {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.65);
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 600;
}

.dual-video-player {
  width: 100%;
  height: 100%;
  min-height: 400px;
  object-fit: contain;
  display: block;
  background-color: #000;
}

.dual-playback-shell:fullscreen {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #000;
}

.dual-playback-shell:fullscreen .dual-video-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: none;
  border-radius: 0;
}

.dual-playback-shell:fullscreen .dual-video-grid {
  flex: 1;
  min-height: 0;
}

.dual-playback-shell:fullscreen .dual-video-player {
  min-height: 0;
}

.dual-playback-shell:fullscreen .dual-controls-section {
  border-left: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
}

.dual-controls-section {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 10px 7px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.58) 28%, rgba(0, 0, 0, 0.86) 100%);
  border: none;
  border-radius: 0;
  color: #f5f5f5;
  transition: opacity 0.2s ease;
}

/* Auto-hide: fade the overlay out and hide the cursor while idle during playback. */
.dual-controls-section.controls-hidden {
  opacity: 0;
  pointer-events: none;
}

.video-container.controls-hidden,
.dual-playback-shell.controls-hidden {
  cursor: none;
}

.dual-controls-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  height: 28px;
}

.dual-controls-left,
.dual-controls-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dual-controls-left {
  flex: 1;
}

.dual-controls-right {
  flex-shrink: 0;
}

.dual-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: transparent;
  color: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.dual-icon-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.14);
}

.dual-icon-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dual-popover-anchor {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dual-popover {
  position: absolute;
  right: 0;
  bottom: 34px;
  z-index: 40;
  min-width: 168px;
  padding: 6px;
  border-radius: 6px;
  background-color: rgba(28, 28, 28, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(8px);
}

.dual-popover-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dual-popover-option svg {
  flex-shrink: 0;
}

.dual-popover-option:hover:not(:disabled),
.dual-popover-option.active {
  background-color: rgba(255, 255, 255, 0.14);
}

.dual-popover-option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dual-audio-popover {
  right: -42px;
}

.dual-time {
  min-width: 92px;
  font-size: 12px;
  color: #f5f5f5;
  text-align: left;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.dual-seek {
  width: 100%;
  height: 12px;
  margin: 0;
  appearance: none;
  background-color: transparent;
  cursor: pointer;
}

.dual-seek::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    #f5f5f5 0%,
    #f5f5f5 var(--dual-progress),
    rgba(255, 255, 255, 0.34) var(--dual-progress),
    rgba(255, 255, 255, 0.34) 100%
  );
}

.dual-seek::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3px;
  border-radius: 50%;
  background-color: #f5f5f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.dual-seek::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
}

.dual-seek::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: #f5f5f5;
}

.dual-seek::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 50%;
  background-color: #f5f5f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.dual-seek:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Details toggle section */
.details-toggle {
  margin-top: 12px;
}

.details-section {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.detail-item {
  margin: 6px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-item strong {
  color: var(--text-primary);
}

/* Combined warning */
.combined-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  margin: 0 0 8px 0;
  background-color: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 6px;
  color: var(--text-warning);
  font-size: 14px;
  line-height: 1.4;
}

.combined-warning svg {
  flex-shrink: 0;
  color: var(--warning);
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
  color: var(--danger);
}

.warning-message .dismiss-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.warning-message .dismiss-btn:hover {
  opacity: 1;
  color: var(--text-primary);
}

/* Slide extraction controls */
.slide-extraction-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.slide-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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
  color: var(--text-primary);
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
  background-color: var(--border-strong);
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
  background-color: var(--bg-input);
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.extraction-toggle input:checked + .toggle-slider {
  background-color: var(--accent);
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
  background-color: var(--badge-active-bg);
  border: 1px solid var(--accent-deep);
  border-radius: 6px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
}

.slide-counter svg {
  flex-shrink: 0;
  color: var(--accent);
}

.counter-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

.counter-status {
  color: var(--badge-active-text);
  font-weight: 400;
  opacity: 0.8;
}

/* Slide Gallery — bottom section of the seamless player panel */
.slide-gallery {
  background-color: var(--bg-elevated);
}

.gallery-header {
  margin-bottom: 0;
}

/* Thumbnail grid (child SlideGallery component) inset from the panel edges */
.slide-gallery :deep(.gallery-grid) {
  padding: 16px;
}

/* Post-processing status bar: flush panel section, not a nested box */
.post-process-status-bar {
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 16px;
}

.status-bar-content {
  display: flex;
  align-items: stretch;
  gap: 12px;
  font-size: 11px;
}

.processing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
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

  .dual-video-grid {
    grid-template-columns: 1fr;
    min-height: 250px;
  }

  .dual-video-player {
    min-height: 220px;
  }

  .dual-controls-main-row {
    height: auto;
  }

  .dual-seek {
    min-width: 0;
  }

}
</style>
