<template>
  <div class="flex flex-col h-full bg-surface text-text">
    <div class="flex flex-wrap justify-between items-center py-2.5 px-4 bg-page border-b border-border gap-3">
      <div class="flex items-center gap-2">
        <button class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-page hover:border-border-strong" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrder') : $t('pdfmaker.sortAZ') }}
        </button>

        <button class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-page hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ 'animate-spin': isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('pdfmaker.refresh') }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2 justify-end">
        <div class="flex items-center gap-1">
          <label class="text-[13px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.aspectRatio') }}</label>
          <select v-model="aspectRatio" class="py-1 px-2 border border-border-input rounded bg-surface text-[13px] cursor-pointer focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:bg-page disabled:text-text-muted">
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <label class="flex items-center gap-2 py-1.5 px-2.5 bg-elevated border border-border-input rounded text-[13px] cursor-pointer whitespace-nowrap transition-colors hover:bg-page hover:border-border-strong">
          <input type="checkbox" v-model="reduceEnabled" class="!w-3.5 !h-1 !m-0 cursor-pointer accent-[var(--accent)]" />
          <span>{{ $t('pdfmaker.reduceSize') }}</span>
        </label>

        <div class="flex items-center gap-2 transition-opacity" :class="{ 'opacity-50': !reduceEnabled }">
          <select v-model="reduceEffort" class="py-1 px-2 border border-border-input rounded bg-surface text-[13px] cursor-pointer focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:bg-page disabled:text-text-muted" :disabled="!reduceEnabled">
            <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
            <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
            <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
            <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
          </select>

          <div class="flex items-center gap-1">
            <label class="text-[13px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.colors') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="text-[13px] text-text-secondary py-1 px-2 bg-page border border-border-input rounded whitespace-nowrap">{{ customColors }}</span>
            <select v-else v-model="customColors" class="py-1 px-2 border border-border-input rounded bg-surface text-[13px] cursor-pointer focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:bg-page disabled:text-text-muted" :disabled="!reduceEnabled">
              <option :value="null">{{ $t('pdfmaker.colorsOriginal') }}</option>
              <option :value="256">256</option>
              <option :value="128">128</option>
              <option :value="64">64</option>
              <option :value="32">32</option>
              <option :value="16">16</option>
            </select>
          </div>

          <div class="flex items-center gap-1">
            <label class="text-[13px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.size') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="text-[13px] text-text-secondary py-1 px-2 bg-page border border-border-input rounded whitespace-nowrap">{{ displaySize }}</span>
            <select v-else v-model="customSize" class="py-1 px-2 border border-border-input rounded bg-surface text-[13px] cursor-pointer focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:bg-page disabled:text-text-muted" :disabled="!reduceEnabled">
              <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ formatSizeOption(opt) }}</option>
            </select>
          </div>
        </div>

        <div class="relative shrink-0" @click.stop>
          <button
            type="button"
            class="flex items-center gap-1.5 min-h-[30px] py-1.5 px-2.5 border border-border-input rounded bg-surface text-text text-xs cursor-pointer whitespace-nowrap transition-colors hover:bg-page hover:border-border-strong"
            :aria-expanded="isExportMenuOpen"
            aria-haspopup="menu"
            @click="toggleExportMenu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
            </svg>
            <span>{{ exportMenuLabel }}</span>
            <svg class="export-menu-chevron transition-transform" width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>

          <div v-if="isExportMenuOpen" class="absolute top-[calc(100%+6px)] right-0 z-20 flex flex-col gap-2.5 min-w-[260px] p-2.5 border border-border-input rounded-md bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.12)]" role="menu">
            <div class="flex flex-col gap-1.5" role="group" :aria-label="$t('pdfmaker.outputFormat')">
              <span class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.outputFormat') }}</span>
              <div class="flex items-center p-0.5 bg-page border border-border-input rounded-[5px] w-full">
                <label class="relative flex items-center min-h-[24px] py-0.5 px-2 rounded text-[12px] leading-[1.2] cursor-pointer whitespace-nowrap transition-colors text-text-secondary flex-1 justify-center" :class="{ 'bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]': outputFormat === 'pdf' }">
                  <input type="radio" v-model="outputFormat" value="pdf" class="absolute opacity-0 pointer-events-none" />
                  <span>{{ $t('pdfmaker.formatPdf') }}</span>
                </label>
                <label class="relative flex items-center min-h-[24px] py-0.5 px-2 rounded text-[12px] leading-[1.2] cursor-pointer whitespace-nowrap transition-colors text-text-secondary flex-1 justify-center" :class="{ 'bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]': outputFormat === 'pptx' }">
                  <input type="radio" v-model="outputFormat" value="pptx" class="absolute opacity-0 pointer-events-none" />
                  <span>{{ $t('pdfmaker.formatPptx') }}</span>
                </label>
              </div>
            </div>

            <div class="flex flex-col gap-1.5" role="group" :aria-label="$t('pdfmaker.outputMode')">
              <span class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.outputMode') }}</span>
              <div class="flex items-center p-0.5 bg-page border border-border-input rounded-[5px] w-full">
                <label class="relative flex items-center min-h-[24px] py-0.5 px-2 rounded text-[12px] leading-[1.2] cursor-pointer whitespace-nowrap transition-colors text-text-secondary flex-1 justify-center" :class="{ 'bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]': outputMode === 'single' }">
                  <input type="radio" v-model="outputMode" value="single" class="absolute opacity-0 pointer-events-none" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.combineOnePptx') : $t('pdfmaker.combineOnePdf') }}</span>
                </label>
                <label class="relative flex items-center min-h-[24px] py-0.5 px-2 rounded text-[12px] leading-[1.2] cursor-pointer whitespace-nowrap transition-colors text-text-secondary flex-1 justify-center" :class="{ 'bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]': outputMode === 'batch' }">
                  <input type="radio" v-model="outputMode" value="batch" class="absolute opacity-0 pointer-events-none" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.separatePptxs') : $t('pdfmaker.separatePdfs') }}</span>
                </label>
              </div>
            </div>

            <div class="flex flex-col gap-1.5" role="group" :aria-label="$t('pdfmaker.pages')">
              <span class="text-[11px] text-text-secondary whitespace-nowrap">{{ $t('pdfmaker.pages') }}</span>
              <label class="flex items-center gap-2 py-1.5 px-2 rounded bg-elevated border border-hover text-xs text-text cursor-pointer transition-colors hover:bg-page hover:border-border-strong">
                <input type="checkbox" v-model="includeCover" class="!w-3.5 !h-3.5 !m-0 cursor-pointer accent-accent" />
                <span>{{ $t('pdfmaker.includeCover') }}</span>
              </label>
            </div>
          </div>
        </div>

        <button
          class="flex items-center gap-1 py-1.5 px-3 border-none rounded bg-accent text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-[#005a9e] disabled:bg-[var(--border-strong)] disabled:cursor-not-allowed"
          @click="handleMakePdf"
          :disabled="selectedItems.length === 0 || isGenerating"
        >
          <svg v-if="!isGenerating" width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
          </svg>
          <span v-if="isGenerating" class="[font-variant-numeric:tabular-nums]">
            {{ generateProgress.current }}/{{ generateProgress.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: outputFormat.toUpperCase() }) }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 content-area">
      <div v-if="isLoading" class="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <div class="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin"></div>
        <span>{{ $t('pdfmaker.loading') }}</span>
      </div>

      <div v-else-if="sortedFolders.length === 0" class="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
        </svg>
        <span>{{ $t('pdfmaker.noFolders') }}</span>
      </div>

      <div v-else class="flex flex-col gap-1">
        <div
          v-for="(group, groupIdx) in courseGroups"
          :key="group.courseName || groupIdx"
          :class="{ 'bg-elevated border border-border rounded-lg mt-2 overflow-hidden first:mt-0': isGroupingActive }"
        >
          <div
            v-if="isGroupingActive"
            class="flex items-center gap-2.5 min-h-[28px] py-2.5 px-3.5 cursor-pointer select-none"
            @click="selectAllInCourse(group.folderNames)"
          >
            <input
              type="checkbox"
              class="w-[18px] h-[18px] !m-0 cursor-pointer accent-accent"
              :checked="isCourseFullySelected(group.folderNames)"
              :indeterminate.prop="isCoursePartiallySelected(group.folderNames)"
              @click.stop
              @change="selectAllInCourse(group.folderNames)"
            />
            <svg class="shrink-0" width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2L1 6l7 4 7-4L8 2z" fill="#3b6ea5"/>
              <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z" fill="#5a9fd4"/>
            </svg>
            <span class="text-[13px] font-bold text-[#3b6ea5] uppercase tracking-[0.06em] leading-none whitespace-nowrap max-w-[60%] overflow-hidden text-ellipsis">{{ group.courseName }}</span>
            <svg
              class="shrink-0 ml-auto text-[#7b8794] cursor-pointer transition-transform duration-150"
              :class="{ 'rotate-0': isCourseCollapsed(group.courseName), 'rotate-90': !isCourseCollapsed(group.courseName) }"
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
            class="flex items-center gap-3 py-2.5 px-3 bg-surface border border-hover rounded-md cursor-pointer transition-all hover:bg-elevated hover:border-border group/folder"
            :class="{
              'mx-2 mb-2 rounded-md': isGroupingActive,
              'bg-accent/10 !border-accent': selectedItems.includes(entry.folder.name),
              '!border-accent !border-dashed bg-[#f0f7ff]': dragOverIndex === entry.index,
              'opacity-50': dragStartIndex === entry.index
            }"
            @click="toggleSelection(entry.folder.name)"
            :draggable="true"
            @dragstart="onDragStart($event, entry.index)"
            @dragover="onDragOver($event, entry.index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, entry.index)"
            @dragend="onDragEnd"
          >
            <div class="shrink-0">
              <input
                type="checkbox"
                class="w-[18px] h-[18px] cursor-pointer"
                :checked="selectedItems.includes(entry.folder.name)"
                @click.stop
                @change="toggleSelection(entry.folder.name)"
              />
            </div>

            <div class="shrink-0 flex items-center">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
              </svg>
            </div>

            <span class="flex-1 text-[13px] text-text overflow-hidden text-ellipsis whitespace-nowrap">{{ formatToolFolderName(entry.folder.name) }}</span>

            <div class="flex items-center gap-2 shrink-0 text-[#7b8794] text-xs font-medium">
              <span class="inline-flex items-baseline gap-1">
                <span class="[font-variant-numeric:tabular-nums]">{{ entry.folder.imageCount }}</span>
                <span class="inherit lowercase">{{ $t('trash.active') }}</span>
              </span>
            </div>

            <div class="shrink-0 cursor-grab py-1.5 px-2 opacity-60 transition-all rounded text-text-secondary group-hover/folder:opacity-100 group-hover/folder:bg-black/5 hover:!bg-black/10 active:cursor-grabbing active:!bg-black/[0.15]" :title="$t('pdfmaker.customOrderHint')">
              <svg width="20" height="20" viewBox="0 0 16 16">
                <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="isGenerating" class="h-[3px] bg-border w-full overflow-hidden">
      <div
        class="h-full bg-accent transition-[width] duration-150 ease-linear"
        :style="{ width: `${(generateProgress.current / generateProgress.total) * 100}%` }"
      ></div>
    </div>

    <div class="flex justify-between items-center gap-3 py-2 px-4 bg-page border-t border-border text-xs text-text-secondary">
      <div class="flex items-center gap-2 min-w-0">
        <span>{{ $t('pdfmaker.selected') }}: {{ selectedItems.length }} / {{ $t('pdfmaker.total') }}: {{ sortedFolders.length }}</span>
        <span class="text-[var(--border-strong)]">|</span>
        <span>{{ $t('pdfmaker.totalImages') }}: {{ selectedImageCount }}</span>
      </div>

      <label
        class="flex items-center gap-1.5 py-0.5 px-2 border border-border bg-elevated rounded text-xs text-text-secondary cursor-pointer whitespace-nowrap transition-all hover:bg-page hover:border-border-strong"
        :class="{ 'opacity-50 !cursor-not-allowed': useCustomOrder }"
        :title="useCustomOrder ? $t('pdfmaker.groupByCourseDisabledHint') : ''"
      >
        <input
          type="checkbox"
          v-model="groupByCourse"
          :disabled="useCustomOrder"
          class="w-[11px] h-[11px] !m-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
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
/* Export menu chevron rotation via aria-expanded — cannot be expressed as a Tailwind utility */
.export-menu-chevron {
  transition: transform 0.2s;
}

button[aria-expanded="true"] .export-menu-chevron {
  transform: rotate(180deg);
}

/* Auto-hiding scrollbar — pseudo-element styling not expressible in Tailwind */
.content-area {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.content-area:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.content-area::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.content-area:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>
