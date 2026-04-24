<template>
  <div class="results-window">
    <div class="toolbar">
      <div class="toolbar-left">
        <button v-if="currentView === 'images'" class="back-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          {{ $t('trash.back') }}
        </button>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.viewMode') }}:</label>
          <select v-model="contextMode" class="filter-select">
            <option value="context">{{ $t('trash.showContext') }}</option>
            <option value="extracted-only">{{ $t('trash.extractedOnly') }}</option>
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </div>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="filter-select" :disabled="!hasRemovedItems">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFilteredNotSlide') }}</option>
            <option value="ai_filtered_edit">{{ $t('trash.aiFilteredEdit') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </div>

        <button class="refresh-btn" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('trash.refresh') }}
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

        <button
          v-if="currentView === 'images'"
          class="restore-btn"
          @click="restoreSelected"
          :disabled="selectedRemovedItems.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
            <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
          </svg>
          {{ $t('trash.restore') }}
        </button>

        <div v-if="currentView === 'images'" class="restore-split" :class="{ 'restore-split-open': showRestoreMenu }">
          <button
            class="restore-btn restore-split-main"
            @click="handleAutoCropSelected"
            :disabled="!canAutoCropActive || isLoading"
            :title="$t('trash.autoCropSelectedHint')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z" fill="currentColor"/>
            </svg>
            {{ $t('trash.autoCropSelected') }}
          </button>
          <button
            class="restore-btn restore-split-toggle"
            :disabled="isLoading || (!canRestoreAndAutoCrop && !canCropAndDedup && !canApplyBaselineActive && !canApplyBaselineMixed && !canApplyBaselineDedup && !hasCroppedInCurrentFolder && !hasAutoCroppedInCurrentFolder)"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="showRestoreMenu = !showRestoreMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRestoreMenu" class="restore-split-menu">
            <button
              class="restore-split-menu-item"
              :disabled="!canRestoreAndAutoCrop || isLoading"
              @click="handleRestoreAndAutoCrop"
            >
              <div class="restore-split-menu-title">{{ $t('trash.restoreAndAutoCrop') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.restoreAndAutoCropHint') }}</div>
            </button>
            <button
              class="restore-split-menu-item"
              :disabled="!canCropAndDedup || isLoading"
              @click="handleCropAndDedup"
            >
              <div class="restore-split-menu-title">{{ $t('trash.restoreAutoCropDedup') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.restoreAutoCropDedupHint') }}</div>
            </button>
            <div class="restore-split-menu-divider"></div>
            <button
              class="restore-split-menu-item"
              :disabled="!canApplyBaselineActive || isLoading"
              @click="handleApplyBaseline"
            >
              <div class="restore-split-menu-title">{{ $t('trash.applyBaseline') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.applyBaselineHint') }}</div>
            </button>
            <button
              class="restore-split-menu-item"
              :disabled="!canApplyBaselineMixed || isLoading"
              @click="handleRestoreAndApplyBaseline"
            >
              <div class="restore-split-menu-title">{{ $t('trash.restoreAndApplyBaseline') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.restoreAndApplyBaselineHint') }}</div>
            </button>
            <button
              class="restore-split-menu-item"
              :disabled="!canApplyBaselineDedup || isLoading"
              @click="handleApplyBaselineAndDedup"
            >
              <div class="restore-split-menu-title">{{ $t('trash.applyBaselineDedup') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.applyBaselineDedupHint') }}</div>
            </button>
            <div class="restore-split-menu-divider"></div>
            <button
              class="restore-split-menu-item"
              :disabled="!hasCroppedInCurrentFolder || isLoading"
              @click="handleRestoreAllCropped"
            >
              <div class="restore-split-menu-title">{{ $t('trash.restoreAllCropped') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.restoreAllCroppedHint') }}</div>
            </button>
            <button
              class="restore-split-menu-item"
              :disabled="!hasAutoCroppedInCurrentFolder || isLoading"
              @click="handleRestoreAutoCropped"
            >
              <div class="restore-split-menu-title">{{ $t('trash.restoreAutoCropped') }}</div>
              <div class="restore-split-menu-hint">{{ $t('trash.restoreAutoCroppedHint') }}</div>
            </button>
          </div>
        </div>

        <button
          class="clear-btn"
          @click="confirmClearTrash"
          :disabled="!canClearTrash || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearTrash') }}
        </button>
      </div>
    </div>

    <div class="content-area" ref="contentAreaRef">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('trash.loading') }}</span>
      </div>

      <template v-else-if="currentView === 'folders'">
        <div v-if="folders.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>{{ $t('trash.noResultsFolders') }}</span>
        </div>

        <div v-else class="folder-list">
          <button
            v-for="folder in folders"
            :key="folder.name"
            class="folder-item"
            :class="{ 'folder-item-last-visited': folder.name === lastVisitedFolderName }"
            :ref="(el) => setFolderItemRef(folder.name, el as HTMLButtonElement | null)"
            @click="handleOpenFolder(folder)"
          >
            <div class="folder-icon">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <div class="folder-copy">
              <div class="folder-mainline">
                <span class="folder-name">{{ formatToolFolderName(folder.name) }}</span>
                <div class="folder-counts">
                  <span class="folder-count-text">
                    <span class="count-value">{{ folder.activeCount }}</span>
                    <span class="count-label">{{ $t('trash.active') }}</span>
                  </span>
                  <span class="folder-count-separator">/</span>
                  <span class="folder-count-text">
                    <span class="count-value">{{ folder.removedCount }}</span>
                    <span class="count-label">{{ $t('trash.removed') }}</span>
                  </span>
                </div>
              </div>
            </div>

            <svg class="folder-chevron" width="16" height="16" viewBox="0 0 16 16">
              <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>

      <template v-else>
        <div v-if="filteredItems.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.3"/>
            <circle cx="22" cy="22" r="6" fill="currentColor" opacity="0.2"/>
            <path d="M8 44l16-16 12 12 12-16 8 8v24H8V44z" fill="currentColor" opacity="0.2"/>
          </svg>
          <span>{{ folderItems.length === 0 ? $t('trash.emptyFolder') : $t('trash.emptyFiltered') }}</span>
        </div>

        <div v-else class="results-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="result-item"
            :class="{
              selected: selectedIds.includes(item.id),
              removed: item.status === 'removed'
            }"
            @click="toggleSelection(item.id)"
          >
            <div class="item-checkbox">
              <input
                type="checkbox"
                :checked="selectedIds.includes(item.id)"
                @click.stop
                @change="toggleSelection(item.id)"
              />
            </div>

            <button class="item-preview-btn" @click.stop="openPreview(item)" :title="$t('trash.preview')">
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
    </div>

    <div class="footer">
      <div class="footer-left">
        <span v-if="currentView === 'folders'">{{ $t('trash.total') }}: {{ folders.length }}</span>
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
    </div>

    <div v-if="previewItem" class="preview-modal-overlay" @click="closePreview">
      <div class="preview-modal" :class="{ 'metadata-visible': showPreviewMetadata, 'crop-mode': isCropMode }" @click.stop>
        <button class="preview-close-btn" @click="closePreview">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="preview-content">
          <div class="preview-image-container" :class="{ 'crop-mode': isCropMode }">
            <div ref="previewStageShell" class="preview-stage-shell" :class="{ 'crop-active': isCropMode }">
              <div
                ref="previewStage"
                class="preview-stage"
                :class="{ 'crop-stage': isCropMode }"
                :style="previewStageStyle"
                @pointerdown="handleCropStagePointerDown"
              >
                <img
                  v-if="previewImageSrc"
                  :src="previewImageSrc"
                  :alt="previewItem.name"
                  class="preview-image"
                  draggable="false"
                  @load="handlePreviewImageLoad"
                />
                <div v-else class="preview-image-placeholder">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.2"/>
                  </svg>
                </div>

                <div
                  v-if="isCropMode && cropRectPx"
                  class="crop-selection"
                  :style="cropSelectionStyle"
                  @pointerdown.stop="startCropInteraction('move', $event)"
                >
                  <div class="crop-grid">
                    <span v-for="line in 2" :key="`v-${line}`" class="crop-grid-line vertical" :style="{ left: `${line * 33.333}%` }"></span>
                    <span v-for="line in 2" :key="`h-${line}`" class="crop-grid-line horizontal" :style="{ top: `${line * 33.333}%` }"></span>
                  </div>
                  <button
                    v-for="handle in cropHandles"
                    :key="handle"
                    type="button"
                    class="crop-handle"
                    :class="`crop-handle-${handle}`"
                    @pointerdown.stop="startCropInteraction(handle, $event)"
                  ></button>
                </div>
              </div>
            </div>

            <div class="preview-actions">
              <template v-if="isCropMode">
                <button class="preview-action-btn" :disabled="isLoading" @click="cancelCropMode">
                  {{ $t('trash.cancel') }}
                </button>
                <button class="preview-action-btn primary" :disabled="!canApplyCrop || isLoading" @click="applyCrop">
                  {{ $t('trash.applyCrop') }}
                </button>
              </template>
              <template v-else>
                <button
                  v-if="canRestoreCrop"
                  class="preview-action-btn"
                  :disabled="isLoading"
                  @click="restoreCrop"
                >
                  {{ $t('trash.restoreCrop') }}
                </button>
                <button
                  v-if="canRecrop"
                  class="preview-action-btn"
                  :disabled="isLoading"
                  @click="startCropMode"
                >
                  {{ $t('trash.recrop') }}
                </button>
                <template v-else-if="canStartCrop">
                  <button
                    class="preview-action-btn"
                    :disabled="isLoading || isAutoCropDetecting"
                    @click="startCropMode"
                  >
                    {{ $t('trash.crop') }}
                  </button>
                  <button
                    class="preview-action-btn"
                    :disabled="isLoading || isAutoCropDetecting"
                    @click="startAutoCropMode"
                  >
                    {{ $t('trash.autoCrop') }}
                  </button>
                </template>
                <button
                  v-if="canSetCurrentAsBaseline"
                  class="preview-action-btn"
                  :disabled="isLoading || isCurrentPreviewBaseline"
                  :title="isCurrentPreviewBaseline ? $t('trash.currentBaselineTooltip') : $t('trash.useAsCropBaselineHint')"
                  @click="handleSetBaseline"
                >
                  {{ $t('trash.useAsCropBaseline') }}
                </button>
                <button class="preview-action-btn" @click="togglePreviewMetadata">
                  <span>{{ showPreviewMetadata ? $t('trash.hideMetadata') : $t('trash.showMetadata') }}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path
                      :d="showPreviewMetadata ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </template>
            </div>
          </div>

          <div class="preview-info-container">
            <div class="preview-info-title">{{ $t('trash.metadata') }}</div>
            <table class="preview-info-table">
              <tbody>
                <tr>
                  <td class="info-label">{{ $t('trash.filename') }}</td>
                  <td class="info-value">{{ previewItem.name }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.folder') }}</td>
                  <td class="info-value">{{ currentFolderDisplayName }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.status') }}</td>
                  <td class="info-value">
                    <span v-if="previewItem.status === 'active' && previewItem.isCropped" class="status-badge cropped">{{ getCropLabel() }}</span>
                    <span class="status-badge" :class="previewItem.status">{{ getStatusLabel(previewItem.status) }}</span>
                  </td>
                </tr>
                <tr v-if="previewItem.status === 'active'">
                  <td class="info-label">{{ $t('trash.currentPath') }}</td>
                  <td class="info-value info-path">{{ previewItem.imagePath || previewItem.originalPath }}</td>
                </tr>
                <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.croppedAt">
                  <td class="info-label">{{ $t('trash.croppedAt') }}</td>
                  <td class="info-value">{{ formatDate(previewItem.croppedAt) }}</td>
                </tr>
                <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.cropRect">
                  <td class="info-label">{{ $t('trash.cropArea') }}</td>
                  <td class="info-value">{{ formatCropArea(previewItem.cropRect) }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed'">
                  <td class="info-label">{{ $t('trash.originalPath') }}</td>
                  <td class="info-value info-path">{{ previewItem.originalPath }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.reason">
                  <td class="info-label">{{ $t('trash.filterReason') }}</td>
                  <td class="info-value">
                    <span :class="['reason-badge', `reason-${previewItem.reason}`]">{{ getReasonLabel(previewItem.reason) }}</span>
                  </td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.reasonDetails">
                  <td class="info-label">{{ $t('trash.reasonDetails') }}</td>
                  <td class="info-value">{{ previewItem.reasonDetails }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.trashedAt">
                  <td class="info-label">{{ $t('trash.trashedAt') }}</td>
                  <td class="info-value">{{ formatDate(previewItem.trashedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoCropDetect } from '../composables/useAutoCropDetect'
import { useResultsView, type CropRect, type ResultsItem, type ResultsReason } from '../composables/useResultsView'

const { t } = useI18n()

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
  hasRemovedItems,
  canRestoreAndAutoCrop,
  canAutoCropActive,
  canCropAndDedup,
  canSetCurrentAsBaseline,
  isCurrentPreviewBaseline,
  canApplyBaselineActive,
  canApplyBaselineMixed,
  canApplyBaselineDedup,
  hasCroppedInCurrentFolder,
  hasAutoCroppedInCurrentFolder,
  trashEntries,
  openFolder,
  goBack,
  refresh,
  toggleSelection,
  openPreview: openPreviewItem,
  closePreview: closePreviewItem,
  deleteSelected,
  restoreSelected,
  autoCropSelectedActive,
  restoreAndAutoCropSelected,
  cropAndDedupSelected,
  setBaselineCrop,
  applyBaselineToSelected,
  restoreAndApplyBaselineSelected,
  applyBaselineAndDedupSelected,
  restoreAllCroppedInFolder,
  restoreAutoCroppedInFolder,
  clearTrash,
  applyCropToImage,
  restoreCropFromImage,
  formatDate,
  formatToolFolderName,
} = useResultsView()

type CropHandle = 'nw' | 'ne' | 'sw' | 'se'
type CropInteraction =
  | { mode: 'create'; startX: number; startY: number }
  | { mode: 'move'; startX: number; startY: number; originRect: CropRect }
  | { mode: 'resize'; startX: number; startY: number; originRect: CropRect; handle: CropHandle }

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
const folderItemRefs = new Map<string, HTMLButtonElement>()
const folderScrollTop = ref(0)

function setFolderItemRef(name: string, el: HTMLButtonElement | null) {
  if (el) {
    folderItemRefs.set(name, el)
  } else {
    folderItemRefs.delete(name)
  }
}

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
    ? folderItemRefs.get(lastVisitedFolderName.value)
    : null
  if (target) {
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    if (targetRect.top < containerRect.top || targetRect.bottom > containerRect.bottom) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }
})

const showPreviewMetadata = ref(false)
const isCropMode = ref(false)
const cropEditorImageSrc = ref('')
const cropImageNaturalSize = ref({ width: 0, height: 0 })
const cropRectPx = ref<CropRect | null>(null)
const cropInteraction = ref<CropInteraction | null>(null)
const previewStageShell = ref<HTMLDivElement | null>(null)
const previewStage = ref<HTMLDivElement | null>(null)
const previewStageShellSize = ref({ width: 0, height: 0 })
const previewResizeObserver = ref<ResizeObserver | null>(null)
const cropSourceRequestId = ref(0)
const isAutoCropDetecting = ref(false)
const isAutoCropPending = ref(false)

const { detectBbox } = useAutoCropDetect()

const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']
const minimumCropSize = 20

const currentFolderRemovedIds = computed(() => {
  return folderItems.value
    .filter((item) => item.status === 'removed')
    .map((item) => item.id)
})

const canClearTrash = computed(() => {
  if (currentView.value === 'images') {
    return currentFolderRemovedIds.value.length > 0
  }

  return folders.value.some((folder) => folder.removedCount > 0)
})

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

const getCropLabel = (item?: ResultsItem | null) => {
  const target = item ?? previewItem.value
  return target?.isAutoCropped ? t('trash.autoCropped') : t('trash.cropped')
}

const previewImageSrc = computed(() => {
  if (!previewItem.value) return ''
  if (isCropMode.value) {
    return cropEditorImageSrc.value
  }

  return thumbnails.value[previewItem.value.id] || ''
})

const canCropPreview = computed(() => {
  const item = previewItem.value
  if (!item || isLoading.value) return false
  if (item.status === 'active' && !!item.imagePath) return true
  if (item.status === 'removed' && item.reason === 'ai_filtered_edit' && !!item.originalPath) return true
  return false
})

const canRestoreCrop = computed(() => {
  const item = previewItem.value
  return canCropPreview.value && item?.status === 'active' && !!item?.isCropped
})

const canRecrop = computed(() => {
  return canRestoreCrop.value && !!previewItem.value?.cropPath && !!previewItem.value?.cropRect
})

const canStartCrop = computed(() => {
  const item = previewItem.value
  if (!canCropPreview.value) return false
  if (item?.status === 'active') return !item?.isCropped
  return true
})

const canApplyCrop = computed(() => {
  if (!isCropMode.value || !previewItem.value?.imagePath || !cropRectPx.value) {
    return false
  }

  return cropRectPx.value.width >= minimumCropSize && cropRectPx.value.height >= minimumCropSize
})

const previewStageStyle = computed(() => {
  if (
    !isCropMode.value ||
    cropImageNaturalSize.value.width === 0 ||
    cropImageNaturalSize.value.height === 0 ||
    previewStageShellSize.value.width === 0 ||
    previewStageShellSize.value.height === 0
  ) {
    return {}
  }

  const scale = Math.min(
    previewStageShellSize.value.width / cropImageNaturalSize.value.width,
    previewStageShellSize.value.height / cropImageNaturalSize.value.height
  )

  return {
    width: `${Math.max(1, Math.round(cropImageNaturalSize.value.width * scale))}px`,
    height: `${Math.max(1, Math.round(cropImageNaturalSize.value.height * scale))}px`,
  }
})

const cropSelectionStyle = computed(() => {
  if (
    !isCropMode.value ||
    !cropRectPx.value ||
    cropImageNaturalSize.value.width === 0 ||
    cropImageNaturalSize.value.height === 0 ||
    previewStageShellSize.value.width === 0 ||
    previewStageShellSize.value.height === 0
  ) {
    return {}
  }

  const scale = Math.min(
    previewStageShellSize.value.width / cropImageNaturalSize.value.width,
    previewStageShellSize.value.height / cropImageNaturalSize.value.height
  )

  return {
    left: `${cropRectPx.value.x * scale}px`,
    top: `${cropRectPx.value.y * scale}px`,
    width: `${cropRectPx.value.width * scale}px`,
    height: `${cropRectPx.value.height * scale}px`,
  }
})

const resetCropState = () => {
  isCropMode.value = false
  cropEditorImageSrc.value = ''
  cropImageNaturalSize.value = { width: 0, height: 0 }
  cropRectPx.value = null
  cropInteraction.value = null
  cropSourceRequestId.value += 1
  isAutoCropPending.value = false
}

const disconnectPreviewResizeObserver = () => {
  previewResizeObserver.value?.disconnect()
  previewResizeObserver.value = null
}

const updatePreviewStageShellSize = () => {
  if (!previewStageShell.value) {
    previewStageShellSize.value = { width: 0, height: 0 }
    return
  }

  previewStageShellSize.value = {
    width: previewStageShell.value.clientWidth,
    height: previewStageShell.value.clientHeight,
  }
}

const observePreviewStageShell = async () => {
  await nextTick()
  disconnectPreviewResizeObserver()
  updatePreviewStageShellSize()

  if (typeof ResizeObserver !== 'undefined' && previewStageShell.value) {
    previewResizeObserver.value = new ResizeObserver(() => {
      updatePreviewStageShellSize()
    })
    previewResizeObserver.value.observe(previewStageShell.value)
  }
}

const normalizeCropRect = (startX: number, startY: number, endX: number, endY: number): CropRect => {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

const sanitizeCropRect = (rect: CropRect): CropRect | null => {
  if (cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
    return null
  }

  const maxWidth = cropImageNaturalSize.value.width
  const maxHeight = cropImageNaturalSize.value.height
  const x = Math.max(0, Math.min(Math.round(rect.x), maxWidth))
  const y = Math.max(0, Math.min(Math.round(rect.y), maxHeight))
  const right = Math.max(x, Math.min(Math.round(rect.x + rect.width), maxWidth))
  const bottom = Math.max(y, Math.min(Math.round(rect.y + rect.height), maxHeight))
  const width = right - x
  const height = bottom - y

  if (width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

const getCropPointFromEvent = (event: PointerEvent) => {
  if (!previewStage.value || cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
    return null
  }

  const stageRect = previewStage.value.getBoundingClientRect()
  if (stageRect.width === 0 || stageRect.height === 0) {
    return null
  }

  const x = Math.max(0, Math.min(event.clientX - stageRect.left, stageRect.width))
  const y = Math.max(0, Math.min(event.clientY - stageRect.top, stageRect.height))

  return {
    x: (x / stageRect.width) * cropImageNaturalSize.value.width,
    y: (y / stageRect.height) * cropImageNaturalSize.value.height,
  }
}

const resizeCropRect = (originRect: CropRect, point: { x: number; y: number }, handle: CropHandle): CropRect => {
  const maxWidth = cropImageNaturalSize.value.width
  const maxHeight = cropImageNaturalSize.value.height
  let left = originRect.x
  let top = originRect.y
  let right = originRect.x + originRect.width
  let bottom = originRect.y + originRect.height

  if (handle.includes('n')) {
    top = Math.max(0, Math.min(point.y, bottom - minimumCropSize))
  }
  if (handle.includes('s')) {
    bottom = Math.min(maxHeight, Math.max(point.y, top + minimumCropSize))
  }
  if (handle.includes('w')) {
    left = Math.max(0, Math.min(point.x, right - minimumCropSize))
  }
  if (handle.includes('e')) {
    right = Math.min(maxWidth, Math.max(point.x, left + minimumCropSize))
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

const formatCropArea = (rect?: CropRect) => {
  if (!rect) return ''
  return `${rect.x}, ${rect.y}, ${rect.width} × ${rect.height}`
}

const loadImageSize = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => {
      reject(new Error('Failed to load crop source image'))
    }
    image.src = src
  })
}

const openPreview = (item: ResultsItem) => {
  resetCropState()
  showPreviewMetadata.value = false
  openPreviewItem(item)
}

const closePreview = () => {
  resetCropState()
  showPreviewMetadata.value = false
  closePreviewItem()
}

const togglePreviewMetadata = () => {
  showPreviewMetadata.value = !showPreviewMetadata.value
}

const handlePreviewImageLoad = (event: Event) => {
  if (!isCropMode.value) return

  const target = event.target as HTMLImageElement
  if (cropImageNaturalSize.value.width === 0 || cropImageNaturalSize.value.height === 0) {
    cropImageNaturalSize.value = {
      width: target.naturalWidth,
      height: target.naturalHeight,
    }
  }

  if (cropRectPx.value) {
    cropRectPx.value = sanitizeCropRect(cropRectPx.value)
  }

  updatePreviewStageShellSize()
}

const loadPreviewImageBase64 = async (item: ResultsItem): Promise<string | null> => {
  if (item.status === 'active' && item.imagePath) {
    if (item.isCropped && item.cropPath) {
      return window.electronAPI.crop.getImageAsBase64(item.cropPath)
    }
    return window.electronAPI.pdfmaker.getImageAsBase64(item.imagePath)
  }

  if (item.status === 'removed' && item.trashPath) {
    return window.electronAPI.trash.getImageAsBase64(item.trashPath)
  }

  return null
}

const startCropMode = async () => {
  const activeItem = previewItem.value
  if (!activeItem || (!canStartCrop.value && !canRecrop.value)) return
  if (activeItem.status === 'active' && !activeItem.imagePath) return
  if (activeItem.status === 'removed' && !activeItem.trashPath) return

  const requestId = cropSourceRequestId.value + 1
  cropSourceRequestId.value = requestId
  showPreviewMetadata.value = false

  try {
    const sourceBase64 = await loadPreviewImageBase64(activeItem)
    if (!sourceBase64) return

    if (requestId !== cropSourceRequestId.value) return

    const cropSource = `data:image/png;base64,${sourceBase64}`
    const size = await loadImageSize(cropSource)

    if (requestId !== cropSourceRequestId.value) return

    cropEditorImageSrc.value = cropSource
    cropImageNaturalSize.value = size
    cropRectPx.value = activeItem.isCropped && activeItem.cropRect
      ? sanitizeCropRect({ ...activeItem.cropRect })
      : null

    cropInteraction.value = null
    isCropMode.value = true
    await observePreviewStageShell()
  } catch (error) {
    console.error('Failed to load crop editor source:', error)
  }
}

const cancelCropMode = () => {
  resetCropState()
  showPreviewMetadata.value = false
}

const startAutoCropMode = async () => {
  const activeItem = previewItem.value
  if (!canStartCrop.value || !activeItem || isAutoCropDetecting.value) return
  if (activeItem.status === 'active' && !activeItem.imagePath) return
  if (activeItem.status === 'removed' && !activeItem.trashPath) return

  isAutoCropDetecting.value = true
  showPreviewMetadata.value = false

  try {
    const sourceBase64 = await loadPreviewImageBase64(activeItem)
    if (!sourceBase64) return
    const cropSource = `data:image/png;base64,${sourceBase64}`

    const base64Data = sourceBase64
    const binaryStr = atob(base64Data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    bitmap.close()

    const appConfig = await window.electronAPI.config.get()
    const slideCfg = appConfig.slideExtraction
    const response = await detectBbox(imageData, false, {
      mode: slideCfg?.autoCropDetectorMode ?? 'canny_then_yolo',
      canny: slideCfg?.autoCrop,
      yolo: slideCfg?.autoCropYolo,
    })

    if (!response.success || !response.result?.bbox) {
      await window.electronAPI.dialog?.showMessageBox?.({
        type: 'info',
        buttons: ['OK'],
        title: t('trash.autoCropNoDetectionTitle'),
        message: t('trash.autoCropNoDetectionMessage'),
      })
      return
    }

    const { x, y, w, h } = response.result.bbox
    const size = await loadImageSize(cropSource)

    cropEditorImageSrc.value = cropSource
    cropImageNaturalSize.value = size
    cropRectPx.value = { x, y, width: w, height: h }
    cropInteraction.value = null
    isAutoCropPending.value = true
    isCropMode.value = true
    await observePreviewStageShell()
  } catch (error) {
    console.error('Failed to run auto-crop detection:', error)
  } finally {
    isAutoCropDetecting.value = false
  }
}

const handleCropStagePointerDown = (event: PointerEvent) => {
  if (!isCropMode.value || event.button !== 0) return

  const point = getCropPointFromEvent(event)
  if (!point) return

  event.preventDefault()
  cropInteraction.value = {
    mode: 'create',
    startX: point.x,
    startY: point.y,
  }
  cropRectPx.value = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  }
}

const startCropInteraction = (mode: 'move' | CropHandle, event: PointerEvent) => {
  if (!cropRectPx.value) return

  const point = getCropPointFromEvent(event)
  if (!point) return

  event.preventDefault()
  event.stopPropagation()
  cropInteraction.value = mode === 'move'
    ? { mode: 'move', startX: point.x, startY: point.y, originRect: { ...cropRectPx.value } }
    : { mode: 'resize', startX: point.x, startY: point.y, originRect: { ...cropRectPx.value }, handle: mode }
}

const handleGlobalCropPointerMove = (event: PointerEvent) => {
  if (!cropInteraction.value) return

  const point = getCropPointFromEvent(event)
  if (!point) return

  event.preventDefault()

  if (cropInteraction.value.mode === 'create') {
    cropRectPx.value = normalizeCropRect(cropInteraction.value.startX, cropInteraction.value.startY, point.x, point.y)
    return
  }

  if (cropInteraction.value.mode === 'move') {
    const maxX = cropImageNaturalSize.value.width - cropInteraction.value.originRect.width
    const maxY = cropImageNaturalSize.value.height - cropInteraction.value.originRect.height
    const nextX = Math.max(0, Math.min(cropInteraction.value.originRect.x + (point.x - cropInteraction.value.startX), maxX))
    const nextY = Math.max(0, Math.min(cropInteraction.value.originRect.y + (point.y - cropInteraction.value.startY), maxY))
    cropRectPx.value = {
      ...cropInteraction.value.originRect,
      x: nextX,
      y: nextY,
    }
    return
  }

  cropRectPx.value = resizeCropRect(cropInteraction.value.originRect, point, cropInteraction.value.handle)
}

const handleGlobalCropPointerUp = () => {
  if (!cropInteraction.value) return

  if (cropRectPx.value) {
    const sanitized = sanitizeCropRect(cropRectPx.value)
    if (!sanitized || sanitized.width < minimumCropSize || sanitized.height < minimumCropSize) {
      cropRectPx.value = null
    } else {
      cropRectPx.value = sanitized
    }
  }

  cropInteraction.value = null
}

const applyCrop = async () => {
  const item = previewItem.value
  if (!item || !cropRectPx.value) return

  const rect = sanitizeCropRect(cropRectPx.value)
  if (!rect) return

  let targetPath: string | undefined
  if (item.status === 'active') {
    targetPath = item.imagePath
  } else if (item.status === 'removed' && item.reason === 'ai_filtered_edit' && item.originalPath) {
    try {
      await window.electronAPI.trash.restore([item.id])
      targetPath = item.originalPath
    } catch (error) {
      console.error('Failed to restore item before crop:', error)
      return
    }
  }

  if (!targetPath) return

  const success = await applyCropToImage(targetPath, rect, isAutoCropPending.value)
  if (success) {
    resetCropState()
    showPreviewMetadata.value = false
  }
}

const restoreCrop = async () => {
  if (!previewItem.value?.imagePath || !previewItem.value.isCropped) return

  const success = await restoreCropFromImage(previewItem.value.imagePath)
  if (success) {
    resetCropState()
    showPreviewMetadata.value = false
  }
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
  if (!canAutoCropActive.value) return

  const summary = await autoCropSelectedActive()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.autoCropSelected'),
    message: t('trash.autoCropSelectedSummary', summary),
  })
}

const showRestoreMenu = ref(false)

const handleRestoreAndAutoCrop = async () => {
  showRestoreMenu.value = false
  if (!canRestoreAndAutoCrop.value) return

  const summary = await restoreAndAutoCropSelected()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAndAutoCrop'),
    message: t('trash.restoreAndAutoCropSummary', summary),
  })
}

const handleCropAndDedup = async () => {
  showRestoreMenu.value = false
  if (!canCropAndDedup.value) return

  const summary = await cropAndDedupSelected()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAutoCropDedup'),
    message: t('trash.restoreAutoCropDedupSummary', summary),
  })
}

const handleSetBaseline = () => {
  const item = previewItem.value
  if (!item) return
  setBaselineCrop(item)
}

const handleApplyBaseline = async () => {
  showRestoreMenu.value = false
  if (!canApplyBaselineActive.value) return

  const summary = await applyBaselineToSelected()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.applyBaseline'),
    message: t('trash.applyBaselineSummary', summary),
  })
}

const handleRestoreAndApplyBaseline = async () => {
  showRestoreMenu.value = false
  if (!canApplyBaselineMixed.value) return

  const summary = await restoreAndApplyBaselineSelected()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAndApplyBaseline'),
    message: t('trash.restoreAndApplyBaselineSummary', summary),
  })
}

const handleApplyBaselineAndDedup = async () => {
  showRestoreMenu.value = false
  if (!canApplyBaselineDedup.value) return

  const summary = await applyBaselineAndDedupSelected()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.applyBaselineDedup'),
    message: t('trash.applyBaselineDedupSummary', summary),
  })
}

const handleRestoreAllCropped = async () => {
  showRestoreMenu.value = false
  if (!hasCroppedInCurrentFolder.value) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('trash.cancel'), t('trash.restoreAllCropped')],
    defaultId: 0,
    cancelId: 0,
    title: t('trash.restoreAllCropped'),
    message: t('trash.confirmRestoreAllCropped'),
  })
  if (confirmed?.response !== 1) return

  const summary = await restoreAllCroppedInFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAllCropped'),
    message: t('trash.restoreAllCroppedSummary', summary),
  })
}

const handleRestoreAutoCropped = async () => {
  showRestoreMenu.value = false
  if (!hasAutoCroppedInCurrentFolder.value) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('trash.cancel'), t('trash.restoreAutoCropped')],
    defaultId: 0,
    cancelId: 0,
    title: t('trash.restoreAutoCropped'),
    message: t('trash.confirmRestoreAutoCropped'),
  })
  if (confirmed?.response !== 1) return

  const summary = await restoreAutoCroppedInFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAutoCropped'),
    message: t('trash.restoreAutoCroppedSummary', summary),
  })
}

const handleGlobalClickForRestoreMenu = (event: MouseEvent) => {
  if (!showRestoreMenu.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.restore-split')) return
  showRestoreMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClickForRestoreMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClickForRestoreMenu)
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

watch(previewItem, async (item) => {
  if (!item) {
    disconnectPreviewResizeObserver()
    previewStageShellSize.value = { width: 0, height: 0 }
    return
  }

  await observePreviewStageShell()
})

window.addEventListener('pointermove', handleGlobalCropPointerMove)
window.addEventListener('pointerup', handleGlobalCropPointerUp)

onBeforeUnmount(() => {
  disconnectPreviewResizeObserver()
  window.removeEventListener('pointermove', handleGlobalCropPointerMove)
  window.removeEventListener('pointerup', handleGlobalCropPointerUp)
})
</script>

<style scoped>
.results-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
  color: #333;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: #fafafa;
  border-bottom: 1px solid #e0e0e0;
  gap: 12px;
}

.toolbar-left,
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn,
.refresh-btn,
.filter-select {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.back-btn:hover,
.refresh-btn:hover:not(:disabled) {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.filter-select:focus {
  outline: none;
  border-color: #007acc;
}

.refresh-btn:disabled,
.filter-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

.delete-btn,
.restore-btn,
.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.delete-btn {
  background-color: #d9534f;
}

.delete-btn:hover:not(:disabled) {
  background-color: #c43d39;
}

.restore-btn {
  background-color: #2c7a51;
}

.restore-btn:hover:not(:disabled) {
  background-color: #236341;
}

.clear-btn {
  background-color: #6c757d;
}

.clear-btn:hover:not(:disabled) {
  background-color: #5b646b;
}

.delete-btn:disabled,
.restore-btn:disabled,
.clear-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.restore-split {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}

.restore-split-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.restore-split-toggle {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0 8px;
  min-width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.restore-split-open .restore-split-main {
  border-bottom-left-radius: 0;
}

.restore-split-open .restore-split-toggle {
  border-bottom-right-radius: 0;
}

.restore-split-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: #2c7a51;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  z-index: 30;
  overflow: hidden;
}

.restore-split-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  color: #ffffff;
}

.restore-split-menu-item:hover:not(:disabled) {
  background-color: #236341;
}

.restore-split-menu-item:disabled {
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
}

.restore-split-menu-title {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}

.restore-split-menu-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 1px;
  line-height: 1.3;
}

.restore-split-menu-divider {
  height: 1px;
  margin: 2px 8px;
  background-color: rgba(255, 255, 255, 0.25);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #999;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e1e6eb;
  border-radius: 8px;
  background-color: white;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: #f8f9fa;
  border-color: #ced7e0;
}

.folder-item-last-visited {
  background-color: #e7f1ff;
  border-color: #7aa9e6;
  box-shadow: 0 0 0 1px #7aa9e6 inset;
}

.folder-item-last-visited:hover {
  background-color: #d9e7fb;
  border-color: #5f95d8;
}

.folder-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-copy {
  flex: 1;
  min-width: 0;
}

.folder-mainline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.folder-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #2b2b2b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-counts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: #7b8794;
  font-size: 12px;
  font-weight: 500;
}

.count-badge,
.status-badge,
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
}

.folder-count-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.count-label {
  color: inherit;
  text-transform: lowercase;
}

.folder-count-separator {
  color: #a0a8b1;
}

.count-value {
  font-variant-numeric: tabular-nums;
}

.count-badge.active,
.status-badge.active {
  background-color: #e7f3ff;
  color: #1768a8;
}

.status-badge.cropped {
  background-color: #edf0f3;
  color: #58616b;
}

.count-badge.removed,
.status-badge.removed {
  background-color: #ffe8e6;
  color: #b63a30;
}

.folder-chevron {
  flex-shrink: 0;
  color: #7b8794;
}

.results-grid {
  display: grid;
  gap: 16px;
}

.result-item {
  position: relative;
  background-color: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: #007acc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.result-item.selected {
  border-color: #007acc;
  background-color: #e7f3ff;
}

.result-item.removed {
  border-color: #d9534f;
}

.result-item.removed.selected {
  background-color: #fff1f0;
  border-color: #d9534f;
}

.item-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
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
  z-index: 1;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.92);
  color: #555;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #f5f5f5;
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
  color: #c3c7cb;
}

.item-copy {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-badges {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background-color: #ffe8e6;
  color: #b63a30;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #fafafa;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-all-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #ced7e0;
  border-radius: 4px;
  background-color: white;
  color: #333;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.select-all-btn:hover:not(:disabled) {
  background-color: #f0f4f8;
  border-color: #a8b7c4;
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
  background-color: #f0f0f0;
  border-radius: 6px;
}

.size-icon {
  color: #666;
  flex-shrink: 0;
}

.size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: #ccc;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #fff;
  border: 1px solid #999;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.preview-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-modal {
  position: relative;
  width: min(960px, calc(100vw - 48px));
  aspect-ratio: 16 / 10;
  max-height: calc(100vh - 48px);
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
}

.preview-modal.metadata-visible {
  width: min(1200px, calc(100vw - 48px));
  aspect-ratio: auto;
}

.preview-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.9);
  color: #444;
  cursor: pointer;
}

.preview-content {
  height: 100%;
}

.preview-modal.metadata-visible .preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  min-height: 420px;
  height: auto;
}

.preview-image-container {
  position: relative;
  background-color: #fff;
  padding: 54px 18px 58px;
  height: 100%;
}

.preview-modal.metadata-visible .preview-image-container {
  min-height: 420px;
  height: auto;
}

.preview-stage-shell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-stage-shell.crop-active {
  position: relative;
}

.preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-stage.crop-stage {
  cursor: crosshair;
}

.preview-image,
.preview-image-placeholder {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-image {
  user-select: none;
}

.preview-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(51, 51, 51, 0.28);
}

.preview-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.preview-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: none;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.92);
  color: #444;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-action-btn.primary {
  background-color: #007acc;
  color: #fff;
}

.preview-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.crop-selection {
  position: absolute;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.56);
  cursor: move;
  touch-action: none;
}

.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-grid-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.62);
}

.crop-grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}

.crop-grid-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}

.crop-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  background-color: #ffffff;
  transform: translate(-50%, -50%);
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.crop-handle-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.crop-handle-ne {
  top: 0;
  left: 100%;
  cursor: nesw-resize;
}

.crop-handle-sw {
  top: 100%;
  left: 0;
  cursor: nesw-resize;
}

.crop-handle-se {
  top: 100%;
  left: 100%;
  cursor: nwse-resize;
}

.preview-modal:not(.metadata-visible) .preview-info-container {
  display: none;
}

.preview-info-container {
  padding: 20px;
  overflow-y: auto;
}

.preview-info-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 14px;
}

.preview-info-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-info-table td {
  padding: 10px 0;
  border-bottom: 1px solid #edf0f2;
  vertical-align: top;
}

.info-label {
  width: 110px;
  color: #666;
  font-size: 12px;
}

.info-value {
  font-size: 12px;
  color: #2c2c2c;
  word-break: break-word;
}

.info-value .status-badge + .status-badge {
  margin-left: 6px;
}

.info-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-color-scheme: dark) {
  .results-window {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .toolbar,
  .footer {
    background-color: #252525;
    border-color: #3d3d3d;
  }

  .select-all-btn {
    background-color: #2d2d2d;
    border-color: #4d4d4d;
    color: #e0e0e0;
  }

  .select-all-btn:hover:not(:disabled) {
    background-color: #353535;
    border-color: #5d5d5d;
  }

  .back-btn,
  .refresh-btn,
  .filter-select {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .filter-group label,
  .footer,
  .item-name {
    color: #aaa;
  }

  .folder-item,
  .result-item {
    background-color: #2d2d2d;
    border-color: #3d3d3d;
    color: #e0e0e0;
  }

  .folder-item:hover {
    background-color: #353535;
    border-color: #4d4d4d;
  }

  .folder-item-last-visited {
    background-color: #1f3557;
    border-color: #3e6aa8;
    box-shadow: 0 0 0 1px #3e6aa8 inset;
  }

  .folder-item-last-visited:hover {
    background-color: #264068;
    border-color: #4d7dbd;
  }

  .folder-name,
  .info-value,
  .preview-info-title {
    color: #f1f1f1;
  }

  .folder-counts {
    color: #9098a2;
  }

  .folder-count-separator {
    color: #666f79;
  }

  .item-thumbnail {
    background-color: #252525;
  }

  .item-preview-btn,
  .preview-close-btn,
  .preview-action-btn {
    background-color: rgba(40, 40, 40, 0.92);
    color: #ddd;
  }

  .preview-action-btn.primary {
    background-color: #1e6fb3;
    color: #fff;
  }

  .result-item.selected {
    background-color: #1a3a5c;
  }

  .result-item.removed.selected {
    background-color: #482220;
  }

  .preview-modal {
    background-color: #232323;
  }

  .preview-image-container {
    background-color: #111;
  }

  .preview-image-placeholder {
    color: rgba(255, 255, 255, 0.6);
  }

  .status-badge.cropped {
    background-color: #40464d;
    color: #d9dde1;
  }

  .crop-selection {
    border-color: #f5f7fa;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.48);
  }

  .crop-grid-line {
    background-color: rgba(245, 247, 250, 0.7);
  }

  .crop-handle {
    background-color: #f5f7fa;
    border-color: #f5f7fa;
  }

  .preview-info-table td {
    border-bottom-color: #353535;
  }

  .info-label {
    color: #999;
  }

  .size-slider-group {
    background-color: #333;
  }

  .size-slider {
    background: #555;
  }

  .size-slider::-webkit-slider-thumb {
    background: #444;
    border-color: #666;
  }

  .size-icon,
  .folder-chevron {
    color: #888;
  }
}
</style>
