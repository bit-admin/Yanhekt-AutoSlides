<template>
  <div class="image-grid" :style="{ '--thumb-size': `${thumbnailSize}px` }">
    <div
      v-for="(item, idx) in items"
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
        
        <!-- Trashed/Removed reason badge -->
        <span v-if="item.status === 'removed'" class="reason-chip" :class="`reason-${item.reason}`">
          {{ reasonLabel(item.reason) }}
        </span>

        <!-- Custom animated checkbox overlay (top-left) -->
        <div class="image-checkbox" :class="{ checked: selectedIds.includes(item.id) }">
          <svg class="check-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <!-- Zoom/Preview Button (bottom-right) -->
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
      </div>

      <!-- Human-readable numbering and formatted capture timestamp -->
      <div class="image-info">
        <span class="image-title">{{ $t('trash.slideNumber', { n: idx + 1 }) }}</span>
        <span class="image-time" v-if="getSlideTimeLabel(item.name)">
          {{ getSlideTimeLabel(item.name) }}
        </span>
        <span class="image-filename-fallback" v-else :title="item.name">
          {{ item.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Redesigned Review grid card item layout: Slide numbering (Slide 1, Slide 2),
// captured clock timestamp formatting, custom animated checkboxes on hover,
// and selection mask overlays.
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

// Format the capture time out of a slide filename: recorded slides embed a
// millisecond epoch (Slide_<ms>.png), live slides a wall-clock stamp
// (Slide_YYYY-MM-DD_HH-MM-SS.png).
const getSlideTimeLabel = (name: string): string => {
  const liveMatch = name.match(/^Slide_\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})-(\d{2})/)
  if (liveMatch) {
    return `${liveMatch[1]}:${liveMatch[2]}:${liveMatch[3]}`
  }
  const epochMatch = name.match(/(\d{13,})/)
  if (epochMatch) {
    const date = new Date(parseInt(epochMatch[1], 10))
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  }
  return ''
}
</script>

<style scoped>
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 320px), 1fr));
  gap: 1.25rem;
  padding: 0.5rem 0 2rem;
}

.image-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  position: relative;
}

.image-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 0.625rem;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background-color: #0c0c0c;
  box-shadow: 0 1px 3px var(--shadow-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.image-card:hover .image-frame {
  border-color: var(--border-strong);
  box-shadow: 0 6px 14px var(--shadow-md);
}

.image-card.selected .image-frame {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring), 0 6px 14px var(--shadow-md);
}

.image-card.selected .image-frame::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
  z-index: 1;
  pointer-events: none;
}

.image-card.removed .image-frame {
  opacity: 0.55;
  filter: grayscale(0.2);
}

.image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.image-card:hover .image-frame img {
  transform: scale(1.03);
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Custom Checkbox overlay styling */
.image-checkbox {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 5;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 4px;
  border: 1.5px solid #ffffff;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
}

.image-card:hover .image-checkbox,
.image-checkbox.checked {
  opacity: 1;
}

.image-checkbox.checked {
  background-color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.05);
}

.check-icon {
  opacity: 0;
  transform: scale(0.6);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.image-checkbox.checked .check-icon {
  opacity: 1;
  transform: scale(1);
}

.reason-chip {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  z-index: 4;
}

/* When removed reason is shown, shift checkbox down a bit to avoid overlap */
.image-card.removed .image-checkbox {
  top: 2rem;
}

.reason-duplicate {
  background-color: color-mix(in srgb, var(--warning) 12%, var(--bg-surface));
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
}

.reason-exclusion {
  background-color: color-mix(in srgb, var(--danger) 12%, var(--bg-surface));
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.reason-ai_filtered,
.reason-ai_filtered_edit {
  background-color: color-mix(in srgb, var(--accent-deep) 12%, var(--bg-surface));
  color: var(--accent-deep);
  border: 1px solid color-mix(in srgb, var(--accent-deep) 25%, transparent);
}

.reason-manual {
  background-color: color-mix(in srgb, var(--text-secondary) 12%, var(--bg-surface));
  color: var(--text-secondary);
  border: 1px solid color-mix(in srgb, var(--text-secondary) 25%, transparent);
}

.zoom-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9);
  transition: all 0.2s ease;
  z-index: 4;
}

.image-card:hover .zoom-btn {
  opacity: 1;
  transform: scale(1);
}

.zoom-btn:hover {
  background-color: rgba(0, 0, 0, 0.85);
  transform: scale(1.1) !important;
}

/* Card details caption */
.image-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.125rem 0.25rem;
  text-align: left;
}

.image-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.image-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.image-filename-fallback {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
