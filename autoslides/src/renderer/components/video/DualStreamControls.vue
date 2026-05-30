<template>
  <div class="flex items-center justify-between gap-4 rounded-t-lg border border-line bg-elevated p-3">
    <div v-if="streamCount > 1" class="flex items-center gap-3">
      <label class="whitespace-nowrap font-medium text-fg">{{ $t('playback.selectStream') }}</label>
      <select
        :class="selCls"
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

    <div v-if="mode === 'recorded'" class="flex items-center gap-2">
      <label class="whitespace-nowrap font-medium text-fg">{{ $t('playback.playbackSpeed') }}</label>
      <select
        :class="selCls"
        :value="currentPlaybackRate"
        @change="onRateChange($event)"
        :disabled="shouldDisableControls"
      >
        <option v-for="rate in playbackRateOptions" :key="rate" :value="rate">{{ rate }}x</option>
      </select>
    </div>

    <div v-if="!isDualStreamSelected" class="flex items-center">
      <button
        class="flex cursor-pointer items-center gap-1.5 rounded border border-line-input bg-field px-3 py-2 text-sm text-fg transition-all enabled:hover:border-accent enabled:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('togglePictureInPicture')"
        :disabled="shouldDisableControls || !videoPlayerReady"
        :title="isPictureInPicture ? $t('playback.exitPictureInPicture') : $t('playback.enterPictureInPicture')"
      >
        <svg class="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 1px;">
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

const selCls = 'rounded border border-line-input bg-field px-3 py-1.5 text-sm text-fg cursor-pointer focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

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

