<template>
  <div class="flex h-full flex-col bg-surface">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b border-line bg-elevated p-4">
      <button class="flex h-9 w-9 items-center justify-center rounded-md border border-line-input bg-surface text-fg-secondary cursor-pointer transition-colors dark:bg-[#2d2d2d]" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div>
        <h2 class="m-0 text-lg font-semibold text-fg">{{ $t('demo.playback.lectureTitle') }}</h2>
        <p class="m-0 mt-1 text-[13px] text-fg-secondary">{{ $t('demo.playback.courseTitle') }}</p>
      </div>
    </div>

    <!-- Video Container -->
    <div class="relative aspect-video max-h-[400px] bg-black">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3 text-[#888]">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          <p class="m-0 text-sm">{{ $t('demo.playback.videoPlaceholder') }}</p>
        </div>
      </div>
    </div>

    <!-- Controls ('controls-section' retained as a Driver.js tour hook) -->
    <div class="controls-section flex items-center justify-between border-b border-line bg-elevated px-4 py-3">
      <div class="flex gap-2">
        <button class="flex h-9 w-9 items-center justify-center rounded-md border border-line-input bg-surface text-fg cursor-pointer dark:bg-[#2d2d2d]" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        </button>
      </div>
      <div class="flex items-center">
        <label class="flex cursor-pointer items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" class="hidden" disabled />
          <span class="relative h-5 w-10 rounded-full bg-[#ccc] transition-colors dark:bg-[#555]">
            <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform"></span>
          </span>
          {{ $t('demo.playback.autoExtract') }}
        </label>
      </div>
    </div>

    <!-- Slide Gallery ('slide-gallery' retained as a Driver.js tour hook) -->
    <div class="slide-gallery flex-1 overflow-y-auto bg-elevated p-4">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="m-0 text-base font-semibold text-fg">{{ $t('demo.playback.extractedSlides') }}</h3>
        <span class="text-[13px] text-fg-secondary">{{ $t('demo.playback.slidesCount', { count: 4 }) }}</span>
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="overflow-hidden rounded-md border border-line bg-surface">
          <div class="flex aspect-video items-center justify-center bg-[#f0f0f0] text-fg-muted dark:bg-[#2a2a2a]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
          <span class="block p-2 text-center text-xs text-fg-secondary">{{ $t('demo.playback.slideLabel', { num: i }) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Demo component - no logic needed
</script>
