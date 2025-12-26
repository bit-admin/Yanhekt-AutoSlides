<template>
  <div class="pdfmaker-window">
    <!-- Title Bar -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-bar-drag-region">
        <span class="title-text">{{ $t('pdfmaker.title') }}</span>
        <!-- Breadcrumb when in images view -->
        <template v-if="currentView === 'images'">
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-folder">{{ currentFolderDisplayName }}</span>
        </template>
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
      <div class="toolbar-left">
        <!-- Back Button (images view only) -->
        <button v-if="currentView === 'images'" class="back-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          {{ $t('pdfmaker.back') }}
        </button>

        <!-- Sort Toggle (folders view only) -->
        <button v-if="currentView === 'folders'" class="sort-btn" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrderHint') : $t('pdfmaker.sortAZ') }}
        </button>

        <!-- Refresh Button -->
        <button class="refresh-btn" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.refresh') }}
        </button>
      </div>

      <div class="toolbar-right">
        <!-- PDF Config and Make Button (folders view) -->
        <template v-if="currentView === 'folders'">
          <!-- Reduce Size Toggle -->
          <label class="reduce-toggle">
            <input type="checkbox" v-model="reduceEnabled" />
            <span>{{ $t('pdfmaker.reduceSize') }}</span>
          </label>

          <div class="reduce-config-group" :class="{ disabled: !reduceEnabled }">
            <!-- Effort Selection -->
            <select v-model="reduceEffort" class="effort-select" :disabled="!reduceEnabled">
              <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
              <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
              <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
              <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
            </select>

            <!-- Colors: Text display for presets, dropdown for custom -->
            <div class="config-item">
              <label class="config-label">{{ $t('pdfmaker.colors') }}</label>
              <span v-if="reduceEffort !== 'custom'" class="config-value">{{ customColors }}</span>
              <select
                v-else
                v-model="customColors"
                class="custom-select"
                :disabled="!reduceEnabled"
              >
                <option :value="null">{{ $t('pdfmaker.colorsOriginal') }}</option>
                <option :value="256">256</option>
                <option :value="128">128</option>
                <option :value="64">64</option>
                <option :value="32">32</option>
                <option :value="16">16</option>
              </select>
            </div>

            <!-- Size: Text display for presets, dropdown for custom -->
            <div class="config-item">
              <label class="config-label">{{ $t('pdfmaker.size') }}</label>
              <span v-if="reduceEffort !== 'custom'" class="config-value">{{ displaySize }}</span>
              <select
                v-else
                v-model="customSize"
                class="custom-select"
                :disabled="!reduceEnabled"
              >
                <option value="original">1920×1080</option>
                <option value="1600x900">1600×900</option>
                <option value="1280x720">1280×720</option>
                <option value="960x540">960×540</option>
                <option value="854x480">854×480</option>
              </select>
            </div>
          </div>

          <!-- Make PDF Button -->
          <button
            class="make-pdf-btn"
            @click="handleMakePdf"
            :disabled="selectedItems.length === 0 || isGenerating"
          >
            <svg v-if="!isGenerating" width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
            </svg>
            <span v-if="isGenerating" class="progress-text">
              {{ generateProgress.current }}/{{ generateProgress.total }}
            </span>
            <span v-else>{{ $t('pdfmaker.makePdf') }}</span>
          </button>
        </template>

        <!-- Delete Button (images view only) -->
        <button
          v-if="currentView === 'images'"
          class="delete-btn"
          @click="confirmDelete"
          :disabled="selectedItems.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.delete') }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('pdfmaker.loading') }}</span>
      </div>

      <!-- Folders View -->
      <template v-else-if="currentView === 'folders'">
        <!-- Empty State -->
        <div v-if="sortedFolders.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>{{ $t('pdfmaker.noFolders') }}</span>
        </div>

        <!-- Folder List -->
        <div v-else class="folder-list">
          <div
            v-for="(folder, index) in sortedFolders"
            :key="folder.name"
            class="folder-item"
            :class="{ selected: selectedItems.includes(folder.name), 'drag-over': dragOverIndex === index, 'dragging': dragStartIndex === index }"
            @click="toggleSelection(folder.name)"
            @dblclick="openFolder(folder)"
            :draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver($event, index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <!-- Checkbox -->
            <div class="item-checkbox">
              <input
                type="checkbox"
                :checked="selectedItems.includes(folder.name)"
                @click.stop
                @change="toggleSelection(folder.name)"
              />
            </div>

            <!-- Folder Icon -->
            <div class="folder-icon">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <!-- Folder Name -->
            <span class="folder-name">{{ formatFolderName(folder.name) }}</span>

            <!-- Drag Handle -->
            <div class="drag-handle" title="Drag to reorder">
              <svg width="20" height="20" viewBox="0 0 16 16">
                <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>
      </template>

      <!-- Images View -->
      <template v-else>
        <!-- Empty State -->
        <div v-if="sortedImages.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.3"/>
            <circle cx="22" cy="22" r="6" fill="currentColor" opacity="0.2"/>
            <path d="M8 44l16-16 12 12 12-16 8 8v24H8V44z" fill="currentColor" opacity="0.2"/>
          </svg>
          <span>{{ $t('pdfmaker.noImages') }}</span>
        </div>

        <!-- Images Grid -->
        <div v-else class="images-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }">
          <div
            v-for="image in sortedImages"
            :key="image.name"
            class="image-item"
            :class="{ selected: selectedItems.includes(image.name) }"
            @click="toggleSelection(image.name)"
          >
            <!-- Checkbox -->
            <div class="item-checkbox">
              <input
                type="checkbox"
                :checked="selectedItems.includes(image.name)"
                @click.stop
                @change="toggleSelection(image.name)"
              />
            </div>

            <!-- Thumbnail -->
            <div class="item-thumbnail" :style="{ height: `${thumbnailSize * 0.6}px` }">
              <img
                v-if="thumbnails[image.name]"
                :src="thumbnails[image.name]"
                :alt="image.name"
              />
              <div v-else class="thumbnail-placeholder">
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <rect x="4" y="4" width="24" height="24" fill="currentColor" opacity="0.2"/>
                </svg>
              </div>
            </div>

            <!-- Image Name -->
            <div class="item-name">
              {{ formatImageName(image.name) }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>{{ $t('pdfmaker.selected') }}: {{ selectedItems.length }} / {{ $t('pdfmaker.total') }}: {{ currentView === 'folders' ? sortedFolders.length : sortedImages.length }}</span>

      <!-- Size Slider (images view only) -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePdfMaker } from '../composables/usePdfMaker'

const { t } = useI18n()

// Platform detection
const isMacOS = navigator.userAgent.includes('Mac')

// Composable
const {
  currentView,
  currentFolderDisplayName,
  selectedItems,
  sortedFolders,
  sortedImages,
  thumbnails,
  thumbnailSize,
  isLoading,
  useCustomOrder,
  reduceEnabled,
  reduceEffort,
  customColors,
  customSize,
  displaySize,
  isGenerating,
  generateProgress,
  loadFolders,
  openFolder,
  goBack,
  refresh,
  toggleSelection,
  deleteSelected,
  handleFolderReorder,
  resetSortOrder,
  enableCustomOrder,
  makePdf,
} = usePdfMaker()

// Drag and drop state
const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Format folder name (remove slides_ prefix)
const formatFolderName = (name: string): string => {
  return name.startsWith('slides_') ? name.slice(7) : name
}

// Format image name (remove extension)
const formatImageName = (name: string): string => {
  return name.replace(/\.png$/i, '')
}

// Toggle sort order
const toggleSortOrder = () => {
  if (useCustomOrder.value) {
    // Switch back to A-Z sort
    resetSortOrder()
  } else {
    // Switch to custom order mode (preserve current sorted order as the custom order)
    enableCustomOrder()
  }
}

// Drag and drop handlers
const onDragStart = (event: DragEvent, index: number) => {
  dragStartIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

const onDragLeave = () => {
  dragOverIndex.value = null
}

const onDrop = (event: DragEvent, toIndex: number) => {
  event.preventDefault()
  if (dragStartIndex.value !== null && dragStartIndex.value !== toIndex) {
    handleFolderReorder(dragStartIndex.value, toIndex)
  }
  dragStartIndex.value = null
  dragOverIndex.value = null
}

const onDragEnd = () => {
  dragStartIndex.value = null
  dragOverIndex.value = null
}

// Confirm delete
const confirmDelete = async () => {
  if (selectedItems.value.length === 0) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('pdfmaker.cancel'), t('pdfmaker.delete')],
    defaultId: 1,
    cancelId: 0,
    title: t('pdfmaker.confirmDeleteTitle'),
    message: t('pdfmaker.confirmDelete', { count: selectedItems.value.length })
  })

  if (confirmed?.response === 1) {
    await deleteSelected()
  }
}

// Handle Make PDF button click
const handleMakePdf = async () => {
  if (selectedItems.value.length === 0 || currentView.value !== 'folders') return

  const result = await makePdf()

  if (result.success && result.path) {
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t('pdfmaker.openPdf'), 'OK'],
      defaultId: 0,
      title: t('pdfmaker.pdfSavedTitle'),
      message: t('pdfmaker.pdfSaved', { path: result.path })
    })

    // Open PDF if user clicked "Open PDF" button (index 0)
    if (response?.response === 0 && result.path) {
      await window.electronAPI.shell?.openPath?.(result.path)
    }
  } else if (result.error && result.error !== 'Cancelled') {
    await window.electronAPI.dialog?.showMessageBox?.({
      type: 'error',
      buttons: ['OK'],
      title: t('pdfmaker.errorTitle'),
      message: result.error
    })
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
  loadFolders()
})
</script>

<style scoped>
.pdfmaker-window {
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
  gap: 4px;
}

.title-text {
  font-size: 13px;
  font-weight: 500;
}

.breadcrumb-separator {
  color: #999;
  font-size: 13px;
}

.breadcrumb-folder {
  font-size: 13px;
  color: #666;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: 12px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn, .sort-btn, .refresh-btn {
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

.back-btn:hover, .sort-btn:hover, .refresh-btn:hover:not(:disabled) {
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

.delete-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.delete-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.delete-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* PDF Config Controls */
.reduce-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.reduce-toggle:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.reduce-toggle input {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: #007bff;
}

.reduce-config-group {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

.reduce-config-group.disabled {
  opacity: 0.5;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.effort-select, .custom-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.effort-select:disabled, .custom-select:disabled {
  cursor: not-allowed;
  background-color: #f5f5f5;
  color: #999;
}

.effort-select:focus, .custom-select:focus {
  outline: none;
  border-color: #007acc;
}

.config-value {
  font-size: 13px;
  color: #666;
  padding: 4px 8px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  white-space: nowrap;
}

.make-pdf-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.make-pdf-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.make-pdf-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.progress-text {
  font-variant-numeric: tabular-nums;
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

/* Folder List */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background-color: white;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: #f8f9fa;
  border-color: #dee2e6;
}

.folder-item.selected {
  background-color: #e7f3ff;
  border-color: #007acc;
}

.folder-item.drag-over {
  border-color: #007acc;
  border-style: dashed;
  background-color: #f0f7ff;
}

.folder-item.dragging {
  opacity: 0.5;
}

/* Folder checkbox - inline, not absolute */
.folder-item .item-checkbox {
  position: static;
  flex-shrink: 0;
}

.folder-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.folder-name {
  flex: 1;
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drag-handle {
  flex-shrink: 0;
  cursor: grab;
  padding: 6px 8px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
  border-radius: 4px;
  color: #666;
}

.folder-item:hover .drag-handle {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.05);
}

.drag-handle:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.drag-handle:active {
  cursor: grabbing;
  background-color: rgba(0, 0, 0, 0.15);
}

/* Images Grid */
.images-grid {
  display: grid;
  gap: 16px;
}

.image-item {
  position: relative;
  background-color: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.image-item:hover {
  border-color: #007acc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-item.selected {
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

.item-name {
  padding: 8px 10px;
  font-size: 11px;
  color: #666;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Footer */
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

/* Size Slider */
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

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .pdfmaker-window {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .title-bar {
    background-color: #2d2d2d;
    border-bottom-color: #3d3d3d;
  }

  .title-text {
    color: #e0e0e0;
  }

  .breadcrumb-folder {
    color: #aaa;
  }

  .window-btn {
    color: #ccc;
  }

  .window-btn:hover {
    background-color: #3d3d3d;
  }

  .toolbar {
    background-color: #252525;
    border-bottom-color: #3d3d3d;
  }

  .back-btn, .sort-btn, .refresh-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .back-btn:hover, .sort-btn:hover, .refresh-btn:hover:not(:disabled) {
    background-color: #404040;
    border-color: #666;
  }

  .folder-item {
    background-color: #2d2d2d;
    border-color: #3d3d3d;
  }

  .folder-item:hover {
    background-color: #353535;
    border-color: #4d4d4d;
  }

  .folder-item.selected {
    background-color: #1a3a5c;
    border-color: #007acc;
  }

  .folder-name {
    color: #e0e0e0;
  }

  .drag-handle {
    color: #888;
  }

  .folder-item:hover .drag-handle {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .drag-handle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .drag-handle:active {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .image-item {
    background-color: #2d2d2d;
    border-color: #3d3d3d;
  }

  .image-item:hover {
    border-color: #007acc;
  }

  .image-item.selected {
    background-color: #1a3a5c;
    border-color: #007acc;
  }

  .item-thumbnail {
    background-color: #252525;
  }

  .item-name {
    color: #aaa;
  }

  .footer {
    background-color: #252525;
    border-top-color: #3d3d3d;
    color: #aaa;
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

  .size-icon {
    color: #888;
  }

  /* PDF Config Controls Dark Mode */
  .reduce-toggle {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .reduce-toggle:hover {
    background-color: #3d3d3d;
    border-color: #505050;
  }

  .config-label {
    color: #aaa;
  }

  .config-value {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #aaa;
  }

  .effort-select, .custom-select {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .effort-select:disabled, .custom-select:disabled {
    background-color: #2a2a2a;
    color: #666;
  }

  .effort-select:focus, .custom-select:focus {
    border-color: #007acc;
  }
}
</style>
