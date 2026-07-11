<template>
  <!-- Course-grouped folder list with Select-mode drag reordering. Selection
       state stays in the parent (emit-based); collapse + drag-visual state is
       local. getFolderEl is exposed for the parent's scroll-restore watch. -->
  <div class="folder-list">
    <div
      v-for="(group, groupIdx) in courseGroups"
      :key="group.courseName || groupIdx"
      :class="{ 'course-group': isGroupingActive }"
    >
      <div
        v-if="isGroupingActive"
        class="course-header"
        @click="isFolderEditMode && emitSelectCourse(group.folderNames)"
      >
        <input
          v-if="isFolderEditMode"
          type="checkbox"
          class="course-checkbox"
          :checked="isCourseFullySelected(group.folderNames)"
          :indeterminate.prop="isCoursePartiallySelected(group.folderNames)"
          @click.stop
          @change="emitSelectCourse(group.folderNames)"
        />
        <svg class="course-icon" width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 2L1 6l7 4 7-4L8 2z"/>
          <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z"/>
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
      <button
        v-for="entry in group.folders"
        :key="entry.folder.name"
        class="folder-item"
        :class="{
          'folder-item-grouped': isGroupingActive,
          'folder-item-last-visited': !isFolderEditMode && entry.folder.name === lastVisitedFolderName,
          'folder-item-selected': isFolderEditMode && selectedFolderNames.includes(entry.folder.name),
          'folder-item-edit': isFolderEditMode,
          'folder-item-drag-over': dragOverIndex === entry.index,
          'folder-item-dragging': dragStartIndex === entry.index,
        }"
        :ref="(el) => setFolderItemRef(entry.folder.name, el as HTMLButtonElement | null)"
        :draggable="isFolderEditMode && !isGenerating"
        @click="isFolderEditMode ? emit('toggle-selection', entry.folder.name) : emit('open-folder', entry.folder)"
        @dragstart="onFolderDragStart($event, entry.index)"
        @dragover="onFolderDragOver($event, entry.index)"
        @dragleave="onFolderDragLeave"
        @drop="onFolderDrop($event, entry.index)"
        @dragend="onFolderDragEnd"
      >
        <div v-if="isFolderEditMode" class="folder-checkbox">
          <input
            type="checkbox"
            :checked="selectedFolderNames.includes(entry.folder.name)"
            @click.stop
            @change="emit('toggle-selection', entry.folder.name)"
          />
        </div>

        <div class="folder-icon">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
            <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
          </svg>
        </div>

        <div class="folder-copy">
          <div class="folder-mainline">
            <span class="folder-name">{{ formatToolFolderName(entry.folder.name) }}</span>
            <div class="folder-counts">
              <template v-if="isWatchExtraction(entry.folder.metadata)">
                <span class="folder-count-text" :title="$t('trash.watchModeHint')">
                  <span class="count-label">{{ $t('trash.watchMode') }}</span>
                </span>
                <span class="folder-count-separator">/</span>
              </template>
              <template v-if="entry.folder.metadata?.review.edited">
                <span class="folder-count-text">
                  <span class="count-label">{{ $t('trash.edited') }}</span>
                </span>
                <span class="folder-count-separator">/</span>
              </template>
              <span class="folder-count-text">
                <span class="count-value">{{ entry.folder.activeCount }}</span>
                <span class="count-label">{{ $t('trash.active') }}</span>
              </span>
              <span class="folder-count-separator">/</span>
              <span class="folder-count-text">
                <span class="count-value">{{ entry.folder.removedCount }}</span>
                <span class="count-label">{{ $t('trash.removed') }}</span>
              </span>
            </div>
          </div>
        </div>

        <svg v-if="!isFolderEditMode" class="folder-chevron" width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <div v-else class="drag-handle" :title="$t('pdfmaker.customOrderHint')">
          <svg width="20" height="20" viewBox="0 0 16 16">
            <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
          </svg>
        </div>
      </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getCourseName } from '@shared/utils/toolWindowFolders'
import { isWatchExtraction } from '@common/slideMetadataTypes'
import type { ResultsFolder } from '@features/results/useResultsView'

const props = defineProps<{
  folders: ResultsFolder[]
  isGroupingActive: boolean
  isFolderEditMode: boolean
  selectedFolderNames: string[]
  lastVisitedFolderName: string | null
  isGenerating: boolean
  formatToolFolderName: (name: string) => string
}>()

const emit = defineEmits<{
  (e: 'open-folder', folder: ResultsFolder): void
  (e: 'toggle-selection', name: string): void
  (e: 'select-course', names: string[]): void
  (e: 'reorder', from: number, to: number): void
}>()

// Collapse state is view-local: the parent never reads it, and re-entering the
// folder view keeps the same component instance (v-else within the page).
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
  folders: Array<{ folder: ResultsFolder; index: number }>
}

const courseGroups = computed<CourseGroup[]>(() => {
  if (!props.isGroupingActive) {
    return [{
      courseName: '',
      folderNames: props.folders.map((f) => f.name),
      folders: props.folders.map((folder, index) => ({ folder, index })),
    }]
  }
  const groups: CourseGroup[] = []
  let current: CourseGroup | null = null
  props.folders.forEach((folder, index) => {
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
  return folderNames.every((name) => props.selectedFolderNames.includes(name))
}

const isCoursePartiallySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  const selected = props.selectedFolderNames
  const count = folderNames.filter((name) => selected.includes(name)).length
  return count > 0 && count < folderNames.length
}

const emitSelectCourse = (folderNames: string[]) => {
  if (folderNames.length === 0) return
  emit('select-course', folderNames)
}

// --- Drag-to-reorder (Select mode + custom order) ---

const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const onFolderDragStart = (event: DragEvent, index: number) => {
  dragStartIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

const onFolderDragOver = (event: DragEvent, index: number) => {
  if (dragStartIndex.value === null) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

const onFolderDragLeave = () => {
  dragOverIndex.value = null
}

const onFolderDrop = (event: DragEvent, toIndex: number) => {
  event.preventDefault()
  if (dragStartIndex.value !== null && dragStartIndex.value !== toIndex) {
    emit('reorder', dragStartIndex.value, toIndex)
  }
  dragStartIndex.value = null
  dragOverIndex.value = null
}

const onFolderDragEnd = () => {
  dragStartIndex.value = null
  dragOverIndex.value = null
}

// --- Item element registry (parent scroll-restore support) ---

const folderItemRefs = new Map<string, HTMLButtonElement>()

function setFolderItemRef(name: string, el: HTMLButtonElement | null) {
  if (el) {
    folderItemRefs.set(name, el)
  } else {
    folderItemRefs.delete(name)
  }
}

defineExpose({
  getFolderEl: (name: string): HTMLButtonElement | null => folderItemRefs.get(name) ?? null,
})
</script>

<style scoped>
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

/* Two-tone course glyph, themed via accent tokens so it adapts to dark mode. */
.course-icon path:first-child {
  fill: var(--accent-strong);
}

.course-icon path:last-child {
  fill: var(--accent);
}

.course-chevron {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
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

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-input);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.folder-item-last-visited {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.folder-item-last-visited:hover {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

.folder-item-edit {
  cursor: pointer;
}

.folder-item-selected {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.folder-item-selected:hover {
  background-color: var(--badge-active-bg);
  border-color: var(--accent-hover);
}

.folder-item-drag-over {
  border-color: var(--accent);
  border-style: dashed;
  background-color: var(--badge-active-bg);
}

.folder-item-dragging {
  opacity: 0.5;
}

.folder-item-grouped {
  margin: 0 8px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

.folder-checkbox {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
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
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.folder-count-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.count-label {
  color: inherit;
}

.folder-count-separator {
  color: var(--text-secondary);
}


.count-value {
  font-variant-numeric: tabular-nums;
}

.folder-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
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
  background-color: var(--bg-hover);
}

.drag-handle:active {
  cursor: grabbing;
}
</style>
