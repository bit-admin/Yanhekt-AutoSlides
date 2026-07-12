<template>
  <Transition name="modal-fade">
    <div v-if="item" class="preview-overlay" @click.self="$emit('close')">
      <div class="preview-content">
        <div class="preview-header">
          <span class="preview-title" :title="item.name">{{ item.name }}</span>
          <button class="preview-close" :title="$t('playback.close')" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="preview-body">
          <img v-if="imageUrl" :src="imageUrl" :alt="item.name" />
        </div>

        <div class="preview-footer">
          <div class="preview-meta">
            <div class="meta-badge-row">
              <span class="badge" :class="`badge--${item.status}`">
                {{ item.status === 'active' ? $t('trash.active') : $t('trash.removed') }}
              </span>
              <span v-if="item.status === 'removed'" class="reason-pill" :class="`reason-${item.reason}`">
                {{ reasonText }}
              </span>
            </div>
            <span v-if="item.status === 'removed' && item.reasonDetails" class="meta-line details">
              {{ item.reasonDetails }}
            </span>
            <span v-if="item.trashedAt" class="meta-line date">
              {{ $t('trash.trashedAt') }}: {{ formatDate(item.trashedAt) }}
            </span>
          </div>
          <div class="preview-actions">
            <button
              v-if="item.status === 'removed'"
              class="btn btn--primary"
              @click="$emit('restore', item)"
            >
              {{ $t('trash.restore') }}
            </button>
            <button
              v-else
              class="btn btn--danger"
              @click="$emit('delete', item)"
            >
              {{ $t('trash.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// Full-size slide preview with restore/delete. Reuses the grid's object URL
// (full resolution — thumbnails on the web are the original blobs).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ResultsItem } from '../../composables/resultsTypes'

const props = defineProps<{
  item: ResultsItem | null
  thumbnails: Record<string, string>
  formatDate: (value?: string) => string
}>()

defineEmits<{
  close: []
  restore: [item: ResultsItem]
  delete: [item: ResultsItem]
}>()

const { t } = useI18n()

const imageUrl = computed(() => (props.item ? props.thumbnails[props.item.id] ?? '' : ''))

const reasonText = computed(() => {
  switch (props.item?.reason) {
    case 'duplicate':
      return t('trash.duplicate')
    case 'exclusion':
      return t('trash.exclusion')
    case 'ai_filtered':
      return t('trash.aiFilteredNotSlide')
    case 'ai_filtered_edit':
      return t('trash.aiFilteredEdit')
    case 'manual':
      return t('trash.manual')
    default:
      return ''
  }
})
</script>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 2rem;
}

.preview-content {
  display: flex;
  flex-direction: column;
  max-width: min(1100px, 92vw);
  max-height: 90vh;
  border-radius: 0.75rem;
  overflow: hidden;
  background-color: var(--bg-elevated, var(--bg-surface));
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 50px var(--shadow-lg);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-close:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000000;
}

.preview-body img {
  max-width: 100%;
  max-height: min(70vh, 900px);
  object-fit: contain;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  min-width: 0;
}

.meta-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reason-pill {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.reason-pill.reason-duplicate {
  background-color: var(--reason-duplicate-bg, #fff3e0);
  color: var(--reason-duplicate-text, #e65100);
}

.reason-pill.reason-exclusion {
  background-color: var(--reason-exclusion-bg, #ede7ff);
  color: var(--reason-exclusion-text, #6546c2);
}

.reason-pill.reason-ai_filtered {
  background-color: var(--reason-ai-bg, #dff7ea);
  color: var(--reason-ai-text, #257550);
}

.reason-pill.reason-ai_filtered_edit {
  background-color: var(--reason-ai-edit-bg, #fff3d6);
  color: var(--reason-ai-edit-text, #955800);
}

.reason-pill.reason-manual {
  background-color: var(--badge-removed-bg, #ffe8e6);
  color: var(--badge-removed-text, #cc0000);
}

.meta-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-line.details {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.meta-line.date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Modal Vue Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .preview-content,
.modal-fade-leave-active .preview-content {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .preview-content,
.modal-fade-leave-to .preview-content {
  transform: translateY(20px);
  opacity: 0;
}
</style>
