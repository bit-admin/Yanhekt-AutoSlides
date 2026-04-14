<template>
  <div class="pdfmaker-window">
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="sort-btn" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrderHint') : $t('pdfmaker.sortAZ') }}
        </button>

        <button class="refresh-btn" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.refresh') }}
        </button>
      </div>

      <div class="toolbar-right">
        <label class="reduce-toggle">
          <input type="checkbox" v-model="reduceEnabled" />
          <span>{{ $t('pdfmaker.reduceSize') }}</span>
        </label>

        <div class="reduce-config-group" :class="{ disabled: !reduceEnabled }">
          <select v-model="reduceEffort" class="effort-select" :disabled="!reduceEnabled">
            <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
            <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
            <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
            <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
          </select>

          <div class="config-item">
            <label class="config-label">{{ $t('pdfmaker.colors') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="config-value">{{ customColors }}</span>
            <select v-else v-model="customColors" class="custom-select" :disabled="!reduceEnabled">
              <option :value="null">{{ $t('pdfmaker.colorsOriginal') }}</option>
              <option :value="256">256</option>
              <option :value="128">128</option>
              <option :value="64">64</option>
              <option :value="32">32</option>
              <option :value="16">16</option>
            </select>
          </div>

          <div class="config-item">
            <label class="config-label">{{ $t('pdfmaker.size') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="config-value">{{ displaySize }}</span>
            <select v-else v-model="customSize" class="custom-select" :disabled="!reduceEnabled">
              <option value="original">1920×1080</option>
              <option value="1600x900">1600×900</option>
              <option value="1280x720">1280×720</option>
              <option value="960x540">960×540</option>
              <option value="854x480">854×480</option>
            </select>
          </div>
        </div>

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
      </div>
    </div>

    <div class="content-area">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('pdfmaker.loading') }}</span>
      </div>

      <div v-else-if="sortedFolders.length === 0" class="empty-state">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
        </svg>
        <span>{{ $t('pdfmaker.noFolders') }}</span>
      </div>

      <div v-else class="folder-list">
        <div
          v-for="(folder, index) in sortedFolders"
          :key="folder.name"
          class="folder-item"
          :class="{
            selected: selectedItems.includes(folder.name),
            'drag-over': dragOverIndex === index,
            dragging: dragStartIndex === index
          }"
          @click="toggleSelection(folder.name)"
          :draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
        >
          <div class="item-checkbox">
            <input
              type="checkbox"
              :checked="selectedItems.includes(folder.name)"
              @click.stop
              @change="toggleSelection(folder.name)"
            />
          </div>

          <div class="folder-icon">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
              <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
            </svg>
          </div>

          <span class="folder-name">{{ formatToolFolderName(folder.name) }}</span>

          <div class="drag-handle" :title="$t('pdfmaker.customOrderHint')">
            <svg width="20" height="20" viewBox="0 0 16 16">
              <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isGenerating" class="progress-bar-container">
      <div
        class="progress-bar"
        :style="{ width: `${(generateProgress.current / generateProgress.total) * 100}%` }"
      ></div>
    </div>

    <div class="footer">
      <span>{{ $t('pdfmaker.selected') }}: {{ selectedItems.length }} / {{ $t('pdfmaker.total') }}: {{ sortedFolders.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePdfMaker } from '../composables/usePdfMaker'
import { formatToolFolderName } from '../utils/toolWindowFolders'

const { t } = useI18n()

const {
  selectedItems,
  sortedFolders,
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
  refresh,
  toggleSelection,
  handleFolderReorder,
  resetSortOrder,
  enableCustomOrder,
  makePdf,
} = usePdfMaker()

const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const toggleSortOrder = () => {
  if (useCustomOrder.value) {
    resetSortOrder()
  } else {
    enableCustomOrder()
  }
}

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

const handleMakePdf = async () => {
  if (selectedItems.value.length === 0) return

  const result = await makePdf()

  if (result.success && result.path) {
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t('pdfmaker.openPdf'), 'OK'],
      defaultId: 0,
      title: t('pdfmaker.pdfSavedTitle'),
      message: t('pdfmaker.pdfSaved', { path: result.path }),
    })

    if (response?.response === 0 && result.path) {
      await window.electronAPI.shell?.openPath?.(result.path)
    }
  } else if (result.error && result.error !== 'Cancelled') {
    await window.electronAPI.dialog?.showMessageBox?.({
      type: 'error',
      buttons: ['OK'],
      title: t('pdfmaker.errorTitle'),
      message: result.error,
    })
  }
}

onMounted(() => {
  loadFolders()
})
</script>

<style scoped>
.pdfmaker-window {
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
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-btn,
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

.sort-btn:hover,
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

.effort-select,
.custom-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 13px;
  cursor: pointer;
}

.effort-select:disabled,
.custom-select:disabled {
  cursor: not-allowed;
  background-color: #f5f5f5;
  color: #999;
}

.effort-select:focus,
.custom-select:focus {
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

.item-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.progress-bar-container {
  height: 3px;
  background-color: #e0e0e0;
  width: 100%;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #007acc;
  transition: width 0.15s ease-out;
}

.footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 8px 16px;
  background-color: #fafafa;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-color-scheme: dark) {
  .pdfmaker-window {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .toolbar,
  .footer {
    background-color: #252525;
    border-color: #3d3d3d;
  }

  .sort-btn,
  .refresh-btn,
  .effort-select,
  .custom-select {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .sort-btn:hover,
  .refresh-btn:hover:not(:disabled) {
    background-color: #404040;
    border-color: #666;
  }

  .reduce-toggle,
  .config-value {
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

  .content-area {
    background-color: #1e1e1e;
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
}
</style>
