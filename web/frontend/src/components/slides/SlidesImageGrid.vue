<template>
  <div class="image-grid" :style="{ '--thumb-size': `${thumbnailSize}px` }">
    <div
      v-for="(item, idx) in items"
      :key="item.id"
      class="image-card"
      :class="{
        selected: selectedIds.includes(item.id),
        removed: item.status === 'removed',
        'selection-mode': selectionActive,
      }"
      @click="onCardClick(item)"
      @dblclick.prevent="onCardDblClick(item)"
    >
      <div class="image-frame">
        <img v-if="thumbUrl(item)" :src="thumbUrl(item)" :alt="item.name" loading="lazy" />
        <div v-else class="image-placeholder">
          <div class="spinner spinner--sm"></div>
        </div>

        <span v-if="item.status === 'removed'" class="reason-chip" :class="`reason-${item.reason}`">
          {{ reasonLabel(item.reason) }}
        </span>

        <div class="image-checkbox" :class="{ checked: selectedIds.includes(item.id) }">
          <svg class="check-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <div class="image-info">
        <div class="image-meta">
          <span class="image-title">{{ $t('trash.slideNumber', { n: idx + 1 }) }}</span>
          <span class="image-time" v-if="getSlideTimeLabel(item.name)">
            {{ getSlideTimeLabel(item.name) }}
          </span>
        </div>
        <button
          type="button"
          class="image-action"
          :class="{ 'image-action--restore': item.status === 'removed' }"
          :title="item.status === 'removed' ? $t('trash.restore') : $t('trash.delete')"
          :aria-label="item.status === 'removed' ? $t('trash.restore') : $t('trash.delete')"
          @click.stop="onRowAction(item)"
        >
          <template v-if="item.status === 'removed'">
            {{ $t('trash.restore') }}
          </template>
          <template v-else>
            <!-- Quiet trash icon; label available via title/aria -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// iCloud-style tiles: blue-border selection, double-click to preview,
// per-row restore/delete at the far right of the caption.
import { onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ResultsItem, ResultsReason } from '../../composables/resultsTypes'

const props = withDefaults(
  defineProps<{
    items: ResultsItem[]
    thumbnails: Record<string, string>
    selectedIds: string[]
    thumbnailSize: number
    selectionActive?: boolean
  }>(),
  { selectionActive: false },
)

const emit = defineEmits<{
  toggle: [id: string]
  preview: [item: ResultsItem]
  restore: [item: ResultsItem]
  delete: [item: ResultsItem]
}>()

const { t } = useI18n()

// Distinguish single-click (select) from double-click (preview).
const DBLCLICK_MS = 280
let clickTimer: ReturnType<typeof setTimeout> | null = null

function clearClickTimer() {
  if (clickTimer !== null) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
}

function onCardClick(item: ResultsItem) {
  clearClickTimer()
  clickTimer = setTimeout(() => {
    clickTimer = null
    emit('toggle', item.id)
  }, DBLCLICK_MS)
}

function onCardDblClick(item: ResultsItem) {
  clearClickTimer()
  emit('preview', item)
}

function onRowAction(item: ResultsItem) {
  clearClickTimer()
  if (item.status === 'removed') emit('restore', item)
  else emit('delete', item)
}

onUnmounted(clearClickTimer)

// Thumbnails are path-keyed (folder/filename). Removed rows use a trash UUID
// as item.id, so look up via trashPath/originalPath/imagePath instead.
const thumbUrl = (item: ResultsItem): string => {
  const key =
    item.status === 'removed'
      ? item.trashPath || item.originalPath
      : item.imagePath || item.originalPath || item.id
  return (key && props.thumbnails[key]) || ''
}

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
  grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 280px), 1fr));
  gap: 0.65rem;
  padding: 0.15rem 0 0.5rem;
}

.image-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  cursor: pointer;
  position: relative;
  min-width: 0;
}

.image-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 0.4rem;
  overflow: hidden;
  border: 2px solid transparent;
  background-color: var(--st-media-well, #f0f0f2);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
  box-sizing: border-box;
}

.image-card:hover .image-frame {
  border-color: rgba(0, 0, 0, 0.08);
}

.image-card.selected .image-frame {
  /* iCloud Photos blue selection border */
  border-color: var(--st-accent, #0071e3);
  box-shadow: 0 0 0 1px var(--st-selection-ring, rgba(0, 113, 227, 0.35));
}

.image-card.removed .image-frame {
  opacity: 0.55;
  filter: grayscale(0.12);
}

.image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-checkbox {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  z-index: 5;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  background-color: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: opacity 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;
  opacity: 0;
}

.image-card:hover .image-checkbox,
.image-card.selection-mode .image-checkbox,
.image-checkbox.checked {
  opacity: 1;
}

.image-checkbox.checked {
  background-color: var(--st-accent, #0071e3);
  border-color: var(--st-accent, #0071e3);
}

.check-icon {
  opacity: 0;
  transform: scale(0.65);
  transition: all 0.12s ease;
}

.image-checkbox.checked .check-icon {
  opacity: 1;
  transform: scale(1);
}

.reason-chip {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.35;
  z-index: 4;
  max-width: calc(100% - 2.2rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.reason-duplicate {
  background-color: color-mix(in srgb, #ff9f0a 18%, #fff);
  color: #9a5b00;
}

.reason-exclusion {
  background-color: color-mix(in srgb, #bf5af2 16%, #fff);
  color: #6b2a99;
}

.reason-ai_filtered,
.reason-ai_filtered_edit {
  background-color: color-mix(in srgb, var(--st-accent, #0071e3) 14%, #fff);
  color: var(--st-accent, #0071e3);
}

.reason-manual {
  background-color: color-mix(in srgb, var(--st-danger, #ff3b30) 14%, #fff);
  color: var(--st-danger, #ff3b30);
}

/* Caption row: title/time left, delete/restore far right */
.image-info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.1rem;
  min-width: 0;
}

.image-meta {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  flex: 1;
}

.image-title {
  font-size: 0.75rem;
  font-weight: 550;
  color: var(--st-text, #1d1d1f);
}

.image-time {
  font-size: 0.6875rem;
  color: var(--st-text-secondary, #6e6e73);
}

.image-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.4rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--st-text-muted, #86868b);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.image-card:hover .image-action,
.image-card:focus-within .image-action {
  opacity: 1;
}

.image-action:hover {
  background: color-mix(in srgb, var(--st-danger, #ff3b30) 10%, transparent);
  color: var(--st-danger, #ff3b30);
}

.image-action--restore:hover {
  background: color-mix(in srgb, var(--st-accent, #0071e3) 10%, transparent);
  color: var(--st-accent, #0071e3);
}

@media (hover: none) {
  .image-checkbox,
  .image-action {
    opacity: 0.95;
  }
}
</style>
