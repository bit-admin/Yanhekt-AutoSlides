<template>
  <div class="flex justify-between items-center p-3 bg-elevated border border-border rounded-t-lg gap-4">
    <div v-if="streamCount > 1" class="flex items-center gap-3">
      <label class="font-medium text-text">{{ $t('playback.selectStream') }}</label>
      <select
        :value="selectedStream"
        @change="onStreamChange($event)"
        :disabled="shouldDisableControls"
        class="py-1.5 px-3 border border-border-input rounded bg-surface text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-elevated focus:outline-none focus:border-accent"
      >
        <option v-if="hasDualStreams" :value="dualStreamKey">
          {{ $t('playback.bothStreams') }}
        </option>
        <option v-for="(stream, key) in streams" :key="key" :value="key">
          {{ stream.type === 'camera' ? $t('playback.streamCamera') : stream.type === 'screen' ? $t('playback.streamScreen') : stream.name }}
        </option>
      </select>
    </div>

    <div v-if="mode === 'recorded'" class="flex items-center gap-2">
      <label class="font-medium text-text whitespace-nowrap">{{ $t('playback.playbackSpeed') }}</label>
      <select
        :value="currentPlaybackRate"
        @change="onRateChange($event)"
        :disabled="shouldDisableControls"
        class="py-1.5 px-3 border border-border-input rounded bg-surface text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-elevated focus:outline-none focus:border-accent"
      >
        <option v-for="rate in playbackRateOptions" :key="rate" :value="rate">{{ rate }}x</option>
      </select>
    </div>

    <div v-if="!isDualStreamSelected" class="flex items-center">
      <button
        class="flex items-center gap-1.5 py-2 px-3 border border-border-input rounded bg-surface text-text text-sm cursor-pointer transition-all hover:bg-elevated hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-elevated [&_svg]:shrink-0"
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
