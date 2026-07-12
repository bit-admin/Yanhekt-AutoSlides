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
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.75rem 0.25rem 0.5rem;
  scrollbar-width: thin;
  scroll-behavior: smooth;
}

.strip-thumbnail {
  position: relative;
  flex-shrink: 0;
  width: 160px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1.5px solid var(--border-color);
  background-color: #000000;
  transition: border-color 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
  box-shadow: 0 2px 6px var(--shadow-sm);
  cursor: default;
}

.strip-thumbnail:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px var(--shadow-md);
}

.strip-thumbnail img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.strip-thumbnail:hover img {
  transform: scale(1.06);
}

.strip-time {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 0.25rem;
  background: rgba(15, 15, 15, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.strip-thumbnail:hover .strip-time {
  background: rgba(15, 15, 15, 0.8);
}
</style>
