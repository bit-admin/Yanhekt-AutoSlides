<template>
  <div ref="pageEl" class="slides-page custom-scrollbar" :class="{ 'review-mode': rv.currentView.value === 'images' }">
    <!-- Folder list view -->
    <template v-if="rv.currentView.value === 'folders'">
      <div class="page-header">
        <h1 class="page-title">{{ $t('navigation.slidesReview') }}</h1>
        <div class="header-actions">
          <button class="btn btn--ghost" :disabled="rv.isLoading.value" @click="rv.refresh()">
            {{ $t('trash.refresh') }}
          </button>
          <button
            v-if="rv.trashEntries.value.length > 0"
            class="btn btn--ghost danger-text"
            @click="clearAllTrash"
          >
            {{ $t('trash.clearTrash') }}
          </button>
        </div>
      </div>

      <div v-if="rv.folders.value.length === 0 && !rv.isLoading.value" class="empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p>{{ $t('trash.noResultsFolders') }}</p>
      </div>

      <FolderListView
        v-else
        :folders="rv.folders.value"
        :folder-covers="rv.folderCovers.value"
        @open="rv.openFolder($event)"
        @remove="removeFolderWithConfirm"
      />
    </template>

    <!-- Image review view -->
    <template v-else>
      <!-- Single-row toolbar (desktop ResultsWindow parity): back, filters,
           refresh, then the action buttons -->
      <div class="review-toolbar">
        <button class="btn btn--ghost back-btn" @click="rv.goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          <span>{{ $t('trash.back') }}</span>
        </button>

        <label class="toolbar-field">
          <span class="field-label">{{ $t('trash.viewMode') }}</span>
          <select v-model="rv.contextMode.value" class="toolbar-select">
            <option value="context">{{ $t('trash.showContext') }}</option>
            <option value="extracted-only">{{ $t('trash.extractedOnly') }}</option>
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </label>

        <label v-if="rv.contextMode.value !== 'extracted-only'" class="toolbar-field">
          <span class="field-label">{{ $t('trash.filterReason') }}</span>
          <select v-model="rv.selectedReason.value" class="toolbar-select">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </label>

        <button class="btn btn--ghost" :disabled="rv.isLoading.value" @click="rv.refresh()">
          {{ $t('trash.refresh') }}
        </button>

        <div class="toolbar-spacer"></div>

        <button
          class="btn btn--primary"
          :disabled="rv.selectedRemovedItems.value.length === 0 || rv.isLoading.value"
          @click="rv.restoreSelected()"
        >
          {{ $t('trash.restore') }}
        </button>
        <button
          class="btn btn--danger"
          :disabled="rv.selectedActiveItems.value.length === 0 || rv.isLoading.value"
          @click="deleteSelectedWithConfirm"
        >
          {{ $t('trash.delete') }}
        </button>
        <button
          v-if="rv.hasRemovedItems.value"
          class="btn btn--ghost danger-text"
          :disabled="rv.isLoading.value"
          @click="clearFolderTrash"
        >
          {{ $t('trash.clearTrash') }}
        </button>

        <button
          class="btn btn--outline-sm export-btn"
          :disabled="exportDisabled"
          @click="exportCurrentFolder('pdf')"
        >
          <span v-if="slidesExport.exportingFormat.value === 'pdf'" class="export-progress">
            <span class="btn-spinner"></span>
            {{ slidesExport.exportProgress.value.current }}/{{ slidesExport.exportProgress.value.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: 'PDF' }) }}</span>
        </button>
        <button
          class="btn btn--outline-sm export-btn"
          :disabled="exportDisabled"
          @click="exportCurrentFolder('zip')"
        >
          <span v-if="slidesExport.exportingFormat.value === 'zip'" class="export-progress">
            <span class="btn-spinner"></span>
            {{ slidesExport.exportProgress.value.current }}/{{ slidesExport.exportProgress.value.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: 'ZIP' }) }}</span>
        </button>
      </div>

      <!-- Scrolling grid region between the toolbar and the footer -->
      <div ref="gridEl" class="grid-scroll custom-scrollbar">
        <div v-if="rv.filteredItems.value.length === 0 && !rv.isLoading.value" class="empty-state">
          <p>{{ rv.folderItems.value.length === 0 ? $t('trash.emptyFolder') : $t('trash.emptyFiltered') }}</p>
        </div>

        <SlidesImageGrid
          v-else
          :items="rv.filteredItems.value"
          :thumbnails="rv.thumbnails.value"
          :selected-ids="rv.selectedIds.value"
          :thumbnail-size="rv.thumbnailSize.value"
          @toggle="rv.toggleSelection($event)"
          @preview="rv.openPreview($event)"
        />
      </div>

      <!-- Slim status footer (desktop ResultsWindow parity): selection on the
           left, thumbnail size slider on the right -->
      <div class="review-footer">
        <div class="footer-left">
          <button
            class="select-all-btn"
            :disabled="rv.filteredItems.value.length === 0"
            @click="toggleSelectAllFiltered"
          >
            {{ allFilteredSelected ? $t('trash.clearSelection') : $t('trash.selectAll') }}
          </button>
          <span>{{ $t('trash.selected') }}: {{ rv.selectedIds.value.length }} / {{ $t('trash.total') }}: {{ rv.filteredItems.value.length }}</span>
        </div>

        <div class="size-slider-group">
          <svg width="12" height="12" viewBox="0 0 16 16" class="size-icon">
            <rect x="3" y="3" width="10" height="10" fill="currentColor" opacity="0.6"/>
          </svg>
          <input
            v-model.number="rv.thumbnailSize.value"
            class="size-slider"
            type="range"
            min="180"
            max="640"
            step="20"
          />
          <svg width="16" height="16" viewBox="0 0 16 16" class="size-icon">
            <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.6"/>
          </svg>
        </div>
      </div>

      <SlidesPreviewModal
        :item="rv.previewItem.value"
        :thumbnails="rv.thumbnails.value"
        :format-date="rv.formatDate"
        @close="rv.closePreview()"
        @restore="restoreFromPreview"
        @delete="deleteFromPreview"
      />
    </template>

    <div v-if="rv.isLoading.value" class="loading-overlay">
      <div class="spinner spinner--lg"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Slides workspace page: folder list → per-folder image review with a
// floating bottom action bar (selection, restore/delete, PDF/ZIP export).
// Web port of the desktop's ResultsWindow.vue shell (crop/dedup/notes
// features omitted; no folder select mode — cards expose delete directly).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FolderListView from './FolderListView.vue'
import SlidesImageGrid from './SlidesImageGrid.vue'
import SlidesPreviewModal from './SlidesPreviewModal.vue'
import { useResultsView } from '../../composables/useResultsView'
import { useSlidesExport, type ExportFormat } from '../../composables/useSlidesExport'
import { navigationStore } from '../../stores/navigationStore'
import { useKeepScroll } from '../../composables/useKeepScroll'
import type { ResultsFolder, ResultsItem } from '../../composables/resultsTypes'

defineOptions({ name: 'SlidesPage' })

const { t } = useI18n()
const rv = useResultsView()
const slidesExport = useSlidesExport()

const pageEl = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
useKeepScroll(pageEl, gridEl)

// The page stays mounted behind the mode-container; refresh when the user
// navigates back to it so folders extracted since last visit show up.
watch(
  () => navigationStore.activeNav.value,
  (nav) => {
    if (nav === 'slides') void rv.refresh()
  },
)

// Footer Select All button toggles: selects everything shown, or clears the
// selection once everything is already selected (desktop footer parity).
const allFilteredSelected = computed(() => {
  const items = rv.filteredItems.value
  if (items.length === 0) return false
  const selected = new Set(rv.selectedIds.value)
  return items.every((item) => selected.has(item.id))
})

const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) {
    rv.clearSelection()
  } else {
    rv.selectAll()
  }
}

const exportDisabled = computed(
  () =>
    slidesExport.isExporting.value ||
    rv.isLoading.value ||
    !rv.folderItems.value.some((item) => item.status === 'active'),
)

const exportCurrentFolder = async (format: ExportFormat) => {
  const folder = rv.currentFolder.value
  if (!folder) return
  await slidesExport.exportFolder(folder.name, format)
}

const removeFolderWithConfirm = async (folder: ResultsFolder) => {
  const displayName = rv.getFolderDisplayName(folder.name).course || folder.name
  if (!window.confirm(t('trash.confirmDeleteFolder', { folder: displayName }))) return
  await rv.removeFolders([folder.name])
}

const clearAllTrash = async () => {
  if (!window.confirm(t('trash.confirmClear'))) return
  await rv.clearTrash()
}

const clearFolderTrash = async () => {
  const folder = rv.currentFolder.value
  if (!folder) return
  if (!window.confirm(t('trash.confirmClearFolder', { folder: rv.currentFolderDisplayName.value }))) return
  const ids = rv.trashEntries.value
    .filter((entry) => entry.originalParentFolder === folder.name)
    .map((entry) => entry.id)
  if (ids.length === 0) return
  await rv.clearTrash(ids)
}

const deleteSelectedWithConfirm = async () => {
  const count = rv.selectedActiveItems.value.length
  if (count === 0) return
  if (!window.confirm(t('trash.confirmDelete', { count }))) return
  await rv.deleteSelected()
}

const restoreFromPreview = async (item: ResultsItem) => {
  rv.closePreview()
  rv.selectedIds.value = [item.id]
  await rv.restoreSelected()
}

const deleteFromPreview = async (item: ResultsItem) => {
  if (!window.confirm(t('trash.confirmDelete', { count: 1 }))) return
  rv.closePreview()
  rv.selectedIds.value = [item.id]
  await rv.deleteSelected()
}
</script>

<style scoped>
.slides-page {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem 2rem 2.5rem;
  background-color: var(--bg-page);
  color: var(--text-primary);
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.danger-text {
  color: var(--danger);
}

.review-toolbar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.toolbar-field {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.toolbar-select {
  padding: 0.375rem 2rem 0.375rem 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-input, var(--bg-surface));
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.625rem center;
  background-size: 0.75rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.toolbar-select:focus {
  outline: none;
  border-color: var(--link-color);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.toolbar-spacer {
  flex: 1;
}

/* Review mode: the page becomes a fixed column (header / toolbar / scrolling
   grid / slim footer) so the footer stays attached to the bottom edge, like
   the desktop ResultsWindow. */
.slides-page.review-mode {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.review-mode .review-toolbar {
  padding: 1.25rem 2rem 0;
}

.grid-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.25rem 2rem 1.5rem;
}

/* Slim status footer (desktop ResultsWindow .footer parity) */
.review-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--bg-elevated, var(--bg-surface));
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.select-all-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  background-color: var(--bg-input, var(--bg-surface));
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.select-all-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.select-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-slider-group {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--bg-hover);
  border-radius: 0.375rem;
}

.size-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.export-btn {
  min-width: 6.5rem;
  justify-content: center;
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-variant-numeric: tabular-nums;
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: action-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes action-spin {
  to { transform: rotate(360deg); }
}

.btn--outline-sm {
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  border-radius: 6.25rem;
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  height: var(--control-height, 2rem);
}

.btn--outline-sm:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.btn--outline-sm:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: var(--border-strong);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--bg-input, var(--bg-surface));
  border: 1px solid var(--text-muted, var(--text-secondary));
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px var(--shadow-lg);
}

.size-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--bg-input, var(--bg-surface));
  border: 1px solid var(--text-muted, var(--text-secondary));
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px var(--shadow-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  color: var(--text-secondary);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-page) 55%, transparent);
  z-index: 10;
}
</style>
