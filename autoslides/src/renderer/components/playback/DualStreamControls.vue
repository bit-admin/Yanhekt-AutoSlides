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

    <div v-if="!isDualStreamSelected" class="pip-control">
      <button
        class="pip-button"
        @click="$emit('togglePictureInPicture')"
        :disabled="shouldDisableControls || !videoPlayerReady"
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VideoStream } from '../../composables/useVideoPlayer'

const props = defineProps<{
  streams: { [key: string]: VideoStream }
  selectedStream: string
  currentPlaybackRate: number
  playbackRateOptions: number[]
  mode: 'live' | 'recorded'
  isDualStreamSelected: boolean
  isPictureInPicture: boolean
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

@media (prefers-color-scheme: dark) {
  .controls-row {
    background-color: #252525;
    border-color: #3d3d3d;
  }

  .stream-selector label,
  .playback-rate-control label {
    color: #e0e0e0;
  }

  .stream-selector select,
  .playback-rate-control select,
  .pip-button {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .pip-button:hover:not(:disabled) {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }
}
</style>
