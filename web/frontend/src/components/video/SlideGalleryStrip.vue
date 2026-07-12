<template>
  <div class="gallery-strip custom-scrollbar">
    <div
      v-for="slide in slides"
      :key="slide.id"
      class="strip-thumbnail"
      :title="slide.title"
    >
      <img :src="slide.dataUrl" :alt="slide.title" />
      <span class="strip-time">{{ formatSlideTime(slide.timestamp) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Collapsible-strip variant of the desktop SlideGallery
// (autoslides/src/renderer/components/video/SlideGallery.vue): a horizontal
// thumbnail rail under the player instead of a grid. Review/delete happens on
// the Slides page, so thumbnails are display-only.
import type { ExtractedSlide } from '../../lib/processing'

defineProps<{
  slides: ExtractedSlide[]
}>()

const formatSlideTime = (timestamp: string): string => {
  try {
    const d = new Date(timestamp)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  } catch {
    return timestamp
  }
}
</script>

<style scoped>
.gallery-strip {
  display: flex;
  gap: 0.625rem;
  overflow-x: auto;
  padding: 0.625rem 0 0.375rem;
}

.strip-thumbnail {
  position: relative;
  flex-shrink: 0;
  width: 160px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background-color: var(--bg-surface);
  transition: border-color 0.2s;
}

.strip-thumbnail:hover {
  border-color: var(--accent);
}

.strip-thumbnail img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}

.strip-time {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  font-size: 0.6875rem;
  line-height: 1.4;
}
</style>
