<template>
  <div class="slides-page custom-scrollbar">
    <!-- Folder list view -->
    <template v-if="rv.currentView.value === 'folders'">
      <div class="page-header">
        <h1 class="page-title">{{ $t('navigation.slidesReview') }}</h1>
        <div class="header-actions">
          <button class="btn btn--ghost" :disabled="rv.isLoading.value" @click="rv.refresh()">
            {{ $t('trash.refresh') }}
          </button>
          <button
            v-if="rv.trashEntries.value.length > 0 && !selectMode"
            class="btn btn--ghost danger-text"
            @click="clearAllTrash"
          >
            {{ $t('trash.clearTrash') }}
          </button>
          <button
            v-if="rv.folders.value.length > 0"
            class="btn"
            :class="selectMode ? 'btn--primary' : 'btn--ghost'"
            @click="toggleSelectMode"
          >
            {{ selectMode ? $t('trash.doneEditing') : $t('trash.editFolders') }}
          </button>
        </div>
      </div>

      <div v-if="selectMode" class="select-toolbar">
        <SlidesExportBar
          :selected-count="selectedFolderNames.length"
          :output-mode="pdfExport.outputMode.value"
          :is-generating="pdfExport.isGenerating.value"
          :progress="pdfExport.generateProgress.value"
          @update:output-mode="pdfExport.outputMode.value = $event"
          @make="exportSelectedFolders"
        />
        <button
          class="btn btn--danger clear-folders-btn"
          :disabled="selectedFolderNames.length === 0 || pdfExport.isGenerating.value"
          @click="clearSelectedFolders"
        >
          {{ $t('trash.clearFolder') }}
        </button>
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
        :select-mode="selectMode"
        :selected-names="selectedFolderNames"
        @open="rv.openFolder($event)"
        @update:selected-names="selectedFolderNames = $event"
      />
    </template>

    <!-- Image review view -->
    <template v-else>
      <div class="page-header">
        <div class="header-left">
          <button class="btn btn--ghost back-btn" @click="rv.goBack()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            <span>{{ $t('trash.back') }}</span>
          </button>
          <h1 class="page-title folder-title" :title="rv.currentFolder.value?.name">
            {{ rv.currentFolderDisplayName.value }}
          </h1>
        </div>
        <div class="header-actions">
          <button class="btn btn--ghost" :disabled="rv.isLoading.value" @click="rv.refresh()">
            {{ $t('trash.refresh') }}
          </button>
        </div>
      </div>

      <div class="review-toolbar">
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
      </div>

      <div class="selection-row">
        <button class="link-btn" @click="rv.selectAll()">{{ $t('trash.selectAll') }}</button>
        <button class="link-btn" :disabled="rv.selectedIds.value.length === 0" @click="rv.clearSelection()">
          {{ $t('trash.clearSelection') }}
        </button>
        <span class="selection-count">
          {{ rv.selectedIds.value.length }} {{ $t('trash.selected') }} / {{ rv.filteredItems.value.length }} {{ $t('trash.total') }}
        </span>
        <div class="toolbar-spacer"></div>
        <input
          v-model.number="rv.thumbnailSize.value"
          class="size-slider"
          type="range"
          min="180"
          max="640"
          step="20"
        />
      </div>

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
// Slides workspace page: folder list → per-folder image review, plus
// PDF export from folder select mode. Web port of the desktop's
// ResultsWindow.vue shell (crop/dedup/notes features omitted).
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FolderListView from './FolderListView.vue'
import SlidesImageGrid from './SlidesImageGrid.vue'
import SlidesPreviewModal from './SlidesPreviewModal.vue'
import SlidesExportBar from './SlidesExportBar.vue'
import { useResultsView } from '../../composables/useResultsView'
import { usePdfExport } from '../../composables/usePdfExport'
import { navigationStore } from '../../stores/navigationStore'
import type { ResultsItem } from '../../composables/resultsTypes'

const { t } = useI18n()
const rv = useResultsView()
const pdfExport = usePdfExport()

const selectMode = ref(false)
const selectedFolderNames = ref<string[]>([])

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedFolderNames.value = []
}

// The page stays mounted behind the mode-container; refresh when the user
// navigates back to it so folders extracted since last visit show up.
watch(
  () => navigationStore.activeNav.value,
  (nav) => {
    if (nav === 'slides') void rv.refresh()
  },
)

const exportSelectedFolders = async () => {
  await pdfExport.makePdf(selectedFolderNames.value)
}

const clearSelectedFolders = async () => {
  const names = selectedFolderNames.value
  if (names.length === 0) return
  if (!window.confirm(t('trash.confirmClearFolders', { count: names.length }))) return
  await rv.removeFolders(names)
  selectedFolderNames.value = []
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

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.page-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
}

.folder-title {
  font-size: 1.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.select-toolbar {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.select-toolbar > :first-child {
  flex: 1;
}

.clear-folders-btn {
  align-self: center;
}

.review-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.toolbar-select {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-input, var(--bg-surface));
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.toolbar-spacer {
  flex: 1;
}

.selection-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
}

.link-btn:disabled {
  color: var(--text-muted, var(--text-secondary));
  cursor: default;
}

.selection-count {
  white-space: nowrap;
}

.size-slider {
  width: 140px;
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
