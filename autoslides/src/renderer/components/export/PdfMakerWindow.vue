<template>
  <div class="flex h-full flex-col bg-surface text-fg">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-elevated px-4 py-2">
      <div class="flex flex-wrap items-center gap-2">
        <button :class="toolbarBtn" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrder') : $t('pdfmaker.sortAZ') }}
        </button>

        <button :class="toolbarBtn" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ 'animate-spin': isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.refresh') }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5">
          <label class="text-xs text-fg-secondary">{{ $t('pdfmaker.aspectRatio') }}</label>
          <select v-model="aspectRatio" :class="selectCls">
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <label class="flex cursor-pointer items-center gap-1.5 text-xs text-fg">
          <input type="checkbox" class="accent-accent" v-model="reduceEnabled" />
          <span>{{ $t('pdfmaker.reduceSize') }}</span>
        </label>

        <div class="flex items-center gap-2" :class="{ 'opacity-50': !reduceEnabled }">
          <select v-model="reduceEffort" :class="selectCls" :disabled="!reduceEnabled">
            <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
            <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
            <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
            <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
          </select>

          <div class="flex items-center gap-1.5">
            <label class="text-xs text-fg-secondary">{{ $t('pdfmaker.colors') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="text-xs font-medium text-fg">{{ customColors }}</span>
            <select v-else v-model="customColors" :class="selectCls" :disabled="!reduceEnabled">
              <option :value="null">{{ $t('pdfmaker.colorsOriginal') }}</option>
              <option :value="256">256</option>
              <option :value="128">128</option>
              <option :value="64">64</option>
              <option :value="32">32</option>
              <option :value="16">16</option>
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <label class="text-xs text-fg-secondary">{{ $t('pdfmaker.size') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="text-xs font-medium text-fg">{{ displaySize }}</span>
            <select v-else v-model="customSize" :class="selectCls" :disabled="!reduceEnabled">
              <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ formatSizeOption(opt) }}</option>
            </select>
          </div>
        </div>

        <div class="relative" @click.stop>
          <button
            type="button"
            :class="[toolbarBtn, 'gap-1.5']"
            :aria-expanded="isExportMenuOpen"
            aria-haspopup="menu"
            @click="toggleExportMenu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
            </svg>
            <span>{{ exportMenuLabel }}</span>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>

          <div v-if="isExportMenuOpen" class="absolute right-0 top-full z-dropdown mt-1 w-64 rounded-md border border-line bg-modal p-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]" role="menu">
            <div class="mb-3 last:mb-0" role="group" :aria-label="$t('pdfmaker.outputFormat')">
              <span class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{{ $t('pdfmaker.outputFormat') }}</span>
              <div class="flex gap-1 rounded border border-line p-0.5">
                <label class="flex flex-1 cursor-pointer items-center justify-center rounded px-2 py-1 text-xs" :class="outputFormat === 'pdf' ? 'bg-accent text-white' : 'text-fg'">
                  <input type="radio" class="sr-only" v-model="outputFormat" value="pdf" />
                  <span>{{ $t('pdfmaker.formatPdf') }}</span>
                </label>
                <label class="flex flex-1 cursor-pointer items-center justify-center rounded px-2 py-1 text-xs" :class="outputFormat === 'pptx' ? 'bg-accent text-white' : 'text-fg'">
                  <input type="radio" class="sr-only" v-model="outputFormat" value="pptx" />
                  <span>{{ $t('pdfmaker.formatPptx') }}</span>
                </label>
              </div>
            </div>

            <div class="mb-3 last:mb-0" role="group" :aria-label="$t('pdfmaker.outputMode')">
              <span class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{{ $t('pdfmaker.outputMode') }}</span>
              <div class="flex gap-1 rounded border border-line p-0.5">
                <label class="flex flex-1 cursor-pointer items-center justify-center rounded px-2 py-1 text-center text-xs" :class="outputMode === 'single' ? 'bg-accent text-white' : 'text-fg'">
                  <input type="radio" class="sr-only" v-model="outputMode" value="single" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.combineOnePptx') : $t('pdfmaker.combineOnePdf') }}</span>
                </label>
                <label class="flex flex-1 cursor-pointer items-center justify-center rounded px-2 py-1 text-center text-xs" :class="outputMode === 'batch' ? 'bg-accent text-white' : 'text-fg'">
                  <input type="radio" class="sr-only" v-model="outputMode" value="batch" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.separatePptxs') : $t('pdfmaker.separatePdfs') }}</span>
                </label>
              </div>
            </div>

            <div class="mb-3 last:mb-0" role="group" :aria-label="$t('pdfmaker.pages')">
              <span class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{{ $t('pdfmaker.pages') }}</span>
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-fg">
                <input type="checkbox" class="accent-accent" v-model="includeCover" />
                <span>{{ $t('pdfmaker.includeCover') }}</span>
              </label>
            </div>
          </div>
        </div>

        <button
          class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleMakePdf"
          :disabled="selectedItems.length === 0 || isGenerating"
        >
          <svg v-if="!isGenerating" width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
          </svg>
          <span v-if="isGenerating">
            {{ generateProgress.current }}/{{ generateProgress.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: outputFormat.toUpperCase() }) }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="isLoading" class="flex flex-col items-center justify-center gap-3 py-16 text-fg-secondary">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent"></div>
        <span>{{ $t('pdfmaker.loading') }}</span>
      </div>

      <div v-else-if="sortedFolders.length === 0" class="flex flex-col items-center gap-3 py-16 text-fg-muted">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
        </svg>
        <span>{{ $t('pdfmaker.noFolders') }}</span>
      </div>

      <div v-else class="flex flex-col gap-1">
        <div
          v-for="(group, groupIdx) in courseGroups"
          :key="group.courseName || groupIdx"
          :class="{ 'mb-2': isGroupingActive }"
        >
          <div
            v-if="isGroupingActive"
            class="flex cursor-pointer items-center gap-2 rounded bg-elevated px-2 py-1.5"
            @click="selectAllInCourse(group.folderNames)"
          >
            <input
              type="checkbox"
              class="accent-accent"
              :checked="isCourseFullySelected(group.folderNames)"
              :indeterminate.prop="isCoursePartiallySelected(group.folderNames)"
              @click.stop
              @change="selectAllInCourse(group.folderNames)"
            />
            <svg class="shrink-0" width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2L1 6l7 4 7-4L8 2z" fill="#3b6ea5"/>
              <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z" fill="#5a9fd4"/>
            </svg>
            <span class="flex-1 text-xs font-semibold text-fg">{{ group.courseName }}</span>
            <svg
              class="text-fg-secondary transition-transform"
              :class="{ '-rotate-90': isCourseCollapsed(group.courseName) }"
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
            class="flex cursor-pointer items-center gap-3 rounded-md border bg-modal px-3 py-2 transition-all"
            :class="[
              isGroupingActive ? 'ml-4' : '',
              selectedItems.includes(entry.folder.name) ? 'border-accent bg-accent/10' : 'border-line hover:border-accent',
              dragOverIndex === entry.index ? '!border-dashed !border-accent' : '',
              dragStartIndex === entry.index ? 'opacity-50' : ''
            ]"
            @click="toggleSelection(entry.folder.name)"
            :draggable="true"
            @dragstart="onDragStart($event, entry.index)"
            @dragover="onDragOver($event, entry.index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, entry.index)"
            @dragend="onDragEnd"
          >
            <div class="flex-shrink-0">
              <input
                type="checkbox"
                class="accent-accent"
                :checked="selectedItems.includes(entry.folder.name)"
                @click.stop
                @change="toggleSelection(entry.folder.name)"
              />
            </div>

            <div class="flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <span class="min-w-0 flex-1 truncate text-sm text-fg">{{ formatToolFolderName(entry.folder.name) }}</span>

            <div class="flex flex-shrink-0 items-center gap-1 text-xs">
              <span class="font-semibold text-fg">{{ entry.folder.imageCount }}</span>
              <span class="text-fg-muted">{{ $t('trash.active') }}</span>
            </div>

            <div class="flex-shrink-0 cursor-grab text-fg-muted" :title="$t('pdfmaker.customOrderHint')">
              <svg width="20" height="20" viewBox="0 0 16 16">
                <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="isGenerating" class="h-1 w-full bg-[#e0e0e0] dark:bg-[#404040]">
      <div
        class="h-full bg-accent transition-[width] duration-300"
        :style="{ width: `${(generateProgress.current / generateProgress.total) * 100}%` }"
      ></div>
    </div>

    <div class="flex items-center justify-between border-t border-line bg-elevated px-4 py-2 text-xs text-fg-secondary">
      <div class="flex items-center gap-2">
        <span>{{ $t('pdfmaker.selected') }}: {{ selectedItems.length }} / {{ $t('pdfmaker.total') }}: {{ sortedFolders.length }}</span>
        <span class="text-fg-muted">|</span>
        <span>{{ $t('pdfmaker.totalImages') }}: {{ selectedImageCount }}</span>
      </div>

      <label
        class="flex cursor-pointer items-center gap-1.5"
        :class="{ 'opacity-50': useCustomOrder }"
        :title="useCustomOrder ? $t('pdfmaker.groupByCourseDisabledHint') : ''"
      >
        <input
          type="checkbox"
          class="accent-accent"
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

// ---- Tailwind class-string constants ----
const toolbarBtn = 'flex items-center gap-1.5 rounded border border-line-input bg-surface px-3 py-1.5 text-xs text-fg cursor-pointer transition-colors enabled:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#333]'
const selectCls = 'rounded border border-line-input bg-field px-2 py-1 text-xs text-fg cursor-pointer focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

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

