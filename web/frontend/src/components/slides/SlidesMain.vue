<template>
  <section class="sm-main">
    <!-- Empty: no folder selected / no albums -->
    <div v-if="!hasFolder" class="sm-empty-main">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <p class="sm-empty-title">{{ emptyLibrary ? $t('slides.emptyLibrary') : $t('slides.selectAlbum') }}</p>
      <p v-if="emptyLibrary" class="sm-empty-hint">{{ $t('slides.emptyLibraryHint') }}</p>
    </div>

    <template v-else>
      <!-- iCloud-style main toolbar: filters + size control left, actions right -->
      <div class="sm-toolbar">
        <div class="sm-toolbar-left">
          <div class="sm-segments" role="tablist" :aria-label="$t('trash.viewMode')">
            <button
              type="button"
              role="tab"
              class="sm-seg"
              :class="{ active: contextMode === 'context' }"
              :aria-selected="contextMode === 'context'"
              @click="$emit('update:contextMode', 'context')"
            >
              {{ $t('slides.viewAll') }}
            </button>
            <button
              type="button"
              role="tab"
              class="sm-seg"
              :class="{ active: contextMode === 'extracted-only' }"
              :aria-selected="contextMode === 'extracted-only'"
              @click="$emit('update:contextMode', 'extracted-only')"
            >
              {{ $t('slides.viewKept') }}
            </button>
            <button
              type="button"
              role="tab"
              class="sm-seg"
              :class="{ active: contextMode === 'removed-only' }"
              :aria-selected="contextMode === 'removed-only'"
              @click="$emit('update:contextMode', 'removed-only')"
            >
              {{ $t('slides.viewRemoved') }}
            </button>
          </div>

          <!-- Size control: −  slider  +  (iCloud top-bar position) -->
          <div class="sm-size" :title="$t('slides.thumbnailSize')">
            <button
              type="button"
              class="sm-size-btn"
              :disabled="thumbnailSize <= sizeMin"
              :aria-label="$t('slides.sizeSmaller')"
              @click="nudgeSize(-sizeStep)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" fill="currentColor" opacity="0.7" />
              </svg>
            </button>
            <input
              class="sm-size-slider"
              type="range"
              :min="sizeMin"
              :max="sizeMax"
              :step="sizeStep"
              :value="thumbnailSize"
              @input="onThumbSize"
            />
            <button
              type="button"
              class="sm-size-btn"
              :disabled="thumbnailSize >= sizeMax"
              :aria-label="$t('slides.sizeLarger')"
              @click="nudgeSize(sizeStep)"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="sm-toolbar-right">
          <template v-if="selectedIds.length > 0">
            <span class="sm-sel-count">{{ $t('slides.selectedCount', { n: selectedIds.length }) }}</span>
            <button
              type="button"
              class="sm-btn"
              :disabled="selectedRemovedCount === 0 || loading"
              @click="$emit('restore')"
            >
              {{ $t('trash.restore') }}
            </button>
            <button
              type="button"
              class="sm-btn sm-btn--quiet-danger"
              :disabled="selectedActiveCount === 0 || loading"
              @click="$emit('delete')"
            >
              {{ $t('trash.delete') }}
            </button>
            <button type="button" class="sm-btn" @click="$emit('clear-selection')">
              {{ $t('trash.clearSelection') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="sm-btn"
            :disabled="items.length === 0"
            @click="$emit('toggle-select-all')"
          >
            {{ $t('trash.selectAll') }}
          </button>

          <div class="sm-export-wrap">
            <button
              type="button"
              class="sm-btn"
              :disabled="exportDisabled"
              @click="exportMenuOpen = !exportMenuOpen"
            >
              <span v-if="exportingFormat" class="sm-export-progress">
                <span class="sm-spinner" />
                {{ exportProgress.current }}/{{ exportProgress.total }}
              </span>
              <template v-else>
                {{ $t('slides.export') }}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </template>
            </button>
            <div v-if="exportMenuOpen && !exportingFormat" class="sm-export-menu" @click.stop>
              <button type="button" :disabled="exportDisabled" @click="pickExport('pdf')">
                {{ $t('slides.exportPdf') }}
              </button>
              <button type="button" :disabled="exportDisabled" @click="pickExport('zip')">
                {{ $t('slides.exportZip') }}
              </button>
            </div>
          </div>

          <button
            v-if="hasRemovedItems"
            type="button"
            class="sm-btn sm-btn--quiet-danger"
            :disabled="loading"
            @click="$emit('clear-folder-trash')"
          >
            {{ $t('trash.clearTrash') }}
          </button>
        </div>
      </div>

      <!-- Reason chips only when viewing removed context (keeps All/Kept clean) -->
      <div v-if="contextMode === 'removed-only' || (contextMode === 'context' && hasRemovedItems)" class="sm-reasons" role="group" :aria-label="$t('trash.filterReason')">
        <button
          v-for="opt in reasonOptions"
          :key="opt.value || 'all'"
          type="button"
          class="sm-chip"
          :class="{ active: selectedReason === opt.value }"
          @click="$emit('update:selectedReason', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Album title -->
      <div class="sm-heading">
        <h1 class="sm-title">{{ title }}</h1>
        <p v-if="subtitle" class="sm-sub">{{ subtitle }}</p>
      </div>

      <div class="sm-grid-scroll custom-scrollbar">
        <div v-if="items.length === 0 && !loading" class="sm-empty-grid">
          <p>{{ emptyMessage }}</p>
        </div>
        <SlidesImageGrid
          v-else
          :items="items"
          :thumbnails="thumbnails"
          :selected-ids="selectedIds"
          :thumbnail-size="thumbnailSize"
          :selection-active="selectedIds.length > 0"
          @toggle="$emit('toggle', $event)"
          @preview="$emit('preview', $event)"
          @restore="$emit('restore-item', $event)"
          @delete="$emit('delete-item', $event)"
        />
      </div>

      <div class="sm-status">
        <span>{{ $t('slides.slideCount', { n: items.length }) }}</span>
        <span v-if="selectedIds.length > 0" class="sm-status-sep">·</span>
        <span v-if="selectedIds.length > 0">{{ $t('slides.selectedCount', { n: selectedIds.length }) }}</span>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
// iCloud Photos–style main pane: top density control, selection actions, 16:9 grid host.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlidesImageGrid from './SlidesImageGrid.vue'
import type { ContextMode, ResultsItem, ResultsReason } from '../../composables/resultsTypes'
import type { ExportFormat } from '../../composables/useSlidesExport'

const sizeMin = 180
const sizeMax = 640
const sizeStep = 20

const props = defineProps<{
  hasFolder: boolean
  emptyLibrary: boolean
  title: string
  subtitle: string
  items: ResultsItem[]
  thumbnails: Record<string, string>
  selectedIds: string[]
  thumbnailSize: number
  contextMode: ContextMode
  selectedReason: ResultsReason | ''
  loading: boolean
  hasRemovedItems: boolean
  selectedActiveCount: number
  selectedRemovedCount: number
  exportDisabled: boolean
  exportingFormat: ExportFormat | null
  exportProgress: { current: number; total: number }
  allSelected: boolean
  emptyMessage: string
}>()

const emit = defineEmits<{
  'update:contextMode': [mode: ContextMode]
  'update:selectedReason': [reason: ResultsReason | '']
  'update:thumbnailSize': [size: number]
  toggle: [id: string]
  preview: [item: ResultsItem]
  'restore-item': [item: ResultsItem]
  'delete-item': [item: ResultsItem]
  'toggle-select-all': []
  restore: []
  delete: []
  'clear-selection': []
  export: [format: ExportFormat]
  'clear-folder-trash': []
}>()

const { t } = useI18n()
const exportMenuOpen = ref(false)

const reasonOptions = computed(() => [
  { value: '' as const, label: t('trash.all') },
  { value: 'duplicate' as const, label: t('trash.duplicate') },
  { value: 'exclusion' as const, label: t('trash.exclusion') },
  { value: 'manual' as const, label: t('trash.manual') },
  { value: 'ai_filtered' as const, label: t('trash.aiFilteredNotSlide') },
  { value: 'ai_filtered_edit' as const, label: t('trash.aiFilteredEdit') },
])

function clampSize(n: number): number {
  return Math.min(sizeMax, Math.max(sizeMin, Math.round(n / sizeStep) * sizeStep))
}

function onThumbSize(e: Event) {
  const el = e.target as HTMLInputElement
  emit('update:thumbnailSize', clampSize(Number(el.value)))
}

function nudgeSize(delta: number) {
  emit('update:thumbnailSize', clampSize(props.thumbnailSize + delta))
}

function pickExport(format: ExportFormat) {
  exportMenuOpen.value = false
  emit('export', format)
}

function onDocClick(e: MouseEvent) {
  if (!exportMenuOpen.value) return
  const target = e.target as HTMLElement | null
  if (target?.closest('.sm-export-wrap')) return
  exportMenuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.sm-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--st-bg, #fff);
  color: var(--st-text, #1d1d1f);
}

.sm-empty-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
  color: var(--st-text-muted, #86868b);
}

.sm-empty-title {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--st-text, #1d1d1f);
}

.sm-empty-hint {
  margin: 0;
  max-width: 22rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--st-text-secondary, #6e6e73);
}

.sm-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  min-height: var(--st-toolbar-height, 52px);
  padding: 0.45rem 1.15rem;
  border-bottom: 1px solid var(--st-border, rgba(0, 0, 0, 0.08));
  background: var(--st-bg, #fff);
  flex-shrink: 0;
  z-index: 2;
}

.sm-toolbar-left,
.sm-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  min-width: 0;
}

.sm-toolbar-right {
  margin-left: auto;
}

.sm-segments {
  display: inline-flex;
  padding: 0.18rem;
  border-radius: 0.5rem;
  background: var(--st-hover, rgba(0, 0, 0, 0.05));
  gap: 0.1rem;
}

.sm-seg {
  border: none;
  background: transparent;
  color: var(--st-text-secondary, #6e6e73);
  font-size: 0.8125rem;
  font-weight: 550;
  padding: 0.32rem 0.7rem;
  border-radius: 0.38rem;
  cursor: pointer;
}

.sm-seg.active {
  background: var(--st-surface, #fff);
  color: var(--st-text, #1d1d1f);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* iCloud-style size control */
.sm-size {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.25rem;
}

.sm-size-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--st-text-secondary, #6e6e73);
  cursor: pointer;
}

.sm-size-btn:hover:not(:disabled) {
  background: var(--st-hover, rgba(0, 0, 0, 0.05));
  color: var(--st-text, #1d1d1f);
}

.sm-size-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.sm-size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 88px;
  height: 3px;
  background: var(--st-border, rgba(0, 0, 0, 0.18));
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.sm-size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  background: var(--st-surface, #fff);
  border: 1px solid var(--st-text-muted, #86868b);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.sm-size-slider::-moz-range-thumb {
  width: 13px;
  height: 13px;
  background: var(--st-surface, #fff);
  border: 1px solid var(--st-text-muted, #86868b);
  border-radius: 50%;
  cursor: pointer;
}

.sm-sel-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--st-text-secondary, #6e6e73);
  white-space: nowrap;
}

.sm-btn {
  border: none;
  background: transparent;
  color: var(--st-text-secondary, #6e6e73);
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.38rem 0.6rem;
  border-radius: 0.45rem;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.sm-btn:hover:not(:disabled) {
  background: var(--st-hover, rgba(0, 0, 0, 0.05));
  color: var(--st-text, #1d1d1f);
}

.sm-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Danger stays typographic — no solid red pill (iCloud quiet chrome). */
.sm-btn--quiet-danger {
  color: var(--st-text-secondary, #6e6e73);
}

.sm-btn--quiet-danger:hover:not(:disabled) {
  color: var(--st-danger, #ff3b30);
  background: color-mix(in srgb, var(--st-danger, #ff3b30) 8%, transparent);
}

.sm-export-wrap {
  position: relative;
}

.sm-export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.3rem);
  min-width: 9rem;
  padding: 0.3rem;
  border-radius: 0.6rem;
  background: var(--st-elevated, #fff);
  border: 1px solid var(--st-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  z-index: 20;
  display: flex;
  flex-direction: column;
}

.sm-export-menu button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.5rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.8125rem;
  color: var(--st-text, #1d1d1f);
  cursor: pointer;
}

.sm-export-menu button:hover:not(:disabled) {
  background: var(--st-hover, rgba(0, 0, 0, 0.05));
}

.sm-export-progress {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-variant-numeric: tabular-nums;
}

.sm-spinner {
  width: 11px;
  height: 11px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: sm-spin 0.8s linear infinite;
}

@keyframes sm-spin {
  to { transform: rotate(360deg); }
}

.sm-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.45rem 1.15rem 0.15rem;
  flex-shrink: 0;
}

.sm-chip {
  border: 1px solid var(--st-border, rgba(0, 0, 0, 0.1));
  background: transparent;
  color: var(--st-text-secondary, #6e6e73);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
}

.sm-chip:hover {
  background: var(--st-hover, rgba(0, 0, 0, 0.04));
}

.sm-chip.active {
  border-color: color-mix(in srgb, var(--st-accent, #0071e3) 45%, transparent);
  background: color-mix(in srgb, var(--st-accent, #0071e3) 12%, transparent);
  color: var(--st-accent, #0071e3);
}

.sm-heading {
  padding: 0.85rem 1.15rem 0.35rem;
  flex-shrink: 0;
}

.sm-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--st-text, #1d1d1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-sub {
  margin: 0.2rem 0 0;
  font-size: 0.875rem;
  color: var(--st-text-secondary, #6e6e73);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-grid-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.65rem 1.15rem 1.25rem;
}

.sm-empty-grid {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
  color: var(--st-text-secondary, #6e6e73);
  font-size: 0.9375rem;
}

.sm-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  border-top: 1px solid var(--st-border, rgba(0, 0, 0, 0.06));
  font-size: 0.75rem;
  color: var(--st-text-muted, #86868b);
}

.sm-status-sep {
  opacity: 0.6;
}

@media (max-width: 768px) {
  .sm-toolbar {
    padding: 0.4rem 0.75rem;
  }

  .sm-size-slider {
    width: 64px;
  }

  .sm-heading,
  .sm-grid-scroll,
  .sm-reasons {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .sm-title {
    font-size: 1.2rem;
  }
}
</style>
