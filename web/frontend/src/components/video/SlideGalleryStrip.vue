<template>
  <div class="gallery-strip custom-scrollbar">
    <div
      v-for="(slide, index) in slides"
      :key="slide.id"
      class="strip-thumbnail"
      role="button"
      tabindex="0"
      :title="slide.title"
      @click="openPreview(index)"
      @keydown.enter.prevent="openPreview(index)"
      @keydown.space.prevent="openPreview(index)"
    >
      <img :src="slide.dataUrl" :alt="slide.title" draggable="false" />
      <span class="strip-time">{{ formatSlideTime(slide.timestamp) }}</span>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="previewIndex !== null && previewSlide"
      class="strip-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="previewSlide.title"
      @click.self="closePreview"
    >
      <button
        type="button"
        class="lightbox-close"
        :title="$t('playback.close')"
        :aria-label="$t('playback.close')"
        @click="closePreview"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <button
        v-if="slides.length > 1"
        type="button"
        class="lightbox-nav lightbox-nav--prev"
        :title="$t('trash.prevSlide')"
        :aria-label="$t('trash.prevSlide')"
        @click.stop="stepPreview(-1)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div class="lightbox-stage" @click.self="closePreview">
        <img
          class="lightbox-image"
          :src="previewSlide.dataUrl"
          :alt="previewSlide.title"
          draggable="false"
        />
      </div>

      <button
        v-if="slides.length > 1"
        type="button"
        class="lightbox-nav lightbox-nav--next"
        :title="$t('trash.nextSlide')"
        :aria-label="$t('trash.nextSlide')"
        @click.stop="stepPreview(1)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div class="lightbox-meta">
        <span class="lightbox-title">{{ previewSlide.title }}</span>
        <span class="lightbox-time">{{ formatSlideTime(previewSlide.timestamp) }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Collapsible-strip variant of the desktop SlideGallery
// (autoslides/src/renderer/components/video/SlideGallery.vue): a horizontal
// thumbnail rail under the player instead of a grid. Click opens a full-screen
// letterbox preview; review/delete still lives on the Slides page.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ExtractedSlide } from '../../lib/processing'

const props = defineProps<{
  slides: ExtractedSlide[]
}>()

const previewIndex = ref<number | null>(null)

const previewSlide = computed(() => {
  if (previewIndex.value === null) return null
  return props.slides[previewIndex.value] ?? null
})

const formatSlideTime = (timestamp: string): string => {
  const d = new Date(timestamp)
  if (!Number.isNaN(d.getTime()) && /^\d{4}-/.test(timestamp)) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }
  return timestamp
}

function openPreview(index: number): void {
  if (index < 0 || index >= props.slides.length) return
  previewIndex.value = index
}

function closePreview(): void {
  previewIndex.value = null
}

function stepPreview(delta: number): void {
  if (previewIndex.value === null || props.slides.length === 0) return
  const next = (previewIndex.value + delta + props.slides.length) % props.slides.length
  previewIndex.value = next
}

function onKeydown(event: KeyboardEvent): void {
  if (previewIndex.value === null) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closePreview()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    stepPreview(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    stepPreview(1)
  }
}

// Keep index valid if the strip shrinks while the lightbox is open.
watch(
  () => props.slides.length,
  (len) => {
    if (previewIndex.value === null) return
    if (len === 0) {
      previewIndex.value = null
      return
    }
    if (previewIndex.value >= len) {
      previewIndex.value = len - 1
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
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
  cursor: pointer;
}

.strip-thumbnail:hover,
.strip-thumbnail:focus-visible {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px var(--shadow-md);
  outline: none;
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

/* Full-screen letterbox preview */
.strip-lightbox {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 4rem 3.25rem;
}

.lightbox-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 0.35rem;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
  user-select: none;
  -webkit-user-drag: none;
}

.lightbox-close,
.lightbox-nav {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(20, 20, 20, 0.72);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.lightbox-close:hover,
.lightbox-nav:hover {
  background: rgba(40, 40, 40, 0.9);
  border-color: rgba(255, 255, 255, 0.28);
}

.lightbox-close {
  top: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  z-index: 2;
}

.lightbox-nav {
  top: 50%;
  transform: translateY(-50%);
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  z-index: 2;
}

.lightbox-nav:hover {
  transform: translateY(-50%) scale(1.04);
}

.lightbox-nav--prev {
  left: 1rem;
}

.lightbox-nav--next {
  right: 1rem;
}

.lightbox-meta {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: min(90vw, 40rem);
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  background: rgba(15, 15, 15, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 0.8125rem;
  line-height: 1.3;
  pointer-events: none;
}

.lightbox-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.lightbox-time {
  flex-shrink: 0;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
</style>
