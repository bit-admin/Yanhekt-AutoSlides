<template>
  <div
    class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] max-md:gap-3 max-md:[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]"
  >
    <div
      v-for="slide in slides"
      :key="slide.id"
      class="group relative cursor-pointer overflow-hidden rounded-lg border-2 border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
      @click="$emit('preview', slide)"
    >
      <img :src="slide.dataUrl" :alt="slide.title" class="block h-[120px] w-full object-cover max-md:h-[100px]" />
      <div class="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-2">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate text-xs font-medium text-white">{{ slide.title }}</span>
          <span class="text-[11px] text-white/80">{{ formatSlideTime(slide.timestamp) }}</span>
        </div>
        <button
          @click.stop="$emit('delete', slide)"
          class="flex-shrink-0 cursor-pointer rounded border-none bg-[rgba(220,53,69,0.8)] p-1 text-white transition-all hover:scale-110 hover:bg-[rgb(220,53,69)]"
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
