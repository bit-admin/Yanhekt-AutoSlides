<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-6 overflow-hidden rounded-lg border border-line bg-elevated">
      <div class="flex items-center gap-4 p-4">
        <button @click="goBack" :class="pbIconText" :disabled="shouldDisableControls">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="flex-1">
          <h2 class="m-0 text-xl font-semibold text-fg">{{ course?.title || $t('playback.unknownCourse') }}</h2>
          <p v-if="session" class="m-0 mt-1 text-sm text-fg-secondary">{{ session.title }}</p>
          <p v-if="course?.session?.section_group_title && props.mode === 'live'" class="m-0 mt-1 text-sm text-fg-secondary">{{ course.session.section_group_title }}</p>
          <div v-if="!isVisible && isPlaying" class="mt-1 flex w-fit items-center gap-1 rounded bg-[#28a745] px-1.5 py-0.5 text-xs text-white dark:bg-[#66cc66] dark:text-[#1a1a1a]">
            <svg class="animate-pulse" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {{ $t('playback.playingInBackground') }}
          </div>
        </div>
        <button @click="refreshPage" :class="pbIconBtn" :disabled="shouldDisableControls" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button @click="toggleCourseDetails" :class="pbIconBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform" :class="{ 'rotate-180': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 border-t border-line bg-surface p-4">
        <div class="flex flex-col gap-1" v-if="course?.instructor">
          <span :class="pbDetailLabel">{{ $t('playback.instructor') }}</span>
          <span :class="pbDetailValue">{{ course.instructor }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.professors && course.professors.length > 0">
          <span :class="pbDetailLabel">{{ $t('playback.professors') }}</span>
          <span :class="pbDetailValue">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.time">
          <span :class="pbDetailLabel">{{ $t('sessions.academicTerm') }}</span>
          <span :class="pbDetailValue">{{ course.time }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.classrooms && course.classrooms.length > 0">
          <span :class="pbDetailLabel">{{ $t('sessions.classrooms') }}</span>
          <span :class="pbDetailValue">{{ course.classrooms.map(c => c.name).join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.college_name">
          <span :class="pbDetailLabel">{{ $t('sessions.college') }}</span>
          <span :class="pbDetailValue">{{ course.college_name }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.participant_count !== undefined">
          <span :class="pbDetailLabel">{{ $t('sessions.participants') }}</span>
          <span :class="pbDetailValue">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="session">
          <span :class="pbDetailLabel">{{ $t('playback.sessionDate') }}</span>
          <span :class="pbDetailValue">{{ formatDate(session.started_at) }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="playbackData?.duration">
          <span :class="pbDetailLabel">{{ $t('playback.duration') }}</span>
          <span :class="pbDetailValue">{{ formatDuration(playbackData.duration) }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="currentStreamData || isDualStreamSelected">
          <span :class="pbDetailLabel">{{ $t('playback.currentStream') }}</span>
          <span v-if="isDualStreamSelected" :class="pbDetailValue">{{ $t('playback.bothStreams') }}</span>
          <span v-else-if="currentStreamData" :class="pbDetailValue">
            {{ currentStreamData.type === 'camera' ? $t('playback.streamCamera') : currentStreamData.type === 'screen' ? $t('playback.streamScreen') : currentStreamData.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div v-if="loading" class="flex h-[400px] flex-col items-center justify-center gap-4 text-fg-secondary">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-[#f3f3f3] border-t-accent dark:border-[#555]"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
      </div>

      <div v-else-if="error" class="flex h-[400px] flex-col items-center justify-center gap-4 text-fg-secondary">
        <svg class="text-danger" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <div class="max-w-[500px] text-center">
          <p class="mb-3 text-base font-medium text-fg">{{ error }}</p>
          <div v-if="lastPlaybackPosition > 0" class="my-3 rounded border-l-[3px] border-accent bg-elevated px-3 py-2">
            <p class="m-0 text-sm text-fg-secondary">
              <strong>{{ $t('playback.lastPlayedPosition') }}</strong> {{ formatDuration(Math.floor(lastPlaybackPosition)) }}
            </p>
          </div>
          <div v-if="error.includes('Failed after') || error.includes('retry attempts')" class="my-4 rounded border border-[#ffeaa7] bg-[#fff3cd] p-3 dark:border-[#665c2a] dark:bg-[#3d3520]">
            <p class="m-0 text-sm leading-[1.4] text-[#856404] dark:text-[#d4b942]">
              {{ $t('playback.networkProblems') }}
            </p>
          </div>
        </div>
        <button @click="retryLoad" class="rounded border border-accent bg-accent px-4 py-2 text-sm text-white cursor-pointer transition-colors hover:bg-accent-hover dark:text-[#1a1a1a]">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playbackData" class="flex flex-col gap-3" :data-playback-mode="props.mode">

        <!-- Combined Warning Messages -->
        <div v-if="isTaskRunning || (props.mode === 'recorded' && showSpeedWarning) || aiFilteringError.type !== 'none'" class="flex items-start gap-2 rounded-md border border-[#ffeaa7] bg-[#fff3cd] px-4 py-3 text-sm leading-[1.4] text-[#856404] dark:border-[#665c2a] dark:bg-[#3d3520] dark:text-[#d4b942]">
          <svg class="mt-0.5 shrink-0 text-[#f39c12]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          <div class="flex flex-1 flex-col gap-2">
            <div v-if="isTaskRunning">
              {{ $t('playback.taskInProgress') }}
            </div>
            <div v-if="props.mode === 'recorded' && showSpeedWarning">
              {{ $t('playback.highSpeedWarning') }}
            </div>
            <div v-if="aiFilteringError.type === '403'" :class="pbAiError">
              {{ $t('playback.aiError403') }}
              <button @click="dismissAIError" :class="pbDismiss" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === '413'" :class="pbAiError">
              {{ $t('playback.aiError413') }}
              <button @click="dismissAIError" :class="pbDismiss" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === '429'" :class="pbAiError">
              {{ $t('playback.aiError429') }}
              <button @click="dismissAIError" :class="pbDismiss" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'http'" :class="pbAiError">
              {{ $t('playback.aiErrorHttp', { code: aiFilteringError.httpCode }) }}
              <button @click="dismissAIError" :class="pbDismiss" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'unknown'" :class="pbAiError">
              {{ $t('playback.aiErrorUnknown') }}
              <button @click="dismissAIError" :class="pbDismiss" :title="$t('playback.dismiss')">×</button>
            </div>
          </div>
        </div>

        <DualStreamControls
          v-model:selected-stream="selectedStream"
          v-model:current-playback-rate="currentPlaybackRate"
          :streams="playbackData.streams"
          :playback-rate-options="playbackRateOptions"
          :mode="props.mode"
          :is-dual-stream-selected="isDualStreamSelected"
          :is-picture-in-picture="isPictureInPicture"
          :should-disable-controls="shouldDisableControls"
          :video-player-ready="!!videoPlayer"
          :has-dual-streams="hasDualStreams"
          :dual-stream-key="DUAL_STREAM_KEY"
          @switch-stream="switchStream"
          @change-playback-rate="changePlaybackRate"
          @toggle-picture-in-picture="togglePictureInPicture"
        />

        <!-- Video Player -->
        <div
          v-if="!isDualStreamSelected"
          class="relative w-full overflow-hidden border-x border-b border-line bg-black transition-all"
          :class="{ 'flex !h-[60px] items-center justify-center !bg-elevated': isVideoContainerCollapsed }"
        >
          <video
            ref="videoPlayer"
            class="block min-h-[400px] w-full max-md:min-h-[250px]"
            :class="{ hidden: isVideoContainerCollapsed }"
            controls
            controlslist="noplaybackrate"
            preload="metadata"
            @error="onVideoError"
            @canplay="onCanPlay"
            @ended="onEnded"
            @volumechange="preventUnmute"
            @enterpictureinpicture="onEnterPictureInPicture"
            @leavepictureinpicture="onLeavePictureInPicture"
          >
            {{ $t('playback.browserNotSupported') }}
          </video>
          <span v-if="isVideoContainerCollapsed" class="text-sm italic text-fg-secondary">{{ $t('playback.videoPlayingInPiP') }}</span>
          <div v-if="shouldVideoMute && !isVideoContainerCollapsed" :class="pbMuteIndicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <span>{{ muteMode === 'mute_all' ? $t('playback.mutedByApp') : muteMode === 'mute_live' ? $t('playback.liveMuted') : $t('playback.recordedMuted') }}</span>
          </div>
          <!-- Retry Indicator -->
          <div v-if="isRetrying && !isVideoContainerCollapsed" :class="pbRetryIndicator">
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
            <span>{{ retryMessage }}</span>
          </div>
        </div>

        <div
          v-else
          ref="dualVideoContainer"
          class="dual-playback-shell"
          :class="{ 'is-fullscreen': isDualFullscreen }"
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

          <div class="dual-controls-section">
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
                <div class="dual-popover-anchor">
                  <button
                    class="dual-icon-button"
                    @click="toggleDualAudioPanel"
                    :disabled="shouldDisableControls || shouldVideoMute"
                    :title="$t('playback.dual.audioSource')"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
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

        <!-- Slide Gallery ('slide-gallery' retained as a Driver.js tour hook) -->
        <div v-if="isScreenRecordingSelected && !isDualStreamSelected" class="slide-gallery rounded-b-lg border border-line bg-elevated">
          <div class="mb-2">
            <!-- Slide Extraction Controls -->
            <div class="flex items-center justify-between rounded-b-lg border border-line bg-elevated p-4">
              <div class="flex items-center gap-5">
                <!-- 'extraction-toggle' is a custom CSS toggle switch (kept scoped) -->
                <label class="extraction-toggle">
                  <input
                    type="checkbox"
                    v-model="isSlideExtractionEnabled"
                    @change="toggleSlideExtraction"
                    :disabled="shouldDisableControls"
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-text text-fg">{{ $t('playback.slideExtraction') }}</span>
                </label>

                <div class="flex items-center gap-2 rounded-md border border-[#bbdefb] bg-[#e3f2fd] px-3 py-1.5 text-sm font-medium text-[#1565c0] dark:border-[#2d4a66] dark:bg-[#1a2332] dark:text-[#4da6ff]">
                  <svg class="shrink-0 text-[#1976d2] dark:text-[#66b3ff]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="flex items-center gap-1">
                    {{ isSlideExtractionEnabled ? extractedSlides.length : 0 }} {{ $t('playback.slides') }}
                    <span v-if="isSlideExtractionEnabled" class="font-normal opacity-80">{{ $t('playback.extracted') }}</span>
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Post-processing Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="executePostProcessing()"
                  class="flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1.5 text-[13px] text-white cursor-pointer transition-colors enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-[#6c757d] disabled:bg-[#6c757d] dark:text-[#1a1a1a]"
                  :disabled="isPostProcessing"
                  title="Execute post-processing on all saved slides"
                >
                  <svg v-if="!isPostProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="m2 17 10 5 10-5"/>
                    <path d="m2 12 10 5 10-5"/>
                  </svg>
                  <div v-else class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  {{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}
                </button>

                <!-- Clear All Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="clearAllSlides"
                  class="flex items-center gap-1.5 rounded border border-[#dc3545] bg-[#dc3545] px-3 py-1.5 text-[13px] text-white cursor-pointer transition-colors hover:border-[#c82333] hover:bg-[#c82333] dark:border-[#ff6b6b] dark:bg-[#ff6b6b] dark:hover:border-[#ff5252] dark:hover:bg-[#ff5252]"
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

          <!-- Post-processing Status Bar (manual / live mode only; recorded task mode shows it in RightPanel) -->
          <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0 && (mode === 'live' || !isTaskRunning)" class="mx-4 mb-3 rounded border border-line bg-elevated px-3 py-2">
            <div class="flex items-stretch gap-3 text-[11px]">
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

      <div v-else class="flex h-[400px] flex-col items-center justify-center gap-4 text-fg-secondary">
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
// ---- Tailwind class-string constants (chrome; dual-player + toggle stay scoped) ----
const pbIconText = 'flex items-center gap-1.5 rounded border border-line-input bg-surface px-4 py-2 text-sm text-fg-secondary cursor-pointer transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2d2d2d]'
const pbIconBtn = 'flex h-8 w-8 items-center justify-center rounded border border-line-input bg-surface text-fg cursor-pointer transition-colors enabled:hover:border-accent enabled:hover:bg-[#f0f8ff] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2d2d2d] dark:enabled:hover:bg-[#333]'
const pbDetailLabel = 'text-xs font-semibold uppercase tracking-wide text-fg-secondary'
const pbDetailValue = 'text-sm font-medium text-fg'
const pbAiError = 'flex items-center justify-between gap-2 text-[#c0392b] dark:text-[#e74c3c]'
const pbDismiss = 'border-none bg-transparent px-1 text-base leading-none text-fg-secondary cursor-pointer opacity-70 transition-opacity hover:text-fg hover:opacity-100'
const pbMuteIndicator = 'absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded bg-[rgba(220,53,69,0.9)] px-3 py-1.5 text-xs font-medium text-white dark:bg-[rgba(255,107,107,0.9)] dark:text-[#1a1a1a]'
const pbRetryIndicator = 'absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-lg bg-black/80 px-5 py-3 text-sm font-medium text-white backdrop-blur-[4px] dark:bg-[rgba(45,45,45,0.9)] dark:text-[#e0e0e0]'
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRef } from 'vue'
import { configStore } from '@shared/services/configStore'
import { DUAL_STREAM_KEY, useVideoPlayer, type DualAudioSource } from '@features/video/useVideoPlayer'
import { useSlideExtraction, type Course, type Session } from '@features/video/useSlideExtraction'
import { usePostProcessing } from '@features/download/usePostProcessing'
import { useTaskQueue } from '@features/download/useTaskQueue'
import { usePerformanceOptimization } from '@features/video/usePerformanceOptimization'
import { useSlideGallery } from '@features/video/useSlideGallery'
import PostProcessingProgressBar from './PostProcessingProgressBar.vue'
import SlideGallery from './SlideGallery.vue'
import PreviewModal from './PreviewModal.vue'
import DualStreamControls from './DualStreamControls.vue'
import { fromPlaybackStatus } from '@shared/postProcessing/displayAdapter'

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
const showMorePlaybackSpeed = ref(false)
const dualVideoContainer = ref<HTMLElement | null>(null)
const isDualOrderSwapped = ref(false)
const isDualFullscreen = ref(false)
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

const handleKeyboardSeek = (event: KeyboardEvent) => {
  if (props.mode !== 'recorded') return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return

  const target = event.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }

  if (selectedSlide.value) return
  if (shouldDisableControls.value) return

  const delta = event.key === 'ArrowRight' ? SEEK_SECONDS : -SEEK_SECONDS

  if (isDualStreamSelected.value) {
    if (!dualCanSeek.value) return
    event.preventDefault()
    seekDualStreams(dualCurrentTime.value + delta)
    return
  }

  const video = videoPlayer.value
  if (!video || !Number.isFinite(video.duration)) return
  event.preventDefault()
  const next = Math.min(Math.max(video.currentTime + delta, 0), video.duration)
  video.currentTime = next
}

const setDualAudio = (source: DualAudioSource) => {
  setDualAudioSource(source)
  showDualAudioPanel.value = false
}

const toggleDualStreamOrder = () => {
  isDualOrderSwapped.value = !isDualOrderSwapped.value
  showDualMorePanel.value = false
}

const toggleDualAudioPanel = () => {
  if (shouldVideoMute.value) return
  showDualAudioPanel.value = !showDualAudioPanel.value
  if (showDualAudioPanel.value) {
    showDualMorePanel.value = false
  }
}

const toggleDualMorePanel = () => {
  showDualMorePanel.value = !showDualMorePanel.value
  if (showDualMorePanel.value) {
    showDualAudioPanel.value = false
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
    console.error('Error toggling dual fullscreen:', error)
  }
}

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
    console.error('Failed to load show-more playback speed config:', error)
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
      slideExtraction.slideExtractorInstance.value.stop()
    }
    slideExtraction.slideExtractionStatus.value.isRunning = false
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
  window.addEventListener('keydown', handleKeyboardSeek)
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
  window.removeEventListener('keydown', handleKeyboardSeek)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
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
/* Genuinely-custom video-player CSS kept scoped: dual-stream grid + :fullscreen,
   the range-slider pseudo-elements, overlay indicators, and the toggle switch.
   Everything else uses Tailwind utilities. Theme-aware via tokens; the few
   bespoke overlay colors keep a small dark block. */
.mute-indicator {
  position: absolute; top: 12px; right: 12px;
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 4px;
  background-color: rgba(220, 53, 69, 0.9); color: #fff;
  font-size: 12px; font-weight: 500; z-index: 10;
}
.mute-indicator svg { flex-shrink: 0; }
.retry-indicator {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.8); color: #fff;
  font-size: 14px; font-weight: 500; z-index: 20; backdrop-filter: blur(4px);
}
.retry-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.dual-playback-shell { display: flex; flex-direction: column; position: relative; }
.dual-video-container { min-height: 400px; }
.dual-video-grid {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1px; background-color: #111; min-height: 400px;
}
.dual-video-panel {
  position: relative; min-width: 0; background-color: #000;
  display: flex; align-items: center; justify-content: center;
}
.dual-video-label {
  position: absolute; top: 12px; left: 12px; z-index: 5;
  padding: 4px 8px; border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.65); color: #fff;
  font-size: 12px; font-weight: 600;
}
.dual-video-player {
  width: 100%; height: 100%; min-height: 400px;
  object-fit: contain; display: block; background-color: #000;
}
.dual-playback-shell:fullscreen {
  display: flex; flex-direction: column; width: 100vw; height: 100vh; background-color: #000;
}
.dual-playback-shell:fullscreen .dual-video-container { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.dual-playback-shell:fullscreen .dual-video-grid { flex: 1; min-height: 0; }
.dual-playback-shell:fullscreen .dual-video-player { min-height: 0; }

.dual-controls-section {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; flex-direction: column; gap: 4px; padding: 18px 10px 7px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.58) 28%, rgba(0, 0, 0, 0.86) 100%);
  color: #f5f5f5;
}
.dual-controls-main-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; height: 28px; }
.dual-controls-left, .dual-controls-right { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dual-controls-left { flex: 1; }
.dual-controls-right { flex-shrink: 0; }
.dual-icon-button {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%;
  background-color: transparent; color: #f5f5f5; cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.dual-icon-button:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.14); }
.dual-icon-button:disabled { opacity: 0.45; cursor: not-allowed; }
.dual-popover-anchor { position: relative; display: flex; align-items: center; justify-content: center; }
.dual-popover {
  position: absolute; right: 0; bottom: 34px; z-index: 40; min-width: 168px; padding: 6px;
  border-radius: 6px; background-color: rgba(28, 28, 28, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38); backdrop-filter: blur(8px);
}
.dual-popover-option {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 9px;
  border: none; border-radius: 4px; background-color: transparent;
  color: rgba(255, 255, 255, 0.88); font-size: 12px; text-align: left; cursor: pointer; transition: background-color 0.2s;
}
.dual-popover-option svg { flex-shrink: 0; }
.dual-popover-option:hover, .dual-popover-option.active { background-color: rgba(255, 255, 255, 0.14); }
.dual-audio-popover { right: -42px; }
.dual-time {
  min-width: 92px; font-size: 12px; color: #f5f5f5; text-align: left; white-space: nowrap;
  font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.dual-seek { width: 100%; height: 12px; margin: 0; appearance: none; background-color: transparent; cursor: pointer; }
.dual-seek::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px;
  background: linear-gradient(90deg, #f5f5f5 0%, #f5f5f5 var(--dual-progress), rgba(255, 255, 255, 0.34) var(--dual-progress), rgba(255, 255, 255, 0.34) 100%);
}
.dual-seek::-webkit-slider-thumb {
  appearance: none; width: 10px; height: 10px; margin-top: -3px; border-radius: 50%;
  background-color: #f5f5f5; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
.dual-seek::-moz-range-track { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.34); }
.dual-seek::-moz-range-progress { height: 4px; border-radius: 999px; background: #f5f5f5; }
.dual-seek::-moz-range-thumb { width: 10px; height: 10px; border: none; border-radius: 50%; background-color: #f5f5f5; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45); }
.dual-seek:disabled { opacity: 0.45; cursor: not-allowed; }

.extraction-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 500; user-select: none; }
.extraction-toggle input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: relative; display: inline-block; width: 48px; height: 24px;
  background-color: var(--border-strong); border-radius: 24px; transition: all 0.3s ease; cursor: pointer; flex-shrink: 0;
}
.toggle-slider::before {
  content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
  background-color: #fff; border-radius: 50%; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.extraction-toggle input:checked + .toggle-slider { background-color: var(--accent); }
.extraction-toggle input:checked + .toggle-slider::before { transform: translateX(24px); }
.extraction-toggle input:disabled + .toggle-slider { opacity: 0.5; cursor: not-allowed; }
.extraction-toggle:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
.toggle-text { font-size: 15px; font-weight: 600; user-select: none; }

@media (max-width: 768px) {
  .dual-video-grid { grid-template-columns: 1fr; min-height: 250px; }
  .dual-video-player { min-height: 220px; }
  .dual-controls-main-row { height: auto; }
}

@media (prefers-color-scheme: dark) {
  .mute-indicator { background-color: rgba(255, 107, 107, 0.9); color: #1a1a1a; }
  .retry-indicator { background-color: rgba(45, 45, 45, 0.9); color: #e0e0e0; }
  .retry-spinner { border-color: rgba(224, 224, 224, 0.3); border-top-color: #e0e0e0; }
}
</style>
