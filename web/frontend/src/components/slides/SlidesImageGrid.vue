<template>
  <div class="image-grid" :style="{ '--thumb-size': `${thumbnailSize}px` }">
    <div
      v-for="item in items"
      :key="item.id"
      class="image-card"
      :class="{ selected: selectedIds.includes(item.id), removed: item.status === 'removed' }"
      @click="$emit('toggle', item.id)"
    >
      <div class="image-frame">
        <img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="item.name" loading="lazy" />
        <div v-else class="image-placeholder">
          <div class="spinner spinner--sm"></div>
        </div>
        <span v-if="item.status === 'removed'" class="reason-chip" :class="`reason-${item.reason}`">
          {{ reasonLabel(item.reason) }}
        </span>
        <button
          class="zoom-btn"
          :title="$t('trash.preview')"
          @click.stop="$emit('preview', item)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <div class="check-indicator">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
        </div>
      </div>
      <span class="image-name" :title="item.name">{{ item.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Review grid for one folder: extracted + removed slides side by side.
// Clicking a card toggles selection; the zoom button opens the preview modal.
import { useI18n } from 'vue-i18n'
import type { ResultsItem, ResultsReason } from '../../composables/resultsTypes'

defineProps<{
  items: ResultsItem[]
  thumbnails: Record<string, string>
  selectedIds: string[]
  thumbnailSize: number
}>()

defineEmits<{
  toggle: [id: string]
  preview: [item: ResultsItem]
}>()

const { t } = useI18n()

const reasonLabel = (reason?: ResultsReason | '') => {
  switch (reason) {
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
}
</script>

<style scoped>
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 320px), 1fr));
  gap: 0.875rem;
}

.image-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  cursor: pointer;
}

.image-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 0.625rem;
  overflow: hidden;
  border: 2px solid var(--border-color);
  background-color: var(--bg-surface);
  transition: border-color 0.15s;
}

.image-card:hover .image-frame {
  border-color: var(--accent);
}

.image-card.selected .image-frame {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}

.image-card.removed .image-frame {
  opacity: 0.6;
}

.image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background-color: #000000;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reason-chip {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  background-color: var(--danger);
  color: #ffffff;
}

.reason-chip.reason-manual {
  background-color: var(--text-secondary);
}

.reason-chip.reason-exclusion {
  background-color: var(--warning, #e6a23c);
}

.zoom-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.image-card:hover .zoom-btn {
  opacity: 1;
}

.check-indicator {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: var(--accent);
  color: #ffffff;
}

.image-card.selected .check-indicator {
  display: flex;
}

.image-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
