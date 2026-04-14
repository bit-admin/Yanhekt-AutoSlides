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
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </div>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="filter-select" :disabled="!hasRemovedItems">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFiltered') }}</option>
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

    <div class="content-area">
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
            @click="openFolder(folder)"
          >
            <div class="folder-icon">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <div class="folder-copy">
              <span class="folder-name">{{ formatToolFolderName(folder.name) }}</span>
              <div class="folder-counts">
                <span class="count-badge active">{{ $t('trash.active') }} {{ folder.activeCount }}</span>
                <span class="count-badge removed">{{ $t('trash.removed') }} {{ folder.removedCount }}</span>
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

            <div class="item-thumbnail" :style="{ height: `${thumbnailSize * 0.6}px` }">
              <img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" :alt="item.name" />
              <div v-else class="thumbnail-placeholder">
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
                </svg>
              </div>
            </div>

            <div class="item-copy">
              <div class="item-badges">
                <span class="status-badge" :class="item.status">{{ getStatusLabel(item.status) }}</span>
                <span v-if="item.status === 'removed' && item.reason" :class="['reason-badge', `reason-${item.reason}`]">
                  {{ getReasonLabel(item.reason) }}
                </span>
              </div>
              <div class="item-name">{{ formatImageName(item.name) }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="footer">
      <span v-if="currentView === 'folders'">{{ $t('trash.total') }}: {{ folders.length }}</span>
      <span v-else>{{ $t('trash.selected') }}: {{ selectedIds.length }} / {{ $t('trash.total') }}: {{ filteredItems.length }}</span>

      <div v-if="currentView === 'images'" class="size-slider-group">
        <svg width="12" height="12" viewBox="0 0 16 16" class="size-icon small">
          <rect x="3" y="3" width="10" height="10" fill="currentColor" opacity="0.6"/>
        </svg>
        <input
          type="range"
          v-model="thumbnailSize"
          min="150"
          max="400"
          step="25"
          class="size-slider"
        />
        <svg width="16" height="16" viewBox="0 0 16 16" class="size-icon large">
          <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.6"/>
        </svg>
      </div>
    </div>

    <div v-if="previewItem" class="preview-modal-overlay" @click="closePreview">
      <div class="preview-modal" @click.stop>
        <button class="preview-close-btn" @click="closePreview">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="preview-content">
          <div class="preview-image-container">
            <img
              v-if="thumbnails[previewItem.id]"
              :src="thumbnails[previewItem.id]"
              :alt="previewItem.name"
              class="preview-image"
            />
            <div v-else class="preview-image-placeholder">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.2"/>
              </svg>
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
                    <span class="status-badge" :class="previewItem.status">{{ getStatusLabel(previewItem.status) }}</span>
                  </td>
                </tr>
                <tr v-if="previewItem.status === 'active'">
                  <td class="info-label">{{ $t('trash.currentPath') }}</td>
                  <td class="info-value info-path">{{ previewItem.imagePath || previewItem.originalPath }}</td>
                </tr>
                <tr v-else>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResultsView, type ResultsReason } from '../composables/useResultsView'

const { t } = useI18n()

const {
  folders,
  currentView,
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
  openFolder,
  goBack,
  refresh,
  toggleSelection,
  openPreview,
  closePreview,
  deleteSelected,
  restoreSelected,
  clearTrash,
  formatDate,
  formatToolFolderName,
} = useResultsView()

const canClearTrash = computed(() => {
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
      return t('trash.aiFiltered')
    case 'manual':
      return t('trash.manual')
    default:
      return reason
  }
}

const getStatusLabel = (status: 'active' | 'removed') => {
  return status === 'active' ? t('trash.active') : t('trash.removed')
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

const confirmClearTrash = async () => {
  if (!canClearTrash.value) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearTrash')],
    defaultId: 1,
    cancelId: 0,
    title: t('trash.confirmClearTitle'),
    message: t('trash.confirmClear'),
  })

  if (confirmed?.response === 1) {
    await clearTrash()
  }
}
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

.folder-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-copy {
  flex: 1;
  min-width: 0;
}

.folder-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2b2b2b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-counts {
  display: flex;
  gap: 8px;
  margin-top: 6px;
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

.count-badge.active,
.status-badge.active {
  background-color: #e7f3ff;
  color: #1768a8;
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
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  color: #c3c7cb;
}

.item-copy {
  padding: 10px;
}

.item-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.item-name {
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
  width: 80px;
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
  max-height: calc(100vh - 48px);
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
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
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  min-height: 420px;
}

.preview-image-container {
  background-color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.preview-image,
.preview-image-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
}

.preview-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
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

  .folder-name,
  .info-value,
  .preview-info-title {
    color: #f1f1f1;
  }

  .item-thumbnail {
    background-color: #252525;
  }

  .item-preview-btn,
  .preview-close-btn {
    background-color: rgba(40, 40, 40, 0.92);
    color: #ddd;
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
