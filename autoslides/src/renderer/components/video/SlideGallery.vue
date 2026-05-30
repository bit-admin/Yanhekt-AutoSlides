<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 max-[768px]:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] max-[768px]:gap-3">
    <div
      v-for="slide in slides"
      :key="slide.id"
      class="relative bg-surface rounded-lg overflow-hidden border-2 border-border cursor-pointer transition-all hover:border-accent hover:-translate-y-0.5 hover:shadow-lg"
      @click="$emit('preview', slide)"
    >
      <img :src="slide.dataUrl" :alt="slide.title" class="w-full h-[120px] object-cover block max-[768px]:h-[100px]" />
      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex justify-between items-end">
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <span class="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">{{ slide.title }}</span>
          <span class="text-[11px] text-white/80">{{ formatSlideTime(slide.timestamp) }}</span>
        </div>
        <button
          @click.stop="$emit('delete', slide)"
          class="p-1 border-none rounded bg-danger/80 text-white cursor-pointer transition-all hover:bg-danger hover:scale-110 shrink-0"
          :title="`Move ${slide.title} to trash`"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExtractedSlide } from '@shared/processing'

defineProps<{
  slides: ExtractedSlide[]
  formatSlideTime: (timestamp: string) => string
}>()

defineEmits<{
  (e: 'preview', slide: ExtractedSlide): void
  (e: 'delete', slide: ExtractedSlide): void
}>()
</script>
