<template>
  <div
    v-if="slide"
    class="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-[4px]"
    @click="$emit('close')"
  >
    <div
      class="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-modal shadow-[0_20px_40px_rgba(0,0,0,0.3)] max-md:max-h-[95vh] max-md:max-w-[95vw]"
      @click.stop
    >
      <div
        class="flex items-center justify-between border-b border-line bg-elevated px-5 py-4 max-md:px-4 max-md:py-3"
      >
        <h3 class="m-0 text-lg font-semibold text-fg">{{ slide.title }}</h3>
        <div class="flex gap-2">
          <button
            @click="$emit('delete', slide)"
            class="flex cursor-pointer items-center gap-1.5 rounded border border-[#dc3545] bg-[#dc3545] px-3 py-1.5 text-[13px] text-white transition-colors hover:border-[#c82333] hover:bg-[#c82333]"
            title="Move slide to trash"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            {{ $t('playback.moveToTrash') }}
          </button>
          <button
            @click="$emit('close')"
            class="flex cursor-pointer items-center gap-1.5 rounded border border-[#6c757d] bg-[#6c757d] px-3 py-1.5 text-[13px] text-white transition-colors hover:border-[#5a6268] hover:bg-[#5a6268]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            {{ $t('playback.close') }}
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-4 p-5 max-md:p-4">
        <img
          :src="slide.dataUrl"
          :alt="slide.title"
          class="max-h-[70vh] max-w-full rounded-lg object-contain shadow-[0_4px_12px_rgba(0,0,0,0.1)] max-md:max-h-[60vh]"
        />
        <div class="rounded-md border border-line bg-elevated p-3">
          <p class="my-1 text-sm text-fg-secondary"><strong class="text-fg">{{ $t('playback.extractedAt') }}</strong> {{ formatSlideTime(slide.timestamp) }}</p>
          <p class="my-1 text-sm text-fg-secondary"><strong class="text-fg">{{ $t('playback.fileName') }}</strong> {{ slide.title }}.png</p>
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
