<template>
  <div class="flex flex-col h-full p-4">
    <div class="border border-border rounded-lg bg-elevated mb-6 overflow-hidden">
      <div class="flex items-center gap-4 p-4">
        <button @click="goBack" class="flex items-center gap-1.5 py-2 px-4 border border-border-input rounded bg-surface text-text-secondary text-sm cursor-pointer transition-all hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-elevated" :disabled="shouldDisableControls">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="flex-1">
          <h2 class="m-0 text-xl font-semibold text-text">{{ course?.title || $t('playback.unknownCourse') }}</h2>
          <p v-if="session" class="mt-1 mb-0 text-sm text-text-secondary">{{ session.title }}</p>
          <p v-if="course?.session?.section_group_title && props.mode === 'live'" class="mt-1 mb-0 text-sm text-text-secondary">{{ course.session.section_group_title }}</p>
          <div v-if="!isVisible && isPlaying" class="flex items-center gap-1 mt-1 py-0.5 px-1.5 bg-success text-white text-xs rounded w-fit [&_svg]:animate-pulse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {{ $t('playback.playingInBackground') }}
          </div>
        </div>
        <button @click="refreshPage" class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all hover:border-accent hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-elevated" :disabled="shouldDisableControls" :title="$t('playback.refresh')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
        <button @click="toggleCourseDetails" class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all hover:border-accent hover:bg-hover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform duration-200" :class="{ 'rotate-180': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="p-4 border-t border-border bg-surface grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div class="flex flex-col gap-1" v-if="course?.instructor">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.instructor') }}</span>
          <span class="text-sm text-text font-medium">{{ course.instructor }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.professors && course.professors.length > 0">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.professors') }}</span>
          <span class="text-sm text-text font-medium">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.time">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-sm text-text font-medium">{{ course.time }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.classrooms && course.classrooms.length > 0">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.classrooms') }}</span>
          <span class="text-sm text-text font-medium">{{ course.classrooms.map(c => c.name).join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.college_name">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.college') }}</span>
          <span class="text-sm text-text font-medium">{{ course.college_name }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.participant_count !== undefined">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.participants') }}</span>
          <span class="text-sm text-text font-medium">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="session">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.sessionDate') }}</span>
          <span class="text-sm text-text font-medium">{{ formatDate(session.started_at) }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="playbackData?.duration">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.duration') }}</span>
          <span class="text-sm text-text font-medium">{{ formatDuration(playbackData.duration) }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="currentStreamData || isDualStreamSelected">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.currentStream') }}</span>
          <span v-if="isDualStreamSelected" class="text-sm text-text font-medium">{{ $t('playback.bothStreams') }}</span>
          <span v-else-if="currentStreamData" class="text-sm text-text font-medium">
            {{ currentStreamData.type === 'camera' ? $t('playback.streamCamera') : currentStreamData.type === 'screen' ? $t('playback.streamScreen') : currentStreamData.name }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0 overflow-y-auto content-scrollbar">
      <div v-if="loading" class="flex flex-col items-center justify-center h-[400px] gap-4 text-text-secondary">
        <div class="w-10 h-10 border-4 border-[var(--bg-elevated)] border-t-accent rounded-full animate-spin"></div>
        <p>{{ $t('playback.loadingVideoStreams') }}</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center h-[400px] gap-4 text-text-secondary">
        <svg class="text-danger" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <div class="text-center max-w-[500px]">
          <p class="text-base font-medium mb-3 text-text">{{ error }}</p>
          <div v-if="lastPlaybackPosition > 0" class="my-3 py-2 px-3 bg-elevated rounded border-l-[3px] border-l-accent">
            <p class="m-0 text-sm text-text-secondary">
              <strong>{{ $t('playback.lastPlayedPosition') }}</strong> {{ formatDuration(Math.floor(lastPlaybackPosition)) }}
            </p>
          </div>
          <div v-if="error.includes('Failed after') || error.includes('retry attempts')" class="my-4 p-3 bg-warning-bg border border-warning-border rounded">
            <p class="m-0 text-sm text-warning leading-[1.4]">
              {{ $t('playback.networkProblems') }}
            </p>
          </div>
        </div>
        <button @click="retryLoad" class="py-2 px-4 border border-accent rounded bg-accent text-white text-sm cursor-pointer transition-all hover:bg-accent-hover">{{ $t('playback.retry') }}</button>
      </div>

      <div v-else-if="playbackData" class="flex flex-col gap-3" :data-playback-mode="props.mode">

        <!-- Combined Warning Messages -->
        <div v-if="isTaskRunning || (props.mode === 'recorded' && showSpeedWarning) || aiFilteringError.type !== 'none'" class="flex items-start gap-2 py-3 px-4 mb-2 bg-warning-bg border border-warning-border rounded-md text-warning text-sm leading-[1.4]">
          <svg class="shrink-0 text-[#f39c12] mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
          <div class="flex-1 flex flex-col gap-2">
            <div v-if="isTaskRunning" class="m-0">
              {{ $t('playback.taskInProgress') }}
            </div>
            <div v-if="props.mode === 'recorded' && showSpeedWarning" class="m-0">
              {{ $t('playback.highSpeedWarning') }}
            </div>
            <div v-if="aiFilteringError.type === '403'" class="m-0 flex items-center justify-between gap-2 text-danger">
              {{ $t('playback.aiError403') }}
              <button @click="dismissAIError" class="bg-none border-none text-text-secondary cursor-pointer text-base py-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100 hover:text-text" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === '413'" class="m-0 flex items-center justify-between gap-2 text-danger">
              {{ $t('playback.aiError413') }}
              <button @click="dismissAIError" class="bg-none border-none text-text-secondary cursor-pointer text-base py-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100 hover:text-text" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === '429'" class="m-0 flex items-center justify-between gap-2 text-danger">
              {{ $t('playback.aiError429') }}
              <button @click="dismissAIError" class="bg-none border-none text-text-secondary cursor-pointer text-base py-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100 hover:text-text" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'http'" class="m-0 flex items-center justify-between gap-2 text-danger">
              {{ $t('playback.aiErrorHttp', { code: aiFilteringError.httpCode }) }}
              <button @click="dismissAIError" class="bg-none border-none text-text-secondary cursor-pointer text-base py-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100 hover:text-text" :title="$t('playback.dismiss')">×</button>
            </div>
            <div v-if="aiFilteringError.type === 'unknown'" class="m-0 flex items-center justify-between gap-2 text-danger">
              {{ $t('playback.aiErrorUnknown') }}
              <button @click="dismissAIError" class="bg-none border-none text-text-secondary cursor-pointer text-base py-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100 hover:text-text" :title="$t('playback.dismiss')">×</button>
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
          class="video-container relative w-full border border-border border-t-0 overflow-hidden transition-all duration-300"
          :class="isVideoContainerCollapsed
            ? 'h-[60px] bg-elevated border-border-border flex items-center justify-center collapsed'
            : 'bg-black'"
          :data-pip-message="$t('playback.videoPlayingInPiP')"
        >
          <video
            v-show="!isVideoContainerCollapsed"
            ref="videoPlayer"
            class="w-full h-auto min-h-[400px] block"
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
          <div v-if="shouldVideoMute && !isVideoContainerCollapsed" class="absolute top-3 right-3 flex items-center gap-1.5 py-1.5 px-3 bg-danger/90 text-white rounded text-xs font-medium z-10 [&_svg]:shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <span>{{ muteMode === 'mute_all' ? $t('playback.mutedByApp') : muteMode === 'mute_live' ? $t('playback.liveMuted') : $t('playback.recordedMuted') }}</span>
          </div>
          <!-- Retry Indicator -->
          <div v-if="isRetrying && !isVideoContainerCollapsed" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 py-3 px-5 bg-black/80 text-white rounded-lg text-sm font-medium z-20 backdrop-blur-[4px]">
            <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>{{ retryMessage }}</span>
          </div>
        </div>

        <div
          v-else
          ref="dualVideoContainer"
          class="dual-playback-shell flex flex-col relative"
        >
          <div class="video-container dual-video-container min-h-[400px] relative w-full bg-black border border-border border-t-0 overflow-hidden transition-all duration-300">
            <div class="grid grid-cols-2 gap-px bg-[#111] min-h-[400px] max-md:grid-cols-1 max-md:min-h-[250px]">
              <div class="relative min-w-0 bg-black flex items-center justify-center" :style="{ order: cameraPanelOrder }">
                <div class="absolute top-3 left-3 z-[5] py-1 px-2 rounded bg-black/65 text-white text-xs font-semibold">{{ $t('playback.streamCamera') }}</div>
                <video
                  ref="cameraVideoPlayer"
                  class="w-full h-full min-h-[400px] object-contain block bg-black max-md:min-h-[220px]"
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
              <div class="relative min-w-0 bg-black flex items-center justify-center" :style="{ order: screenPanelOrder }">
                <div class="absolute top-3 left-3 z-[5] py-1 px-2 rounded bg-black/65 text-white text-xs font-semibold">{{ $t('playback.streamScreen') }}</div>
                <video
                  ref="screenVideoPlayer"
                  class="w-full h-full min-h-[400px] object-contain block bg-black max-md:min-h-[220px]"
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

            <div v-if="shouldVideoMute" class="absolute top-3 right-3 flex items-center gap-1.5 py-1.5 px-3 bg-danger/90 text-white rounded text-xs font-medium z-10 [&_svg]:shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
              <span>{{ $t(globalMuteModeLabelKey) }}</span>
            </div>

            <div v-if="isRetrying" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 py-3 px-5 bg-black/80 text-white rounded-lg text-sm font-medium z-20 backdrop-blur-[4px]">
              <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>{{ retryMessage }}</span>
            </div>
          </div>

          <div class="dual-controls-section absolute left-0 right-0 bottom-0 z-30 flex flex-col gap-1 pt-[18px] px-2.5 pb-[7px] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.58)_28%,rgba(0,0,0,0.86)_100%)] border-none rounded-none text-[var(--bg-page)]">
            <div class="flex items-center justify-between gap-3 min-w-0 h-7 max-md:h-auto">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  class="flex items-center justify-center w-7 h-7 p-0 border-none rounded-full bg-transparent text-[var(--bg-page)] cursor-pointer transition-all shrink-0 hover:bg-white/14 disabled:opacity-45 disabled:cursor-not-allowed"
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

                <span class="min-w-[92px] text-xs text-[var(--bg-page)] text-left whitespace-nowrap tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{{ formatPlaybackTime(dualCurrentTime) }} / {{ dualCanSeek ? formatPlaybackTime(dualDuration) : $t('playback.dual.live') }}</span>
              </div>

              <div class="flex items-center gap-2.5 min-w-0 shrink-0">
                <div class="relative flex items-center justify-center">
                  <button
                    class="flex items-center justify-center w-7 h-7 p-0 border-none rounded-full bg-transparent text-[var(--bg-page)] cursor-pointer transition-all shrink-0 hover:bg-white/14 disabled:opacity-45 disabled:cursor-not-allowed"
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
                  <div v-if="showDualAudioPanel" class="dual-popover absolute right-[-42px] bottom-[34px] z-40 min-w-[168px] p-1.5 rounded-md bg-[rgba(28,28,28,0.96)] border border-white/16 shadow-[0_8px_24px_rgba(0,0,0,0.38)] backdrop-blur-lg">
                    <button
                      class="w-full flex items-center gap-2 py-2 px-[9px] border-none rounded bg-transparent text-white/88 text-xs text-left cursor-pointer transition-colors hover:bg-white/14 [&_svg]:shrink-0"
                      :class="{ 'bg-white/14': dualAudioSource === 'screen' }"
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
                      class="w-full flex items-center gap-2 py-2 px-[9px] border-none rounded bg-transparent text-white/88 text-xs text-left cursor-pointer transition-colors hover:bg-white/14 [&_svg]:shrink-0"
                      :class="{ 'bg-white/14': dualAudioSource === 'camera' }"
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
                  class="flex items-center justify-center w-7 h-7 p-0 border-none rounded-full bg-transparent text-[var(--bg-page)] cursor-pointer transition-all shrink-0 hover:bg-white/14 disabled:opacity-45 disabled:cursor-not-allowed"
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

                <div class="relative flex items-center justify-center">
                  <button
                    class="flex items-center justify-center w-7 h-7 p-0 border-none rounded-full bg-transparent text-[var(--bg-page)] cursor-pointer transition-all shrink-0 hover:bg-white/14 disabled:opacity-45 disabled:cursor-not-allowed"
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
                  <div v-if="showDualMorePanel" class="dual-popover absolute right-0 bottom-[34px] z-40 min-w-[168px] p-1.5 rounded-md bg-[rgba(28,28,28,0.96)] border border-white/16 shadow-[0_8px_24px_rgba(0,0,0,0.38)] backdrop-blur-lg">
                    <button class="w-full flex items-center gap-2 py-2 px-[9px] border-none rounded bg-transparent text-white/88 text-xs text-left cursor-pointer transition-colors hover:bg-white/14 [&_svg]:shrink-0" @click="toggleDualStreamOrder">
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
              class="dual-seek w-full h-3 m-0 appearance-none bg-transparent cursor-pointer max-md:min-w-0 disabled:opacity-[0.45] disabled:cursor-not-allowed"
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
        <div v-if="isScreenRecordingSelected && !isDualStreamSelected" class="bg-elevated border border-border border-t-0 rounded-b-lg">
          <div class="gallery-header mb-2">
            <!-- Slide Extraction Controls -->
            <div class="slide-extraction-control flex justify-between items-center p-4 bg-elevated border border-border border-t-border-border rounded-b-lg">
              <div class="flex items-center gap-5">
                <label class="extraction-toggle flex items-center gap-3 cursor-pointer font-medium text-text select-none">
                  <input
                    type="checkbox"
                    v-model="isSlideExtractionEnabled"
                    @change="toggleSlideExtraction"
                    :disabled="shouldDisableControls"
                  />
                  <span class="toggle-slider"></span>
                  <span class="text-[15px] font-semibold select-none">{{ $t('playback.slideExtraction') }}</span>
                </label>

                <div class="flex items-center gap-2 py-1.5 px-3 bg-accent/10 border border-bg-accent/20 rounded-md text-[#1565c0] text-sm font-medium [&_svg]:shrink-0 [&_svg]:text-[#1976d2]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="flex items-center gap-1">
                    {{ isSlideExtractionEnabled ? extractedSlides.length : 0 }} {{ $t('playback.slides') }}
                    <span v-if="isSlideExtractionEnabled" class="text-[#1565c0] font-normal opacity-80">{{ $t('playback.extracted') }}</span>
                  </span>
                </div>
              </div>

              <div class="flex gap-2 items-center">
                <!-- Post-processing Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="executePostProcessing()"
                  class="flex items-center gap-1.5 py-1.5 px-3 border border-accent rounded bg-accent text-white text-[13px] cursor-pointer transition-all hover:bg-accent-hover hover:border-accent-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-text-muted disabled:border-text-muted"
                  :disabled="isPostProcessing"
                  title="Execute post-processing on all saved slides"
                >
                  <svg v-if="!isPostProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="m2 17 10 5 10-5"/>
                    <path d="m2 12 10 5 10-5"/>
                  </svg>
                  <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {{ isPostProcessing ? $t('playback.postProcessing') : $t('playback.postProcess') }}
                </button>

                <!-- Clear All Button (only show when slides exist) -->
                <button
                  v-if="isSlideExtractionEnabled && extractedSlides.length > 0"
                  @click="clearAllSlides"
                  class="flex items-center gap-1.5 py-1.5 px-3 border border-danger rounded bg-danger text-white text-[13px] cursor-pointer transition-all hover:bg-danger-hover hover:border-danger-hover"
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
          <div v-if="isSlideExtractionEnabled && extractedSlides.length > 0 && (mode === 'live' || !isTaskRunning)" class="bg-elevated border border-border rounded py-2 px-3 mb-3">
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

      <div v-else class="flex flex-col items-center justify-center h-[400px] gap-4 text-text-secondary">
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
/* Toggle switch — pseudo-elements and sibling selectors require CSS */
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
  background-color: var(--bg-surface);
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

/* Collapsed video container — pseudo-element and descendant hiding */
.video-container.collapsed::after {
  content: attr(data-pip-message);
  color: var(--text-muted);
  font-size: 14px;
  font-style: italic;
}

.video-container.collapsed .video-player,
.video-container.collapsed .mute-indicator,
.video-container.collapsed .retry-indicator {
  display: none;
}

/* Custom scrollbar — pseudo-elements require CSS */
.content-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.content-scrollbar:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.content-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.content-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.content-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.content-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.content-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Dual seek range slider — pseudo-elements require CSS */
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
  background-color: var(--bg-page);
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
  background: var(--bg-page);
}

.dual-seek::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 50%;
  background-color: var(--bg-page);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

/* Fullscreen styles — pseudo-class requires CSS */
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

/* Keyframes */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
