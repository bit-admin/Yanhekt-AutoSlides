<template>
  <div v-if="slide" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-modal" @click="$emit('close')">
    <div class="bg-modal rounded-xl max-w-[90vw] max-h-[90vh] overflow-hidden shadow-2xl max-[768px]:max-w-[95vw] max-[768px]:max-h-[95vh]" @click.stop>
      <div class="flex justify-between items-center px-5 py-4 border-b border-border bg-elevated max-[768px]:px-4 max-[768px]:py-3">
        <h3 class="m-0 text-lg font-semibold text-text">{{ slide.title }}</h3>
        <div class="flex gap-2">
          <button @click="$emit('delete', slide)" class="flex items-center gap-1.5 py-1.5 px-3 border border-danger bg-danger text-white text-[13px] rounded cursor-pointer transition-all hover:bg-danger-hover hover:border-danger-hover" title="Move slide to trash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            {{ $t('playback.moveToTrash') }}
          </button>
          <button @click="$emit('close')" class="flex items-center gap-1.5 py-1.5 px-3 border border-border-strong bg-border-strong text-white text-[13px] rounded cursor-pointer transition-all hover:bg-text-muted hover:border-text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            {{ $t('playback.close') }}
          </button>
        </div>
      </div>
      <div class="p-5 flex flex-col gap-4 max-[768px]:p-4">
        <img :src="slide.dataUrl" :alt="slide.title" class="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg max-[768px]:max-h-[60vh]" />
        <div class="p-3 bg-elevated rounded-md border border-border">
          <p class="my-1 text-sm text-text-secondary"><strong class="text-text">{{ $t('playback.extractedAt') }}</strong> {{ formatSlideTime(slide.timestamp) }}</p>
          <p class="my-1 text-sm text-text-secondary"><strong class="text-text">{{ $t('playback.fileName') }}</strong> {{ slide.title }}.png</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExtractedSlide } from '@shared/processing'

defineProps<{
  slide: ExtractedSlide | null
  formatSlideTime: (timestamp: string) => string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'delete', slide: ExtractedSlide): void
}>()
</script>
