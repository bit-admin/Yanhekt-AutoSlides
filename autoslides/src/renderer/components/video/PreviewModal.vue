<template>
  <div v-if="slide" class="slide-modal" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ slide.title }}</h3>
        <div class="modal-actions">
          <button @click="$emit('delete', slide)" class="modal-delete-btn" title="Move slide to trash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            {{ $t('playback.moveToTrash') }}
          </button>
          <button @click="$emit('close')" class="modal-close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            {{ $t('playback.close') }}
          </button>
        </div>
      </div>
      <div class="modal-body">
        <img :src="slide.dataUrl" :alt="slide.title" class="modal-image" />
        <div class="slide-metadata">
          <p><strong>{{ $t('playback.extractedAt') }}</strong> {{ formatSlideTime(slide.timestamp) }}</p>
          <p><strong>{{ $t('playback.fileName') }}</strong> {{ slide.title }}.png</p>
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

<style scoped>
.slide-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: var(--bg-modal);
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  gap: 8px;
}

.modal-delete-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--danger);
  border-radius: 4px;
  background-color: var(--danger);
  color: var(--text-on-accent);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-delete-btn:hover {
  background-color: var(--danger-hover);
  border-color: var(--danger-hover);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background-color: var(--border-strong);
  color: var(--text-on-accent);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background-color: var(--text-muted);
  border-color: var(--text-muted);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-sm);
}

.slide-metadata {
  padding: 12px;
  background-color: var(--bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.slide-metadata p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.slide-metadata strong {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 95vw;
    max-height: 95vh;
  }

  .modal-header {
    padding: 12px 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-image {
    max-height: 60vh;
  }
}
</style>
