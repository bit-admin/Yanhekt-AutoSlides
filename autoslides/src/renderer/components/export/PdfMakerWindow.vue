<template>
  <div class="pdfmaker-window">
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrder') : $t('pdfmaker.sortAZ') }}
        </button>

        <button class="btn refresh-btn" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.refresh') }}
        </button>
      </div>

      <div class="toolbar-right">
        <div class="config-item">
          <label class="config-label">{{ $t('pdfmaker.aspectRatio') }}</label>
          <select v-model="aspectRatio" class="custom-select">
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

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
              <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ formatSizeOption(opt) }}</option>
            </select>
          </div>
        </div>

        <div class="export-menu" @click.stop>
          <button
            type="button"
            class="export-menu-toggle"
            :aria-expanded="isExportMenuOpen"
            aria-haspopup="menu"
            @click="toggleExportMenu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
            </svg>
            <span>{{ exportMenuLabel }}</span>
            <svg class="export-menu-chevron" width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>

          <div v-if="isExportMenuOpen" class="export-menu-panel" role="menu">
            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.outputFormat')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.outputFormat') }}</span>
              <div class="mode-segmented">
                <label class="mode-option" :class="{ active: outputFormat === 'pdf' }">
                  <input type="radio" v-model="outputFormat" value="pdf" />
                  <span>{{ $t('pdfmaker.formatPdf') }}</span>
                </label>
                <label class="mode-option" :class="{ active: outputFormat === 'pptx' }">
                  <input type="radio" v-model="outputFormat" value="pptx" />
                  <span>{{ $t('pdfmaker.formatPptx') }}</span>
                </label>
              </div>
            </div>

            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.outputMode')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.outputMode') }}</span>
              <div class="mode-segmented">
                <label class="mode-option" :class="{ active: outputMode === 'single' }">
                  <input type="radio" v-model="outputMode" value="single" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.combineOnePptx') : $t('pdfmaker.combineOnePdf') }}</span>
                </label>
                <label class="mode-option" :class="{ active: outputMode === 'batch' }">
                  <input type="radio" v-model="outputMode" value="batch" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.separatePptxs') : $t('pdfmaker.separatePdfs') }}</span>
                </label>
              </div>
            </div>

            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.pages')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.pages') }}</span>
              <label class="cover-toggle">
                <input type="checkbox" v-model="includeCover" />
                <span>{{ $t('pdfmaker.includeCover') }}</span>
              </label>
            </div>
          </div>
        </div>

        <button
          class="btn btn--primary"
          @click="handleMakePdf"
          :disabled="selectedItems.length === 0 || isGenerating"
        >
          <svg v-if="!isGenerating" width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
          </svg>
          <span v-if="isGenerating" class="progress-text">
            {{ generateProgress.current }}/{{ generateProgress.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: outputFormat.toUpperCase() }) }}</span>
        </button>
      </div>
    </div>

    <div class="content-area custom-scrollbar">
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
          v-for="(group, groupIdx) in courseGroups"
          :key="group.courseName || groupIdx"
          :class="{ 'course-group': isGroupingActive }"
        >
          <div
            v-if="isGroupingActive"
            class="course-header"
            @click="selectAllInCourse(group.folderNames)"
          >
            <input
              type="checkbox"
              class="course-checkbox"
              :checked="isCourseFullySelected(group.folderNames)"
              :indeterminate.prop="isCoursePartiallySelected(group.folderNames)"
              @click.stop
              @change="selectAllInCourse(group.folderNames)"
            />
            <svg class="course-icon" width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2L1 6l7 4 7-4L8 2z" fill="#3b6ea5"/>
              <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z" fill="#5a9fd4"/>
            </svg>
            <span class="course-name">{{ group.courseName }}</span>
            <svg
              class="course-chevron"
              :class="{ collapsed: isCourseCollapsed(group.courseName) }"
              width="14" height="14" viewBox="0 0 16 16"
              @click.stop="toggleCourseCollapse(group.courseName)"
            >
              <path d="M4 3l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <template v-if="!isCourseCollapsed(group.courseName)">
          <div
            v-for="entry in group.folders"
            :key="entry.folder.name"
            class="folder-item"
            :class="{
              'folder-item-grouped': isGroupingActive,
              selected: selectedItems.includes(entry.folder.name),
              'drag-over': dragOverIndex === entry.index,
              dragging: dragStartIndex === entry.index
            }"
            @click="toggleSelection(entry.folder.name)"
            :draggable="true"
            @dragstart="onDragStart($event, entry.index)"
            @dragover="onDragOver($event, entry.index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, entry.index)"
            @dragend="onDragEnd"
          >
            <div class="item-checkbox">
              <input
                type="checkbox"
                :checked="selectedItems.includes(entry.folder.name)"
                @click.stop
                @change="toggleSelection(entry.folder.name)"
              />
            </div>

            <div class="folder-icon">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <span class="folder-name">{{ formatToolFolderName(entry.folder.name) }}</span>

            <div class="folder-counts">
              <span class="folder-count-text">
                <span class="count-value">{{ entry.folder.imageCount }}</span>
                <span class="count-label">{{ $t('trash.active') }}</span>
              </span>
            </div>

            <div class="drag-handle" :title="$t('pdfmaker.customOrderHint')">
              <svg width="20" height="20" viewBox="0 0 16 16">
                <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          </template>
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
      <div class="footer-left">
        <span>{{ $t('pdfmaker.selected') }}: {{ selectedItems.length }} / {{ $t('pdfmaker.total') }}: {{ sortedFolders.length }}</span>
        <span class="footer-separator">|</span>
        <span>{{ $t('pdfmaker.totalImages') }}: {{ selectedImageCount }}</span>
      </div>

      <label
        class="group-toggle"
        :class="{ disabled: useCustomOrder }"
        :title="useCustomOrder ? $t('pdfmaker.groupByCourseDisabledHint') : ''"
      >
        <input
          type="checkbox"
          v-model="groupByCourse"
          :disabled="useCustomOrder"
        />
        <span>{{ $t('pdfmaker.groupByCourse') }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePdfMaker } from '@features/export/usePdfMaker'
import { getCourseName, formatToolFolderName } from '@shared/utils/toolWindowFolders'

const { t } = useI18n()

const {
  selectedItems,
  sortedFolders,
  isLoading,
  useCustomOrder,
  reduceEnabled,
  aspectRatio,
  reduceEffort,
  customColors,
  customSize,
  outputMode,
  outputFormat,
  includeCover,
  sizeOptions,
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

const formatSizeOption = (size: string) => {
  const [w, h] = size.split('x')
  return w && h ? `${w}×${h}` : size
}

const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const isExportMenuOpen = ref(false)
const groupByCourse = ref(true)

watch(useCustomOrder, (value) => {
  if (value) {
    groupByCourse.value = false
  }
})

const isGroupingActive = computed(() => groupByCourse.value && !useCustomOrder.value)
const collapsedCourses = ref<Set<string>>(new Set())

const toggleCourseCollapse = (courseName: string) => {
  if (collapsedCourses.value.has(courseName)) {
    collapsedCourses.value.delete(courseName)
  } else {
    collapsedCourses.value.add(courseName)
  }
}

const isCourseCollapsed = (courseName: string) => collapsedCourses.value.has(courseName)

interface CourseGroup {
  courseName: string
  folderNames: string[]
  folders: Array<{ folder: (typeof sortedFolders.value)[number]; index: number }>
}

const courseGroups = computed<CourseGroup[]>(() => {
  if (!isGroupingActive.value) {
    return [{
      courseName: '',
      folderNames: sortedFolders.value.map((f) => f.name),
      folders: sortedFolders.value.map((folder, index) => ({ folder, index })),
    }]
  }
  const groups: CourseGroup[] = []
  let current: CourseGroup | null = null
  sortedFolders.value.forEach((folder, index) => {
    const courseName = getCourseName(folder.name)
    if (!current || current.courseName !== courseName) {
      current = { courseName, folderNames: [], folders: [] }
      groups.push(current)
    }
    current.folderNames.push(folder.name)
    current.folders.push({ folder, index })
  })
  return groups
})

const isCourseFullySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  return folderNames.every((name) => selectedItems.value.includes(name))
}

const isCoursePartiallySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  const selected = selectedItems.value
  const count = folderNames.filter((name) => selected.includes(name)).length
  return count > 0 && count < folderNames.length
}

const selectAllInCourse = (folderNames: string[]) => {
  if (folderNames.length === 0) return
  if (isCourseFullySelected(folderNames)) {
    const remove = new Set(folderNames)
    selectedItems.value = selectedItems.value.filter((name) => !remove.has(name))
    return
  }
  const merged = new Set(selectedItems.value)
  folderNames.forEach((name) => merged.add(name))
  selectedItems.value = Array.from(merged)
}

const outputModeLabel = computed(() => {
  if (outputMode.value === 'single') {
    return outputFormat.value === 'pptx'
      ? t('pdfmaker.combineOnePptx')
      : t('pdfmaker.combineOnePdf')
  }

  return outputFormat.value === 'pptx'
    ? t('pdfmaker.separatePptxs')
    : t('pdfmaker.separatePdfs')
})

const exportMenuLabel = computed(() => `${outputFormat.value.toUpperCase()} · ${outputModeLabel.value}`)

const selectedImageCount = computed(() =>
  sortedFolders.value
    .filter(f => selectedItems.value.includes(f.name))
    .reduce((sum, f) => sum + f.imageCount, 0)
)

const toggleExportMenu = () => {
  isExportMenuOpen.value = !isExportMenuOpen.value
}

const closeExportMenu = () => {
  isExportMenuOpen.value = false
}

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

  if (result.success && result.mode === 'batch') {
    const isPptx = result.format === 'pptx'
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t('pdfmaker.openOutputFolder'), 'OK'],
      defaultId: 0,
      title: t(isPptx ? 'pdfmaker.pptxsSavedTitle' : 'pdfmaker.pdfsSavedTitle'),
      message: t(isPptx ? 'pdfmaker.pptxsSaved' : 'pdfmaker.pdfsSaved', { path: result.outputDir }),
    })

    if (response?.response === 0) {
      await window.electronAPI.shell?.openPath?.(result.outputDir)
    }
  } else if (result.success && result.mode === 'single') {
    const isPptx = result.format === 'pptx'
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t(isPptx ? 'pdfmaker.openPptx' : 'pdfmaker.openPdf'), 'OK'],
      defaultId: 0,
      title: t(isPptx ? 'pdfmaker.pptxSavedTitle' : 'pdfmaker.pdfSavedTitle'),
      message: t(isPptx ? 'pdfmaker.pptxSaved' : 'pdfmaker.pdfSaved', { path: result.path }),
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
  window.addEventListener('click', closeExportMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeExportMenu)
})
</script>

<style scoped>
.pdfmaker-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-modal);
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

.reduce-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.reduce-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.reduce-toggle input {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
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
  color: var(--text-secondary);
  white-space: nowrap;
}

.effort-select,
.custom-select {
  padding: 4px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.effort-select:disabled,
.custom-select:disabled {
  cursor: not-allowed;
  background-color: var(--bg-page);
  color: var(--text-muted);
}

.effort-select:focus,
.custom-select:focus {
  outline: none;
  border-color: var(--accent);
}

.config-value {
  font-size: 13px;
  color: var(--text-primary);
  padding: 4px 8px;
  background-color: var(--bg-page);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  white-space: nowrap;
}

.export-menu {
  position: relative;
  flex-shrink: 0;
}

.export-menu-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.export-menu-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.export-menu-chevron {
  transition: transform 0.2s;
}

.export-menu-toggle[aria-expanded="true"] .export-menu-chevron {
  transform: rotate(180deg);
}

.export-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 260px;
  padding: 10px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-modal);
  box-shadow: 0 8px 24px var(--shadow-md);
}

.export-menu-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.export-menu-section-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.export-menu-panel .mode-segmented {
  width: 100%;
}

.export-menu-panel .mode-option {
  flex: 1;
  justify-content: center;
}

.mode-segmented {
  display: flex;
  align-items: center;
  padding: 2px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-input);
  border-radius: 5px;
}

.mode-option {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s;
}

.mode-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.mode-option.active {
  background-color: var(--bg-surface);
  color: var(--accent);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.cover-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--bg-hover);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.cover-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.cover-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--accent);
}

.progress-text {
  font-variant-numeric: tabular-nums;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: var(--bg-surface);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.course-group {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}

.course-group:first-child {
  margin-top: 0;
}

.course-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 10px 14px 10px;
  cursor: pointer;
  user-select: none;
}

.course-icon {
  flex-shrink: 0;
}

.course-chevron {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-secondary);
  transition: transform 0.15s;
  cursor: pointer;
}

.course-chevron.collapsed {
  transform: rotate(0deg);
}

.course-chevron:not(.collapsed) {
  transform: rotate(90deg);
}

.course-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--link-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--accent);
}

.folder-item-grouped {
  margin: 0 8px 8px;
  border-radius: 6px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background-color: var(--bg-surface);
  border: 1px solid var(--bg-hover);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: var(--bg-elevated);
  border-color: var(--bg-hover);
}

.folder-item.selected {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
}

.folder-item.drag-over {
  border-color: var(--accent);
  border-style: dashed;
  background-color: var(--badge-active-bg);
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-counts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.folder-count-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.count-value {
  font-variant-numeric: tabular-nums;
}

.count-label {
  color: inherit;
  text-transform: lowercase;
}

.drag-handle {
  flex-shrink: 0;
  cursor: grab;
  padding: 6px 8px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
  border-radius: 4px;
  color: var(--text-muted);
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
  gap: 12px;
  padding: 8px 16px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-primary);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.footer-separator {
  color: var(--border-strong);
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
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}

.group-toggle:hover:not(.disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}


</style>
