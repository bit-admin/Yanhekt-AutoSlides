<template>
  <!-- Custom single-stream control bar (replaces native <video controls>).
       Purely presentational: every piece of state is a prop owned by
       PlaybackPage (popover flags included — they feed the shared
       controls-auto-hide persistence together with the dual bar). -->
  <div
    class="dual-controls-section single-controls-section"
    :class="{ 'controls-hidden': !controlsVisible }"
    @mouseenter="emit('pointer-over-controls', true)"
    @mouseleave="emit('pointer-over-controls', false)"
  >
    <div class="dual-controls-main-row">
      <div class="dual-controls-left">
        <button
          class="dual-icon-button"
          @click="emit('toggle-playback')"
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

        <span class="dual-time">{{ formatTime(currentTime) }} / {{ canSeek ? formatTime(duration) : $t('playback.dual.live') }}</span>
      </div>

      <div class="dual-controls-right">
        <div class="single-volume">
          <button
            class="dual-icon-button"
            @click="emit('toggle-mute')"
            :disabled="shouldDisableControls || shouldVideoMute"
            :title="isMuted ? $t('playback.unmute') : $t('playback.mute')"
          >
            <svg v-if="!isMuted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
            :value="effectiveVolume"
            :style="{ '--dual-progress': volumeProgress }"
            :disabled="shouldDisableControls || shouldVideoMute"
            :aria-label="$t('playback.volume')"
            @input="onVolumeInput"
          />
        </div>

        <div v-if="mode === 'recorded'" class="dual-popover-anchor">
          <button
            class="dual-speed-button"
            @click="emit('toggle-speed-panel')"
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
              @click="emit('set-playback-rate', rate)"
            >
              <span>{{ rate }}x</span>
            </button>
          </div>
        </div>

        <button
          class="dual-icon-button"
          @click="emit('toggle-fullscreen')"
          :disabled="shouldDisableControls"
          :title="isFullscreen ? $t('playback.dual.exitFullscreen') : $t('playback.dual.fullscreen')"
        >
          <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
            @click="emit('toggle-more-panel')"
            :disabled="shouldDisableControls"
            :title="$t('playback.dual.moreOptions')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          <div v-if="showMorePanel" class="dual-popover dual-more-popover">
            <button
              class="dual-popover-option"
              :class="{ active: isCinemaMode }"
              @click="emit('toggle-cinema')"
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
              :disabled="!videoPlayerReady"
              @click="emit('toggle-pip')"
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
      :max="duration || 0"
      step="0.1"
      :value="currentTime"
      :style="{ '--dual-progress': seekProgress }"
      :disabled="shouldDisableControls || !canSeek"
      @input="onSeekInput"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'live' | 'recorded'
  isPlaying: boolean
  controlsVisible: boolean
  shouldDisableControls: boolean
  shouldVideoMute: boolean
  currentTime: number
  duration: number
  canSeek: boolean
  seekProgress: string
  effectiveVolume: number
  volumeProgress: string
  isMuted: boolean
  currentPlaybackRate: number | string
  playbackRateOptions: number[]
  showSpeedPanel: boolean
  showMorePanel: boolean
  isFullscreen: boolean
  isCinemaMode: boolean
  isPictureInPicture: boolean
  videoPlayerReady: boolean
  formatTime: (duration: string | number) => string
}>()

const emit = defineEmits<{
  (e: 'toggle-playback'): void
  (e: 'seek-input', value: number): void
  (e: 'volume-input', value: number): void
  (e: 'toggle-mute'): void
  (e: 'toggle-speed-panel'): void
  (e: 'set-playback-rate', rate: number): void
  (e: 'toggle-fullscreen'): void
  (e: 'toggle-more-panel'): void
  (e: 'toggle-cinema'): void
  (e: 'toggle-pip'): void
  (e: 'pointer-over-controls', over: boolean): void
}>()

const onSeekInput = (event: Event) => {
  emit('seek-input', Number((event.target as HTMLInputElement).value))
}

const onVolumeInput = (event: Event) => {
  emit('volume-input', Number((event.target as HTMLInputElement).value))
}
</script>

<style scoped src="./playerControlBar.css"></style>
