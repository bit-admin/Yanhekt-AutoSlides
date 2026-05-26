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
import type { ResultsItem, ResultsReason } from '../../composables/results/types'

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
  padding: 8px 0;
}

.result-item {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
}

.result-item:hover {
  border-color: #007acc;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.result-item.selected {
  border-color: #007acc;
  box-shadow: 0 0 0 1px #007acc;
}

.result-item.removed {
  opacity: 0.75;
}

.item-checkbox {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  padding: 2px;
}

.item-preview-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  cursor: pointer;
  transition: all 0.15s;
}

.item-preview-btn:hover {
  background: white;
  color: #007acc;
}

.item-thumbnail {
  position: relative;
  width: 100%;
  background-color: #f8f9fa;
  overflow: hidden;
}

.item-thumbnail img {
  width: 100%;
  height: auto;
  display: block;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #adb5bd;
}

.item-copy {
  padding: 8px 10px 10px;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.item-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.removed {
  background-color: #f8d7da;
  color: #721c24;
}

.status-badge.cropped {
  background-color: #fff3cd;
  color: #856404;
}

.reason-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background-color: #e9ecef;
  color: #555;
}

.reason-badge.reason-duplicate {
  background-color: #cfe2ff;
  color: #084298;
}

.reason-badge.reason-exclusion {
  background-color: #f8d7da;
  color: #721c24;
}

.reason-badge.reason-ai_filtered {
  background-color: #e2d9f3;
  color: #432874;
}

.reason-badge.reason-ai_filtered_edit {
  background-color: #d1ecf1;
  color: #0c5460;
}

.reason-badge.reason-manual {
  background-color: #e9ecef;
  color: #495057;
}

@media (prefers-color-scheme: dark) {
  .result-item {
    background-color: #2d2d2d;
    border-color: #3d3d3d;
  }

  .item-checkbox,
  .item-preview-btn {
    background: rgba(50, 50, 50, 0.9);
    color: #e0e0e0;
  }

  .item-thumbnail {
    background-color: #1e1e1e;
  }

  .item-name {
    color: #e0e0e0;
  }
}
</style>
