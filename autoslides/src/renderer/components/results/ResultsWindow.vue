<template>
  <div class="results-window">
    <div class="toolbar">
      <div class="toolbar-left">
        <button v-if="currentView === 'images'" class="btn back-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          {{ $t('trash.back') }}
        </button>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.viewMode') }}:</label>
          <select v-model="contextMode" class="select-field filter-select">
            <option value="context">{{ $t('trash.showContext') }}</option>
            <option value="extracted-only">{{ $t('trash.extractedOnly') }}</option>
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </div>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="select-field filter-select" :disabled="!hasRemovedItems">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFilteredNotSlide') }}</option>
            <option value="ai_filtered_edit">{{ $t('trash.aiFilteredEdit') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </div>

        <button class="btn refresh-btn" @click="handleRefresh" :disabled="isLoading || isGenerating">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('trash.refresh') }}
        </button>

        <button v-if="currentView === 'folders'" class="btn" @click="openOutputDirectory">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          {{ $t('settings.openFolder') }}
        </button>

        <button
          v-if="currentView === 'folders'"
          class="edit-btn"
          :class="{ 'edit-btn-active': isFolderEditMode }"
          :disabled="!canEditFolders || isLoading || isGenerating"
          @click="toggleFolderEditMode"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4.5 8.2l2.4 2.4 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ isFolderEditMode ? $t('trash.doneEditing') : $t('trash.editFolders') }}
        </button>
      </div>

      <div class="actions">
        <button
          v-if="currentView === 'images'"
          class="delete-btn"
          @click="confirmDelete"
          :disabled="selectedActiveItems.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.delete') }}
        </button>

        <div
          v-if="currentView === 'images'"
          class="action-split action-split-restore"
          :class="{ 'action-split-open': showRestoreMenu }"
        >
          <button
            class="restore-btn action-split-main"
            @click="restoreSelected"
            :disabled="selectedRemovedItems.length === 0 || isLoading"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
              <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
            </svg>
            {{ $t('trash.restore') }}
          </button>
          <button
            class="restore-btn action-split-toggle"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleRestoreMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRestoreMenu" class="action-split-menu">
            <button
              class="action-split-menu-item"
              :disabled="!hasCroppedInCurrentFolder || isLoading"
              :title="$t('trash.restoreAllCroppedHint')"
              @click="handleRestoreCropped"
            >
              <div class="action-split-menu-title">{{ $t('trash.restoreAllCropped') }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split action-split-auto-crop"
          :class="{ 'action-split-open': showAutoCropMenu }"
        >
          <button
            class="restore-btn auto-crop-btn action-split-main"
            @click="handleAutoCropSelected"
            :disabled="!canAutoCropSelected || isLoading"
            :title="$t('trash.autoCropSelectedHint')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z" fill="currentColor"/>
            </svg>
            {{ $t('trash.autoCropSelected') }}
          </button>
          <button
            class="restore-btn auto-crop-btn action-split-toggle"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleAutoCropMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showAutoCropMenu" class="action-split-menu">
            <button
              class="action-split-menu-item"
              :disabled="!canRunBaselineAction || isLoading"
              :title="baselineActionTitle"
              @click="handleBaselineAction"
            >
              <div class="action-split-menu-title">{{ baselineActionLabel }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split action-split-dedup"
          :class="{ 'action-split-open': showRemoveDuplicatesMenu }"
        >
          <button
            class="clear-btn dedup-btn action-split-main"
            @click="handleRemoveDuplicates"
            :disabled="!canRemoveDuplicatesInCurrentFolder || isLoading"
            :title="$t('trash.removeDuplicatesHint')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="1.5" y="4.5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
              <path d="M5.5 3V2.5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5h-.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M4 8.75h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {{ $t('trash.removeDuplicates') }}
          </button>
          <button
            class="clear-btn dedup-btn action-split-toggle"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleRemoveDuplicatesMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRemoveDuplicatesMenu" class="action-split-menu action-split-menu-wide">
            <label
              class="action-split-checkbox"
              :title="$t('trash.removeDuplicatesAfterActionsHint')"
              @click.stop
            >
              <input type="checkbox" v-model="dedupAfterCropActions" :disabled="isLoading" />
              <span>{{ $t('trash.removeDuplicatesAfterActions') }}</span>
            </label>
          </div>
        </div>

        <button
          v-if="currentView === 'folders'"
          class="notes-btn"
          :disabled="!isFolderEditMode || (selectedFolderNames.length === 0 && !hasNotesConflict) || isLoading || isGenerating || imp.importing.value || cloudStorage.blocked.value"
          :title="cloudStorageBlockedTip"
          @click="onImportToNotes"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
          </svg>
          {{ $t('trash.importToNotes') }}
          <span v-if="selectedFolderNames.length > 0" class="edit-count">{{ selectedFolderNames.length }}</span>
        </button>

        <button
          v-if="currentView === 'folders'"
          class="notes-btn"
          :disabled="!isFolderEditMode || (selectedFolderNames.length === 0 && !hasNotesConflict) || isLoading || isGenerating || imp.importing.value || cloudStorage.blocked.value"
          :title="cloudStorageBlockedTip"
          @click="onPublishToIndex"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {{ $t('trash.publishToIndex') }}
          <span v-if="selectedFolderNames.length > 0" class="edit-count">{{ selectedFolderNames.length }}</span>
        </button>

        <div v-if="currentView === 'folders'" class="actions-divider"></div>

        <button
          v-if="currentView === 'folders'"
          class="delete-btn"
          :disabled="!canClearSelectedFolders || isLoading || isGenerating"
          @click="handleClearSelectedFolders"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearFolder') }}
          <span v-if="selectedFolderNames.length > 0" class="edit-count">{{ selectedFolderNames.length }}</span>
        </button>

        <button
          class="clear-btn"
          @click="confirmClearTrash"
          :disabled="!canClearTrash || isLoading || isGenerating"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearTrash') }}
        </button>
      </div>
    </div>

    <ResultsExportBar
      v-if="currentView === 'folders'"
      :pdf="pdf"
      :is-folder-edit-mode="isFolderEditMode"
      :selected-count="selectedFolderNames.length"
    />

    <div class="content-area custom-scrollbar" ref="contentAreaRef">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('trash.loading') }}</span>
      </div>

      <template v-else-if="currentView === 'folders'">
        <div v-if="folders.length === 0" class="loading-state empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>{{ $t('trash.noResultsFolders') }}</span>
        </div>

        <FolderListView
          v-else
          ref="folderListRef"
          :folders="sortedFolders"
          :is-grouping-active="isGroupingActive"
          :is-folder-edit-mode="isFolderEditMode"
          :selected-folder-names="selectedFolderNames"
          :last-visited-folder-name="lastVisitedFolderName"
          :is-generating="isGenerating"
          :format-tool-folder-name="formatToolFolderName"
          @open-folder="handleOpenFolder"
          @toggle-selection="toggleFolderSelection"
          @select-course="selectAllInCourse"
          @reorder="handleFolderReorder"
        />
      </template>

      <template v-else>
        <div v-if="filteredItems.length === 0" class="loading-state empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.3"/>
            <circle cx="22" cy="22" r="6" fill="currentColor" opacity="0.2"/>
            <path d="M8 44l16-16 12 12 12-16 8 8v24H8V44z" fill="currentColor" opacity="0.2"/>
          </svg>
          <span>{{ folderItems.length === 0 ? $t('trash.emptyFolder') : $t('trash.emptyFiltered') }}</span>
        </div>

        <ResultsImageGrid
          v-else
          :items="filteredItems"
          :selected-ids="selectedIds"
          :thumbnails="thumbnails"
          :thumbnail-size="thumbnailSize"
          @toggle-selection="toggleSelection"
          @preview="openPreview"
        />
      </template>
    </div>

    <div v-if="isGenerating || imp.importing.value" class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${busyProgressPercent}%` }"></div>
    </div>

    <!-- Import / Publish progress + conflict resolution (shared with Cloud Notes) -->
    <ImportProgressModal
      :open="showNotesModal"
      :title="$t(notesModalMode === 'publish' ? 'trash.publishToIndex' : 'trash.importToNotes')"
      :imp="imp"
      @close="showNotesModal = false"
      @done="onDoneNotesModal"
      @open-note="onOpenConflictNote"
    />

    <div class="footer">
      <div class="footer-left">
        <template v-if="currentView === 'folders'">
          <span v-if="!isFolderEditMode">{{ $t('trash.total') }}: {{ sortedFolders.length }}</span>
          <template v-else>
            <span>{{ $t('trash.selected') }}: {{ selectedFolderNames.length }} / {{ $t('trash.total') }}: {{ sortedFolders.length }}</span>
            <span class="footer-separator">|</span>
            <span>{{ $t('pdfmaker.totalImages') }}: {{ selectedImageCount }}</span>
          </template>
        </template>
        <template v-else>
          <button
            class="select-all-btn"
            :disabled="filteredItems.length === 0"
            @click="toggleSelectAllFiltered"
          >
            {{ allFilteredSelected ? $t('trash.clearSelection') : $t('trash.selectAll') }}
          </button>
          <span>{{ $t('trash.selected') }}: {{ selectedIds.length }} / {{ $t('trash.total') }}: {{ filteredItems.length }}</span>
        </template>
      </div>

      <div v-if="currentView === 'images'" class="size-slider-group">
        <svg width="12" height="12" viewBox="0 0 16 16" class="size-icon small">
          <rect x="3" y="3" width="10" height="10" fill="currentColor" opacity="0.6"/>
        </svg>
        <input
          type="range"
          v-model="thumbnailSize"
          min="180"
          max="640"
          step="20"
          class="size-slider"
        />
        <svg width="16" height="16" viewBox="0 0 16 16" class="size-icon large">
          <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.6"/>
        </svg>
      </div>

      <label
        v-if="currentView === 'folders'"
        class="group-toggle"
        :class="{ disabled: useCustomOrder }"
        :title="useCustomOrder ? $t('pdfmaker.groupByCourseDisabledHint') : ''"
      >
        <input type="checkbox" v-model="groupByCourse" :disabled="useCustomOrder" />
        <span>{{ $t('trash.groupByCourse') }}</span>
      </label>
    </div>

    <ResultsPreviewModal
      :preview-item="previewItem"
      :is-loading="isLoading"
      :thumbnails="thumbnails"
      :current-folder-display-name="currentFolderDisplayName"
      :can-set-current-as-baseline="canSetCurrentAsBaseline"
      :is-current-preview-baseline="isCurrentPreviewBaseline"
      :format-date="formatDate"
      :apply-crop-to-image="applyCropToImage"
      :restore-crop-from-image="restoreCropFromImage"
      :set-baseline-crop="setBaselineCrop"
      @close="closePreview"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResultsView, type CropRect, type ResultsItem, type ResultsReason } from '@features/results/useResultsView'
import { usePdfMaker } from '@features/export/usePdfMaker'
import ResultsExportBar from './ResultsExportBar.vue'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { useNoteImport } from '@features/cloudNotes/useNoteImport'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { noteOpenRequestStore, notesRefreshStore } from '@features/cloudNotes/noteOpenRequest'
import { navigationStore } from '@features/course/navigationStore'
import { NOTE_COPYRIGHT } from '@common/notesContent'
import { configStore } from '@shared/services/configStore'
import ResultsImageGrid from './ResultsImageGrid.vue'
import ResultsPreviewModal from './ResultsPreviewModal.vue'
import FolderListView from './FolderListView.vue'
import ImportProgressModal from '../cloudnotes/ImportProgressModal.vue'

const { t } = useI18n()

// Open the configured output directory (where the slide folders live) in the OS
// file manager. Folder-list view only.
const openOutputDirectory = async () => {
  const dir = configStore.outputDirectory
  if (dir) await window.electronAPI.shell.openPath(dir)
}

const {
  folders,
  currentView,
  currentFolder,
  lastVisitedFolderName,
  currentFolderDisplayName,
  folderItems,
  filteredItems,
  selectedIds,
  selectedActiveItems,
  selectedRemovedItems,
  selectedReason,
  contextMode,
  thumbnails,
  thumbnailSize,
  isLoading,
  previewItem,
  baselineCrop,
  hasRemovedItems,
  canAutoCropSelected,
  canSetCurrentAsBaseline,
  canSetSelectedAsBaseline,
  isCurrentPreviewBaseline,
  canApplyBaselineSelected,
  canRemoveDuplicatesInCurrentFolder,
  hasCroppedInCurrentFolder,
  hasAutoCroppedInCurrentFolder,
  trashEntries,
  openFolder,
  goBack,
  refresh,
  toggleSelection,
  openPreview,
  closePreview,
  deleteSelected,
  restoreSelected,
  autoCropSelected,
  setBaselineCrop,
  setSelectedBaselineCrop,
  clearBaselineCrop,
  applyBaselineToSelected,
  removeDuplicatesInCurrentFolder,
  restoreAllCroppedInFolder,
  restoreAutoCroppedInFolder,
  clearTrash,
  removeFolders,
  applyCropToImage,
  restoreCropFromImage,
  formatDate,
  formatToolFolderName,
} = useResultsView()


const allFilteredSelected = computed(() => {
  if (filteredItems.value.length === 0) return false
  const selected = new Set(selectedIds.value)
  return filteredItems.value.every((item) => selected.has(item.id))
})

function toggleSelectAllFiltered() {
  if (filteredItems.value.length === 0) return
  const filteredIds = filteredItems.value.map((item) => item.id)
  if (allFilteredSelected.value) {
    const filteredSet = new Set(filteredIds)
    selectedIds.value = selectedIds.value.filter((id) => !filteredSet.has(id))
  } else {
    const merged = new Set(selectedIds.value)
    filteredIds.forEach((id) => merged.add(id))
    selectedIds.value = Array.from(merged)
  }
}

const contentAreaRef = ref<HTMLDivElement | null>(null)
const folderListRef = ref<InstanceType<typeof FolderListView> | null>(null)
const folderScrollTop = ref(0)

async function handleOpenFolder(folder: { name: string }) {
  folderScrollTop.value = contentAreaRef.value?.scrollTop ?? 0
  const target = folders.value.find((f) => f.name === folder.name)
  if (target) {
    await openFolder(target)
  }
}

watch(currentView, async (view) => {
  if (view !== 'folders') return
  await nextTick()
  const container = contentAreaRef.value
  if (!container) return
  container.scrollTop = folderScrollTop.value
  const target = lastVisitedFolderName.value
    ? folderListRef.value?.getFolderEl(lastVisitedFolderName.value)
    : null
  if (target) {
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    if (targetRect.top < containerRect.top || targetRect.bottom > containerRect.bottom) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }
})

const DEDUP_AFTER_CROP_ACTIONS_KEY = 'autoslides.results.dedupAfterCropActions'

const readDedupAfterCropActions = () => {
  try {
    return window.sessionStorage.getItem(DEDUP_AFTER_CROP_ACTIONS_KEY) !== 'false'
  } catch {
    return true
  }
}

const dedupAfterCropActions = ref(readDedupAfterCropActions())
const showRestoreMenu = ref(false)
const showAutoCropMenu = ref(false)
const showRemoveDuplicatesMenu = ref(false)

watch(dedupAfterCropActions, (value) => {
  try {
    window.sessionStorage.setItem(DEDUP_AFTER_CROP_ACTIONS_KEY, value ? 'true' : 'false')
  } catch {
    // Session storage can be unavailable in restricted renderer contexts.
  }
})

const currentFolderRemovedIds = computed(() => {
  return folderItems.value
    .filter((item) => item.status === 'removed')
    .map((item) => item.id)
})

const hasCropBaseline = computed(() => !!baselineCrop.value)

const baselineActionLabel = computed(() => {
  return hasCropBaseline.value ? t('trash.applyBaseline') : t('trash.setBaseline')
})

const baselineActionTitle = computed(() => {
  return hasCropBaseline.value ? t('trash.applyBaselineHint') : t('trash.setBaselineHint')
})

const canRunBaselineAction = computed(() => {
  return hasCropBaseline.value ? canApplyBaselineSelected.value : canSetSelectedAsBaseline.value
})

const canClearTrash = computed(() => {
  if (currentView.value === 'images') {
    return currentFolderRemovedIds.value.length > 0
  }

  return folders.value.some((folder) => folder.removedCount > 0)
})

const isFolderEditMode = ref(false)
const selectedFolderNames = ref<string[]>([])
const groupByCourse = ref(true)

const pdf = usePdfMaker({ folders, selectedNames: selectedFolderNames })
const {
  sortedFolders,
  useCustomOrder,
  isGenerating,
  generateProgress,
  handleFolderReorder,
  resetSortOrder,
} = pdf

// ── Cloud Notes: import + publish-to-index (second entry point) ─────────────
// Reuses the exact composables the Cloud Notes page uses. "Publish to Index"
// imports any not-yet-imported folder first, then publishes ("does both").
const cn = useCloudNotes()
const imp = useNoteImport(cn, {
  meta: (count, date) => t('cloudNotes.noteMeta', { count, date }),
  warning: NOTE_COPYRIGHT,
  slideCaption: (n) => t('cloudNotes.noteSlideCaption', { n }),
})
const showNotesModal = ref(false)
const notesModalMode = ref<'import' | 'publish'>('import')
// An unresolved conflict from the last run — reopening the button should show
// the modal again instead of silently dropping it.
const hasNotesConflict = computed(() => imp.queue.value.some((i) => i.status === 'conflict'))

// The shared progress strip is driven by whichever run is active (PDF export or
// the notes import/publish queue). The notes queue uses image-level progress
// (imageProgress, matching generateProgress's granularity) so the bar advances
// continuously as each slide uploads, not just once per folder.
const busyProgressPercent = computed(() => {
  if (imp.importing.value) {
    const { done, total } = imp.imageProgress.value
    return total > 0 ? (done / total) * 100 : 0
  }
  return generateProgress.value.total > 0
    ? (generateProgress.value.current / generateProgress.value.total) * 100
    : 0
})

// Shared cloud-storage state (launch-checked; see cloudStorageStore). Buttons
// gate on known-bad states only; the action-time guard below re-checks fresh.
const cloudStorage = cloudStorageStore
const cloudStorageBlockedTip = computed(() => {
  if (cloudStorage.status.value === 'not-signed-in') return t('cloudNotes.notSignedIn')
  if (cloudStorage.status.value === 'uninitialized') return t('cloudNotes.storageNotInitialized')
  return undefined
})

/**
 * Ensure the user is signed in and the managed note storage is ready. Never
 * initializes storage for a never-initialized account — that is an explicit
 * user action (Settings → Cloud or the Cloud Notes page); it only auto-repairs
 * when the account initialized before and the group went missing server-side.
 */
async function ensureManagedStorage(): Promise<boolean> {
  const st = await cloudStorage.ensureReady()
  if (st === 'ready') {
    // Sync this page's local instance so the import queue sees fresh notes/groups.
    await cn.init()
    return true
  }
  const message =
    st === 'not-signed-in' ? t('cloudNotes.notSignedIn')
    : st === 'uninitialized' ? t('cloudNotes.storageNotInitialized')
    : cloudStorage.lastError.value || t('cloudNotes.storageCheckFailed')
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    title: t('trash.importToNotes'),
    message,
    buttons: [t('cloudNotes.importClose')],
  })
  return false
}

async function startNotesRun(mode: 'import' | 'publish'): Promise<void> {
  if (imp.importing.value) return

  // Resume: a previous run left unresolved conflicts — reopen the modal on them
  // rather than dropping them by starting a fresh run.
  if (hasNotesConflict.value) {
    notesModalMode.value = mode
    showNotesModal.value = true
    return
  }

  if (selectedFolderNames.value.length === 0) return
  if (!(await ensureManagedStorage())) return
  notesModalMode.value = mode
  imp.reset()
  // The bottom progress bar (shared with PDF export) already conveys live
  // progress, so await to completion here rather than opening a modal.
  await imp.startImport([...selectedFolderNames.value], { publish: mode === 'publish' })

  if (hasNotesConflict.value) {
    showNotesModal.value = true
    return
  }

  // No conflicts: summarize like the other batch actions (e.g. Clear Folder)
  // and clear the queue immediately since nothing needs further resolution.
  const failed = imp.queue.value.filter((i) => i.status === 'error').length
  const done = imp.queue.value.length - failed
  await window.electronAPI.dialog?.showMessageBox?.({
    type: failed > 0 ? 'warning' : 'info',
    buttons: ['OK'],
    title: t(mode === 'publish' ? 'trash.publishToIndex' : 'trash.importToNotes'),
    message: t('trash.notesRunSummary', { done, failed }),
  })
  imp.reset()
  notesRefreshStore.requestNotesRefresh()
}

const onImportToNotes = () => startNotesRun('import')
const onPublishToIndex = () => startNotesRun('publish')

function onDoneNotesModal(): void {
  imp.reset()
  showNotesModal.value = false
  notesRefreshStore.requestNotesRefresh()
}

async function onOpenConflictNote(id?: number): Promise<void> {
  if (id == null) return
  showNotesModal.value = false
  noteOpenRequestStore.requestOpenNote(id)
  navigationStore.navigate('cloud-notes')
}

// Custom ordering and course grouping are mutually exclusive: the grouped view
// imposes its own course-first order, so dragging into a custom order turns
// grouping off (the footer checkbox is disabled until order is reset).
watch(useCustomOrder, (value) => {
  if (value) {
    groupByCourse.value = false
  }
})

const isGroupingActive = computed(() => groupByCourse.value && !useCustomOrder.value)

const isCourseFullySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  return folderNames.every((name) => selectedFolderNames.value.includes(name))
}

function selectAllInCourse(folderNames: string[]) {
  if (folderNames.length === 0) return
  if (isCourseFullySelected(folderNames)) {
    const remove = new Set(folderNames)
    selectedFolderNames.value = selectedFolderNames.value.filter((name) => !remove.has(name))
    return
  }
  const merged = new Set(selectedFolderNames.value)
  folderNames.forEach((name) => merged.add(name))
  selectedFolderNames.value = Array.from(merged)
}

const canEditFolders = computed(() => folders.value.length > 0)
const canClearSelectedFolders = computed(
  () => isFolderEditMode.value && selectedFolderNames.value.length > 0,
)

watch(currentView, (view) => {
  if (view !== 'folders') {
    isFolderEditMode.value = false
    selectedFolderNames.value = []
  }
})

watch(folders, (list) => {
  if (selectedFolderNames.value.length === 0) return
  const available = new Set(list.map((folder) => folder.name))
  selectedFolderNames.value = selectedFolderNames.value.filter((name) => available.has(name))
})

function toggleFolderEditMode() {
  isFolderEditMode.value = !isFolderEditMode.value
  if (!isFolderEditMode.value) {
    selectedFolderNames.value = []
  }
}

function toggleFolderSelection(name: string) {
  const index = selectedFolderNames.value.indexOf(name)
  if (index === -1) {
    selectedFolderNames.value.push(name)
  } else {
    selectedFolderNames.value.splice(index, 1)
  }
}

// --- Export bar (PDF/PPTX generation over the folder selection) ---

const selectedImageCount = computed(() =>
  folders.value
    .filter((f) => selectedFolderNames.value.includes(f.name))
    .reduce((sum, f) => sum + f.activeCount, 0)
)

// The toolbar Refresh is a full reset of the folder list: it also drops the
// custom export order and folder selection (matching the old Slides Export
// refresh). Internal refreshes after item actions keep both.
async function handleRefresh() {
  if (currentView.value === 'folders') {
    resetSortOrder()
    selectedFolderNames.value = []
  }
  await refresh()
}

async function handleClearSelectedFolders() {
  if (!canClearSelectedFolders.value) return

  const targets = [...selectedFolderNames.value]
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearFolder')],
    defaultId: 1,
    cancelId: 0,
    title: t('trash.confirmClearFoldersTitle'),
    message: t('trash.confirmClearFolders', { count: targets.length }),
  })

  if (confirmed?.response !== 1) return

  const summary = await removeFolders(targets)

  selectedFolderNames.value = []
  isFolderEditMode.value = false

  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.confirmClearFoldersTitle'),
    message: t('trash.clearFoldersSummary', summary),
  })
}

const confirmDelete = async () => {
  if (selectedActiveItems.value.length === 0) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('trash.cancel'), t('trash.delete')],
    defaultId: 1,
    cancelId: 0,
    title: t('trash.confirmDeleteTitle'),
    message: t('trash.confirmDelete', { count: selectedActiveItems.value.length }),
  })

  if (confirmed?.response === 1) {
    await deleteSelected()
  }
}

const handleAutoCropSelected = async () => {
  showAutoCropMenu.value = false
  if (!canAutoCropSelected.value) return

  const summary = await autoCropSelected({ removeDuplicates: dedupAfterCropActions.value })
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.autoCropSelected'),
    message: t('trash.autoCropSelectedSummary', { ...summary }),
  })
}

const handleRemoveDuplicates = async () => {
  showRemoveDuplicatesMenu.value = false
  if (!canRemoveDuplicatesInCurrentFolder.value) return

  const summary = await removeDuplicatesInCurrentFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.removeDuplicates'),
    message: t('trash.removeDuplicatesSummary', { ...summary }),
  })
}

const handleBaselineAction = async () => {
  showAutoCropMenu.value = false

  if (!hasCropBaseline.value) {
    if (!canSetSelectedAsBaseline.value) return
    setSelectedBaselineCrop()
    return
  }

  if (!canApplyBaselineSelected.value) return

  const summary = await applyBaselineToSelected({ removeDuplicates: dedupAfterCropActions.value })
  clearBaselineCrop()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.applyBaseline'),
    message: t('trash.applyBaselineSummary', { ...summary }),
  })
}

const handleRestoreCropped = async () => {
  showRestoreMenu.value = false
  if (!hasCroppedInCurrentFolder.value) return

  const buttons = hasAutoCroppedInCurrentFolder.value
    ? [
        t('trash.cancel'),
        t('trash.restoreAllCropped'),
        t('trash.restoreAutoCroppedOnly'),
      ]
    : [t('trash.cancel'), t('trash.restoreAllCropped')]

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons,
    defaultId: 1,
    cancelId: 0,
    title: t('trash.restoreAllCropped'),
    message: t('trash.confirmRestoreAllCropped'),
  })
  if (confirmed?.response !== 1 && confirmed?.response !== 2) return

  const summary = confirmed.response === 2
    ? await restoreAutoCroppedInFolder()
    : await restoreAllCroppedInFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAllCropped'),
    message: t('trash.restoreAllCroppedSummary', summary),
  })
}

const toggleRestoreMenu = () => {
  showRestoreMenu.value = !showRestoreMenu.value
  if (showRestoreMenu.value) {
    showAutoCropMenu.value = false
    showRemoveDuplicatesMenu.value = false
  }
}

const toggleAutoCropMenu = () => {
  showAutoCropMenu.value = !showAutoCropMenu.value
  if (showAutoCropMenu.value) {
    showRestoreMenu.value = false
    showRemoveDuplicatesMenu.value = false
  }
}

const toggleRemoveDuplicatesMenu = () => {
  showRemoveDuplicatesMenu.value = !showRemoveDuplicatesMenu.value
  if (showRemoveDuplicatesMenu.value) {
    showRestoreMenu.value = false
    showAutoCropMenu.value = false
  }
}

const handleGlobalClickForActionMenus = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!showRestoreMenu.value && !showAutoCropMenu.value && !showRemoveDuplicatesMenu.value) return
  if (target?.closest('.action-split')) return
  showRestoreMenu.value = false
  showAutoCropMenu.value = false
  showRemoveDuplicatesMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClickForActionMenus)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClickForActionMenus)
})

const confirmClearTrash = async () => {
  if (!canClearTrash.value) return

  const isFolderScoped = currentView.value === 'images' && currentFolder.value

  const scopeIds = isFolderScoped ? currentFolderRemovedIds.value : trashEntries.value.map((e) => e.id)
  const scopedEntries = trashEntries.value.filter((e) => scopeIds.includes(e.id))
  const hasEditEntries = scopedEntries.some((e) => e.reason === 'ai_filtered_edit')

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearTrash')],
    defaultId: 1,
    cancelId: 0,
    title: isFolderScoped ? t('trash.confirmClearFolderTitle') : t('trash.confirmClearTitle'),
    message: isFolderScoped
      ? t('trash.confirmClearFolder', { folder: currentFolderDisplayName.value })
      : t('trash.confirmClear'),
    checkboxLabel: hasEditEntries ? t('trash.keepAiFilteredEdit') : undefined,
    checkboxChecked: hasEditEntries,
  })

  if (confirmed?.response === 1) {
    const keepEdit = !!confirmed.checkboxChecked && hasEditEntries
    if (keepEdit) {
      const idsToClear = scopedEntries
        .filter((e) => e.reason !== 'ai_filtered_edit')
        .map((e) => e.id)
      await clearTrash(idsToClear)
    } else {
      await clearTrash(isFolderScoped ? currentFolderRemovedIds.value : undefined)
    }
  }
}

</script>

<style scoped>
.results-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
  /* Embedded in the main window (narrower than the old Tools window), the action
     row wraps onto a second line rather than overflowing. */
  flex-wrap: wrap;
  row-gap: 8px;
}

.toolbar-left,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 6px;
}

/* Inline filter select — auto width instead of the shared full width */
.filter-select {
  width: auto;
  white-space: nowrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* back/refresh use the shared .btn (base, :hover, :disabled all from
   components.css); svg.spinning rotation is shared too (.spinning). */

.delete-btn,
.restore-btn,
.notes-btn,
.clear-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.notes-btn {
  background-color: var(--accent);
}

.notes-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.actions-divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-color);
  flex-shrink: 0;
}

.delete-btn {
  background-color: var(--danger-strong);
}

.delete-btn:hover:not(:disabled) {
  background-color: var(--danger-strong-hover);
}

.restore-btn {
  background-color: var(--success-strong);
}

.restore-btn:hover:not(:disabled) {
  background-color: var(--success-strong-hover);
}

.auto-crop-btn {
  background-color: var(--accent);
}

.auto-crop-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.clear-btn {
  background-color: var(--neutral-strong);
}

.clear-btn:hover:not(:disabled) {
  background-color: var(--neutral-strong-hover);
}

.dedup-btn {
  background-color: var(--warning-strong);
}

.dedup-btn:hover:not(:disabled) {
  background-color: var(--warning-strong-hover);
}

.delete-btn:disabled,
.restore-btn:disabled,
.clear-btn:disabled {
  color: rgba(255, 255, 255, 0.55);
  cursor: not-allowed;
}

/* Matches the shared .btn:disabled / Make PDF look (full-button fade) rather
   than the text-only fade above — these buttons sit right next to Make PDF in
   Select mode and are disabled far more often (whenever it's off). */
.notes-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.edit-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn-active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.edit-btn-active:hover:not(:disabled) {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.edit-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.25);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.action-split {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}

.action-split-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.action-split-toggle {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0 7px;
  min-width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-split-open .action-split-main {
  border-bottom-left-radius: 0;
}

.action-split-open .action-split-toggle {
  border-bottom-right-radius: 0;
}

.action-split-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--success-strong);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  z-index: var(--z-overlay);
  overflow: hidden;
}

.action-split-auto-crop .action-split-menu {
  background-color: var(--accent);
}

.action-split-auto-crop .action-split-menu-item:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.action-split-dedup .action-split-menu {
  background-color: var(--warning-strong);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.action-split-dedup .action-split-menu-item:hover:not(:disabled) {
  background-color: var(--warning-strong-hover);
}

.action-split-dedup .action-split-menu-wide {
  min-width: 0;
}

.action-split-menu-wide {
  min-width: 260px;
}

.action-split-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 30px;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-on-accent);
}

.action-split-menu-item + .action-split-menu-item {
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.action-split-menu-item:hover:not(:disabled) {
  background-color: var(--success-strong-hover);
}

.action-split-menu-item:disabled {
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
}

.action-split-menu-title {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.action-split-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
  color: var(--text-on-accent);
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-split-checkbox:hover {
  background-color: var(--warning-strong-hover);
}

.action-split-checkbox input {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.action-split-checkbox span {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state {
  height: 100%;
  color: var(--text-muted);
}


.progress-bar-container {
  height: 3px;
  background-color: var(--border-color);
  width: 100%;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--accent);
  transition: width 0.15s ease-out;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-separator {
  color: var(--border-strong);
}

.select-all-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-input);
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
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--bg-hover);
  border-radius: 6px;
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-elevated);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s;
}

.group-toggle:hover:not(.disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.group-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-toggle input {
  width: 11px;
  height: 11px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.group-toggle.disabled input {
  cursor: not-allowed;
}

.size-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
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
  background: var(--bg-input);
  border: 1px solid var(--text-muted);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px var(--shadow-lg);
}

</style>
