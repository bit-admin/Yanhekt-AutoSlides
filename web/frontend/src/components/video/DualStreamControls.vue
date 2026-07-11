<template>
  <div class="controls-row">
    <div v-if="streamCount > 1" class="stream-selector">
      <label>{{ $t('playback.selectStream') }}</label>
      <select
        :value="selectedStream"
        @change="onStreamChange($event)"
        :disabled="shouldDisableControls"
      >
        <option v-if="hasDualStreams" :value="dualStreamKey">
          {{ $t('playback.bothStreams') }}
        </option>
        <option v-for="(stream, key) in streams" :key="key" :value="key">
          {{ stream.type === 'camera' ? $t('playback.streamCamera') : stream.type === 'screen' ? $t('playback.streamScreen') : stream.name }}
        </option>
      </select>
    </div>

    <div v-if="mode === 'recorded'" class="playback-rate-control">
      <label>{{ $t('playback.playbackSpeed') }}</label>
      <select
        :value="currentPlaybackRate"
        @change="onRateChange($event)"
        :disabled="shouldDisableControls"
      >
        <option v-for="rate in playbackRateOptions" :key="rate" :value="rate">{{ rate }}x</option>
      </select>
    </div>

    <!-- Cinema Mode is available in every stream mode; PiP is single-stream only
         (you can't picture-in-picture two videos). -->
    <div class="pip-control">
      <button
        class="icon-control-button"
        :class="{ active: isCinemaMode }"
        @click="$emit('toggleCinemaMode')"
        :disabled="shouldDisableControls"
        :title="isCinemaMode ? $t('playback.exitCinemaMode') : $t('playback.cinemaMode')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M2 9h20" />
          <path d="M2 15h20" />
        </svg>
      </button>
      <button
        v-if="!isDualStreamSelected"
        class="icon-control-button"
        @click="$emit('togglePictureInPicture')"
        :disabled="shouldDisableControls || !videoPlayerReady"
        :title="isPictureInPicture ? $t('playback.exitPictureInPicture') : $t('playback.enterPictureInPicture')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <rect x="14" y="12" width="6" height="4" rx="1" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VideoStream } from '../../composables/video/useVideoPlayer'

const props = defineProps<{
  streams: { [key: string]: VideoStream }
  selectedStream: string
  currentPlaybackRate: number
  playbackRateOptions: number[]
  mode: 'live' | 'recorded'
  isDualStreamSelected: boolean
  isPictureInPicture: boolean
  isCinemaMode: boolean
  shouldDisableControls: boolean
  videoPlayerReady: boolean
  hasDualStreams: boolean
  dualStreamKey: string
}>()

const emit = defineEmits<{
  (e: 'update:selectedStream', value: string): void
  (e: 'update:currentPlaybackRate', value: number): void
  (e: 'switchStream'): void
  (e: 'changePlaybackRate'): void
  (e: 'togglePictureInPicture'): void
  (e: 'toggleCinemaMode'): void
}>()

const streamCount = computed(() => Object.keys(props.streams).length)

function onStreamChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:selectedStream', value)
  emit('switchStream')
}

function onRateChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('update:currentPlaybackRate', value)
  emit('changePlaybackRate')
}
</script>

<style scoped>
/* Top section of the seamless player panel: hairline divider to the video below */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.stream-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stream-selector label {
  font-weight: 500;
  color: var(--text-primary);
}

.stream-selector select {
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.stream-selector select:hover:not(:disabled),
.stream-selector select:focus {
  outline: none;
  border-color: var(--accent);
}

.stream-selector select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-input-disabled);
}

.playback-rate-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playback-rate-control label {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.playback-rate-control select {
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.playback-rate-control select:hover:not(:disabled),
.playback-rate-control select:focus {
  outline: none;
  border-color: var(--accent);
}

.playback-rate-control select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-input-disabled);
}

.pip-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Icon-only square controls (Cinema Mode + Picture-in-Picture). */
.icon-control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-control-button:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

.icon-control-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-input-disabled);
}

/* Highlight while cinema mode is active. */
.icon-control-button.active {
  border-color: var(--accent);
  color: var(--accent);
}

.icon-control-button svg {
  flex-shrink: 0;
}
</style>
