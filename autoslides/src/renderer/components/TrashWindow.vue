<template>
  <div class="trash-window">
    <!-- Title Bar -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-bar-drag-region">
        <span class="title-text">{{ $t('trash.title') }}</span>
      </div>
      <div v-if="!isMacOS" class="window-controls">
        <button class="window-btn minimize-btn" @click="minimizeWindow" :title="$t('window.minimize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="window-btn maximize-btn" @click="maximizeWindow" :title="$t('window.maximize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="window-btn close-btn" @click="closeWindow" :title="$t('window.close')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="filters">
        <!-- Folder Filter -->
        <div class="filter-group">
          <label>{{ $t('trash.filterFolder') }}:</label>
          <select v-model="selectedFolder" class="filter-select folder-select">
            <option value="">{{ $t('trash.all') }}</option>
            <option v-for="folder in uniqueFolders" :key="folder" :value="folder">{{ formatFolderName(folder) }}</option>
          </select>
        </div>

        <!-- Reason Filter -->
        <div class="filter-group">
          <label>{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="filter-select">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFiltered') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </div>

        <!-- Refresh Button -->
        <button class="refresh-btn" @click="refreshEntries" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('trash.refresh') }}
        </button>
      </div>

      <div class="actions">
        <!-- Restore Button -->
        <button
          class="restore-btn"
          @click="restoreSelected"
          :disabled="selectedIds.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
            <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
          </svg>
          {{ $t('trash.restore') }}
        </button>

        <!-- Clear Trash Button -->
        <button
          class="clear-btn"
          @click="clearTrash"
          :disabled="entries.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearTrash') }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('trash.loading') }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredEntries.length === 0" class="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M20 8v4H8v8h48v-8H44V8H20zm-8 16l4 36h32l4-36H12zm16 8h2v24h-2V32zm6 0h2v24h-2V32z" fill="currentColor" opacity="0.3"/>
        </svg>
        <span>{{ $t('trash.emptyTrash') }}</span>
      </div>

      <!-- Grid View -->
      <div v-else class="trash-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="trash-item"
          :class="{ selected: selectedIds.includes(entry.id) }"
          @click="toggleSelection(entry.id)"
        >
          <!-- Checkbox -->
          <div class="item-checkbox">
            <input
              type="checkbox"
              :checked="selectedIds.includes(entry.id)"
              @click.stop
              @change="toggleSelection(entry.id)"
            />
          </div>

          <!-- Preview Button -->
          <button class="item-preview-btn" @click.stop="openPreview(entry)" :title="$t('trash.preview')">
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 2v5h2V4h3V2H2zm9 0v2h3v3h2V2h-5zM4 11H2v5h5v-2H4v-3zm10 0v3h-3v2h5v-5h-2z" fill="currentColor"/>
            </svg>
          </button>

          <!-- Thumbnail -->
          <div class="item-thumbnail" :style="{ height: `${thumbnailSize * 0.6}px` }">
            <img
              v-if="thumbnails[entry.id]"
              :src="`data:image/png;base64,${thumbnails[entry.id]}`"
              :alt="entry.filename"
            />
            <div v-else class="thumbnail-placeholder">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
              </svg>
            </div>
          </div>

          <!-- Compact Info: folder • reason -->
          <div class="item-info-compact">
            <span class="item-folder-compact">{{ formatFolderName(entry.originalParentFolder) }}</span>
            <span class="item-separator">•</span>
            <span :class="['item-reason-compact', `reason-${entry.reason}`]">{{ getReasonLabel(entry.reason) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>{{ $t('trash.selected') }}: {{ selectedIds.length }} / {{ $t('trash.total') }}: {{ filteredEntries.length }}</span>

      <!-- Size Slider (like Finder) -->
      <div class="size-slider-group">
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

    <!-- Preview Modal -->
    <div v-if="previewEntry" class="preview-modal-overlay" @click="closePreview">
      <div class="preview-modal" @click.stop>
        <!-- Close Button -->
        <button class="preview-close-btn" @click="closePreview">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Modal Content -->
        <div class="preview-content">
          <!-- Left: Image (16:9 aspect ratio for 1920x1080) -->
          <div class="preview-image-container">
            <img
              v-if="thumbnails[previewEntry.id]"
              :src="`data:image/png;base64,${thumbnails[previewEntry.id]}`"
              :alt="previewEntry.filename"
              class="preview-image"
            />
            <div v-else class="preview-image-placeholder">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.2"/>
              </svg>
            </div>
          </div>

          <!-- Right: Metadata Table -->
          <div class="preview-info-container">
            <div class="preview-info-title">{{ $t('trash.metadata') }}</div>
            <table class="preview-info-table">
              <tbody>
                <!-- <tr>
                  <td class="info-label">ID</td>
                  <td class="info-value">{{ previewEntry.id }}</td>
                </tr> -->
                <tr>
                  <td class="info-label">{{ $t('trash.filename') }}</td>
                  <td class="info-value">{{ previewEntry.filename }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.originalPath') }}</td>
                  <td class="info-value info-path">{{ previewEntry.originalPath }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.folder') }}</td>
                  <td class="info-value">{{ previewEntry.originalParentFolder }}</td>
                </tr>
                <!-- <tr>
                  <td class="info-label">{{ $t('trash.trashPath') }}</td>
                  <td class="info-value info-path">{{ previewEntry.trashPath }}</td>
                </tr> -->
                <tr>
                  <td class="info-label">{{ $t('trash.filterReason') }}</td>
                  <td class="info-value">
                    <span :class="['info-reason-badge', `reason-${previewEntry.reason}`]">{{ getReasonLabel(previewEntry.reason) }}</span>
                  </td>
                </tr>
                <tr v-if="previewEntry.reasonDetails">
                  <td class="info-label">{{ $t('trash.reasonDetails') }}</td>
                  <td class="info-value">{{ previewEntry.reasonDetails }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.trashedAt') }}</td>
                  <td class="info-value">{{ formatDate(previewEntry.trashedAt) }}</td>
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface TrashEntry {
  id: string
  filename: string
  originalPath: string
  originalParentFolder: string
  trashPath: string
  reason: 'duplicate' | 'exclusion' | 'ai_filtered' | 'manual'
  reasonDetails?: string
  trashedAt: string
}

const { t } = useI18n()

// Platform detection
const isMacOS = navigator.userAgent.includes('Mac')

// State
const entries = ref<TrashEntry[]>([])
const selectedIds = ref<string[]>([])
const selectedFolder = ref('')
const selectedReason = ref('')
const isLoading = ref(false)
const thumbnails = ref<Record<string, string>>({})
const thumbnailSize = ref(250) // Default size: 250px for bigger thumbnails
const previewEntry = ref<TrashEntry | null>(null) // Entry being previewed in modal

// Computed
const uniqueFolders = computed(() => {
  const folders = new Set<string>()
  entries.value.forEach(entry => folders.add(entry.originalParentFolder))
  return Array.from(folders).sort()
})

const filteredEntries = computed(() => {
  return entries.value.filter(entry => {
    if (selectedFolder.value && entry.originalParentFolder !== selectedFolder.value) {
      return false
    }
    if (selectedReason.value && entry.reason !== selectedReason.value) {
      return false
    }
    return true
  })
})

// Methods
const formatFolderName = (folder: string): string => {
  // Remove "slides_" prefix if present
  return folder.startsWith('slides_') ? folder.substring(7) : folder
}

const getReasonLabel = (reason: string): string => {
  switch (reason) {
    case 'duplicate': return t('trash.duplicate')
    case 'exclusion': return t('trash.exclusion')
    case 'ai_filtered': return t('trash.aiFiltered')
    case 'manual': return t('trash.manual')
    default: return reason
  }
}

const openPreview = (entry: TrashEntry) => {
  previewEntry.value = entry
}

const closePreview = () => {
  previewEntry.value = null
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch {
    return dateString
  }
}

const refreshEntries = async () => {
  isLoading.value = true
  selectedIds.value = []
  thumbnails.value = {}

  try {
    entries.value = await window.electronAPI.trash.getEntries()
    // Load thumbnails in background
    loadThumbnails()
  } catch (error) {
    console.error('Failed to load trash entries:', error)
  } finally {
    isLoading.value = false
  }
}

const loadThumbnails = async () => {
  for (const entry of entries.value) {
    if (!thumbnails.value[entry.id]) {
      try {
        const base64 = await window.electronAPI.trash.getImageAsBase64(entry.trashPath)
        thumbnails.value[entry.id] = base64
      } catch (error) {
        console.warn(`Failed to load thumbnail for ${entry.filename}:`, error)
      }
    }
  }
}

const toggleSelection = (id: string) => {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const restoreSelected = async () => {
  if (selectedIds.value.length === 0) return

  isLoading.value = true
  try {
    // Create a plain array copy to avoid Vue Proxy serialization issues with IPC
    const idsToRestore = [...selectedIds.value]
    const result = await window.electronAPI.trash.restore(idsToRestore)
    console.log(`Restored ${result.restored} items, ${result.failed} failed`)

    // Refresh the list
    await refreshEntries()
  } catch (error) {
    console.error('Failed to restore items:', error)
  } finally {
    isLoading.value = false
  }
}

const clearTrash = async () => {
  // Confirm dialog
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearTrash')],
    defaultId: 0,
    cancelId: 0,
    title: t('trash.confirmClearTitle'),
    message: t('trash.confirmClear')
  })

  if (confirmed?.response !== 1) return

  isLoading.value = true
  try {
    const result = await window.electronAPI.trash.clear()
    console.log(`Cleared ${result.cleared} items, ${result.failed} failed`)

    // Refresh the list
    await refreshEntries()
  } catch (error) {
    console.error('Failed to clear trash:', error)
  } finally {
    isLoading.value = false
  }
}

// Window controls
const minimizeWindow = () => {
  window.electronAPI.window?.minimize?.()
}

const maximizeWindow = () => {
  window.electronAPI.window?.maximize?.()
}

const closeWindow = () => {
  window.electronAPI.window?.close?.()
}

const startDrag = () => {
  // Handled by -webkit-app-region: drag in CSS
}

// Load data on mount
onMounted(() => {
  refreshEntries()
})
</script>

<style scoped>
.trash-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
  color: #333;
}

/* Title Bar */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #e0e0e0;
  -webkit-app-region: drag;
  padding: 0 8px;
}

.title-bar-drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 70px; /* Space for traffic lights on macOS */
}

.title-text {
  font-size: 13px;
  font-weight: 500;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.window-btn:hover {
  background-color: #e0e0e0;
}

.close-btn:hover {
  background-color: #e81123;
  color: white;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: #fafafa;
  border-bottom: 1px solid #e0e0e0;
  flex-wrap: nowrap;
  gap: 12px;
}

.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
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

.filter-select {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  min-width: 100px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #007acc;
}

.folder-select {
  width: 220px;
  min-width: 220px;
  max-width: 220px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.refresh-btn {
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

.refresh-btn:hover:not(:disabled) {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Size Slider (Finder-like) */
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

.size-slider::-webkit-slider-thumb:hover {
  background: #f5f5f5;
  border-color: #666;
}

.size-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #fff;
  border: 1px solid #999;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.size-slider::-moz-range-thumb:hover {
  background: #f5f5f5;
  border-color: #666;
}

.restore-btn, .clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.restore-btn {
  background-color: #007acc;
  color: white;
}

.restore-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.restore-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.clear-btn {
  background-color: #dc3545;
  color: white;
}

.clear-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.clear-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state, .empty-state {
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

/* Trash Grid */
.trash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.trash-item {
  position: relative;
  background-color: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.trash-item:hover {
  border-color: #007acc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.trash-item.selected {
  border-color: #007acc;
  background-color: #e7f3ff;
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

.item-thumbnail {
  width: 100%;
  height: 100px;
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
  color: #ccc;
}

/* Preview Button */
.item-preview-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
}

.trash-item:hover .item-preview-btn {
  opacity: 1;
}

.item-preview-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

/* Compact Info Display */
.item-info-compact {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  overflow: hidden;
}

.item-folder-compact {
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.item-separator {
  color: #999;
  flex-shrink: 0;
}

.item-reason-compact {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* Keep existing item-info for backwards compatibility */
.item-info {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-filename {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-folder {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-reason {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.reason-duplicate {
  background-color: #ffc107;
  color: #856404;
}

.reason-exclusion {
  background-color: #17a2b8;
  color: white;
}

.reason-ai_filtered {
  background-color: #6f42c1;
  color: white;
}

.reason-manual {
  background-color: #6c757d;
  color: white;
}

/* Preview Modal */
.preview-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-modal {
  position: relative;
  background: white;
  border-radius: 8px;
  max-width: 95vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.preview-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.2s;
}

.preview-close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.preview-content {
  display: flex;
  max-height: 90vh;
}

.preview-image-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.preview-image {
  max-width: 70vw;
  max-height: 90vh;
  object-fit: contain;
}

.preview-image-placeholder {
  color: #555;
  padding: 100px;
}

/* Metadata Table */
.preview-info-container {
  width: 300px;
  background: #f8f8f8;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 90vh;
}

.preview-info-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.preview-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.preview-info-table tr {
  border-bottom: 1px solid #eee;
}

.preview-info-table tr:last-child {
  border-bottom: none;
}

.info-label {
  padding: 8px 8px 8px 0;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
  vertical-align: top;
  width: 80px;
}

.info-value {
  padding: 8px 0;
  color: #333;
  word-break: break-word;
}

.info-path {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 11px;
  color: #555;
  word-break: break-all;
}

.info-reason-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

/* Footer */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  background-color: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .trash-window {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .title-bar {
    background-color: #2d2d2d;
    border-bottom-color: #404040;
  }

  .window-btn {
    color: #e0e0e0;
  }

  .window-btn:hover {
    background-color: #404040;
  }

  .toolbar {
    background-color: #252525;
    border-bottom-color: #404040;
  }

  .filter-group label {
    color: #999;
  }

  .filter-select {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .filter-select:focus {
    border-color: #007acc;
  }

  .refresh-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .refresh-btn:hover:not(:disabled) {
    background-color: #404040;
    border-color: #666;
  }

  .size-slider-group {
    background-color: #333;
  }

  .size-icon {
    color: #999;
  }

  .size-slider {
    background: #555;
  }

  .size-slider::-webkit-slider-thumb {
    background: #666;
    border-color: #888;
  }

  .size-slider::-webkit-slider-thumb:hover {
    background: #777;
    border-color: #999;
  }

  .size-slider::-moz-range-thumb {
    background: #666;
    border-color: #888;
  }

  .size-slider::-moz-range-thumb:hover {
    background: #777;
    border-color: #999;
  }

  .content-area {
    background-color: #1e1e1e;
  }

  .loading-state, .empty-state {
    color: #666;
  }

  .spinner {
    border-color: #404040;
    border-top-color: #007acc;
  }

  .trash-item {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .trash-item:hover {
    border-color: #007acc;
  }

  .trash-item.selected {
    background-color: #1a3a5c;
    border-color: #007acc;
  }

  .item-thumbnail {
    background-color: #333;
  }

  .thumbnail-placeholder {
    color: #555;
  }

  .item-filename {
    color: #e0e0e0;
  }

  .item-folder {
    color: #999;
  }

  .item-folder-compact {
    color: #999;
  }

  .item-separator {
    color: #666;
  }

  .preview-modal {
    background: #2d2d2d;
  }

  .preview-close-btn {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .preview-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .preview-image-container {
    background: #000;
  }

  .preview-info-container {
    background: #2d2d2d;
  }

  .preview-info-title {
    color: #e0e0e0;
    border-bottom-color: #404040;
  }

  .preview-info-table tr {
    border-bottom-color: #404040;
  }

  .info-label {
    color: #999;
  }

  .info-value {
    color: #e0e0e0;
  }

  .info-path {
    color: #aaa;
  }

  .footer {
    background-color: #252525;
    border-top-color: #404040;
    color: #999;
  }
}
</style>
