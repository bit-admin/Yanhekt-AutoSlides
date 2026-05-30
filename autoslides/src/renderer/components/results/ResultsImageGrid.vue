<template>
  <div class="results-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
    <div
      v-for="item in items"
      :key="item.id"
      class="result-item"
      :class="{
        selected: selectedIds.includes(item.id),
        removed: item.status === 'removed'
      }"
      @click="$emit('toggleSelection', item.id)"
    >
      <div class="item-checkbox">
        <input
          type="checkbox"
          :checked="selectedIds.includes(item.id)"
          @click.stop
          @change="$emit('toggleSelection', item.id)"
        />
      </div>

      <button class="item-preview-btn" @click.stop="$emit('preview', item)" :title="$t('trash.preview')">
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M2 2v5h2V4h3V2H2zm9 0v2h3v3h2V2h-5zM4 11H2v5h5v-2H4v-3zm10 0v3h-3v2h5v-5h-2z" fill="currentColor"/>
        </svg>
      </button>

      <div class="item-thumbnail">
        <img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="item.name" />
        <div v-else class="thumbnail-placeholder">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
          </svg>
        </div>
      </div>

      <div class="item-copy">
        <div class="item-name">{{ formatImageName(item.name) }}</div>
        <div class="item-badges">
          <span v-if="item.status === 'active' && item.isCropped" class="status-badge cropped">{{ getCropLabel(item) }}</span>
          <span class="status-badge" :class="item.status">{{ getStatusLabel(item.status) }}</span>
          <span
            v-if="item.status === 'removed' && item.reason"
            :class="['reason-badge', `reason-${item.reason}`]"
          >
            {{ getReasonLabel(item.reason) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ResultsItem, ResultsReason } from '@features/results/resultsTypes'

defineProps<{
  items: ResultsItem[]
  selectedIds: string[]
  thumbnails: Record<string, string>
  thumbnailSize: number
}>()

defineEmits<{
  (e: 'toggleSelection', id: string): void
  (e: 'preview', item: ResultsItem): void
}>()

const { t } = useI18n()

const formatImageName = (name: string): string => {
  return name.replace(/\.png$/i, '')
}

const getReasonLabel = (reason: ResultsReason) => {
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
      return reason
  }
}

const getStatusLabel = (status: 'active' | 'removed') => {
  return status === 'active' ? t('trash.active') : t('trash.removed')
}

const getCropLabel = (item: ResultsItem) => {
  return item.isAutoCropped ? t('trash.autoCropped') : t('trash.cropped')
}
</script>

<style scoped>
.results-grid {
  display: grid;
  gap: 16px;
}

.result-item {
  position: relative;
  background-color: var(--bg-surface);
  border: 2px solid var(--bg-hover);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px var(--shadow-sm);
}

.result-item.selected {
  border-color: var(--accent);
  background-color: var(--badge-active-bg);
}

.result-item.removed {
  border-color: var(--danger);
}

.result-item.removed.selected {
  background-color: var(--danger-bg);
  border-color: var(--danger);
}

.item-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: var(--z-base);
}

.item-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.item-preview-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: var(--z-base);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: var(--bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail-placeholder {
  color: var(--text-muted);
}

.item-copy {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-badges {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.status-badge,
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
}

.status-badge.active {
  background-color: var(--badge-active-bg);
  color: var(--badge-active-text);
}

.status-badge.cropped {
  background-color: var(--badge-cropped-bg);
  color: var(--badge-cropped-text);
}

.status-badge.removed {
  background-color: var(--badge-removed-bg);
  color: var(--badge-removed-text);
}

.reason-badge.reason-duplicate {
  background-color: #fff2cc;
  color: #8a5b00;
}

.reason-badge.reason-exclusion {
  background-color: #ede7ff;
  color: #6546c2;
}

.reason-badge.reason-ai_filtered {
  background-color: #dff7ea;
  color: #257550;
}

.reason-badge.reason-ai_filtered_edit {
  background-color: #fff3d6;
  color: #955800;
}

.reason-badge.reason-manual {
  background-color: var(--badge-removed-bg);
  color: var(--badge-removed-text);
}
</style>
