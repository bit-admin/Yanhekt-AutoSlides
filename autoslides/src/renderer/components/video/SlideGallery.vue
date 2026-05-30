<template>
  <div class="gallery-grid">
    <div
      v-for="slide in slides"
      :key="slide.id"
      class="slide-thumbnail"
      @click="$emit('preview', slide)"
    >
      <img :src="slide.dataUrl" :alt="slide.title" />
      <div class="thumbnail-overlay">
        <div class="slide-info">
          <span class="slide-title">{{ slide.title }}</span>
          <span class="slide-time">{{ formatSlideTime(slide.timestamp) }}</span>
        </div>
        <button
          @click.stop="$emit('delete', slide)"
          class="delete-btn"
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

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.slide-thumbnail {
  position: relative;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e9ecef;
  cursor: pointer;
  transition: all 0.2s;
}

.slide-thumbnail:hover {
  border-color: #007acc;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.slide-thumbnail img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.thumbnail-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.slide-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.slide-title {
  font-size: 12px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slide-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.delete-btn {
  padding: 4px;
  border: none;
  border-radius: 4px;
  background-color: rgba(220, 53, 69, 0.8);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background-color: rgba(220, 53, 69, 1);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .slide-thumbnail img {
    height: 100px;
  }
}

@media (prefers-color-scheme: dark) {
  .slide-thumbnail {
    background-color: #1e1e1e;
    border-color: #3d3d3d;
  }

  .slide-thumbnail:hover {
    border-color: #4a9eff;
  }
}
</style>
