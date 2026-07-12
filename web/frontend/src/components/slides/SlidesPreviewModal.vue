<template>
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
          <span v-if="item.status === 'removed'" class="meta-line">
            <strong>{{ $t('trash.filterReason') }}:</strong> {{ reasonText }}
            <template v-if="item.reasonDetails"> — {{ item.reasonDetails }}</template>
          </span>
          <span v-if="item.trashedAt" class="meta-line">
            <strong>{{ $t('trash.trashedAt') }}:</strong> {{ formatDate(item.trashedAt) }}
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
  background: rgba(0, 0, 0, 0.7);
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
  font-weight: 500;
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
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  min-width: 0;
}

.meta-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
</style>
