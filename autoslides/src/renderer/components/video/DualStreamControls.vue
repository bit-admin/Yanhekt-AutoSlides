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
import type { VideoStream } from '@features/video/useVideoPlayer'

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
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
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
  color: var(--text-primary);
}

.stream-selector select {
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
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
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

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
}

.pip-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pip-button:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

.pip-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-input-disabled);
}

.pip-button svg {
  flex-shrink: 0;
}
</style>
