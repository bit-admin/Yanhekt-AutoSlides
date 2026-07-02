/**
 * PDF/PPTX export composable.
 * Folder data and selection are owned by the caller (the Slides page);
 * this composable owns custom ordering, export configuration, and generation.
 */

import { ref, computed, onUnmounted, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { compareToolFolders, compareToolImages, formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { overrides } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('PdfMaker');

export interface PdfSourceFolder {
  name: string
  // Absent for trash-only folders (no on-disk folder to export).
  path?: string
}

export interface FolderEntry {
  name: string
  path: string
  images: string[]
}

export type AspectRatio = '16:9' | '4:3'
export type PdfOutputMode = 'single' | 'batch'
export type SlidesOutputFormat = 'pdf' | 'pptx'

export interface PdfMakeOptions {
  reduceEnabled: boolean
  aspectRatio: AspectRatio
  effort: 'standard' | 'compact' | 'minimal' | 'custom'
  customColors?: number | null
  customWidth?: number | null
  customHeight?: number | null
}

export type PdfMakeResult =
  | { success: true; mode: 'single'; format: SlidesOutputFormat; path: string }
  | { success: true; mode: 'batch'; format: SlidesOutputFormat; outputDir: string; paths: string[] }
  | { success: false; error?: string }

const SIZE_OPTIONS_16_9 = ['1920x1080', '1600x900', '1280x720', '960x540', '854x480']
const SIZE_OPTIONS_4_3 = ['1440x1080', '1200x900', '960x720', '720x540', '640x480']

const EFFORT_PRESETS: Record<AspectRatio, Record<string, { colors: number; size: string }>> = {
  '16:9': {
    standard: { colors: 128, size: '1280x720' },
    compact: { colors: 64, size: '960x540' },
    minimal: { colors: 16, size: '854x480' },
  },
  '4:3': {
    standard: { colors: 128, size: '960x720' },
    compact: { colors: 64, size: '720x540' },
    minimal: { colors: 16, size: '640x480' },
  },
}

export function usePdfMaker<T extends PdfSourceFolder>(deps: {
  folders: Ref<T[]>
  selectedNames: Ref<string[]>
}) {
  const { t } = useI18n()

  const customOrder = ref<string[]>([])
  const useCustomOrder = ref(false)

  const reduceEnabled = ref(true)
  const aspectRatio = ref<AspectRatio>('16:9')
  const reduceEffort = ref<'standard' | 'compact' | 'minimal' | 'custom'>('standard')
  const customColors = ref<number | null>(128)
  const customSize = ref<string>('1280x720')
  const outputMode = ref<PdfOutputMode>('single')
  const outputFormat = ref<SlidesOutputFormat>('pdf')
  const includeCover = ref(true)
  const isGenerating = ref(false)
  const generateProgress = ref({ current: 0, total: 0 })

  const sizeOptions = computed(() =>
    aspectRatio.value === '16:9' ? SIZE_OPTIONS_16_9 : SIZE_OPTIONS_4_3
  )

  watch(reduceEffort, (newEffort) => {
    if (newEffort !== 'custom') {
      const preset = EFFORT_PRESETS[aspectRatio.value][newEffort]
      if (preset) {
        customColors.value = preset.colors
        customSize.value = preset.size
      }
    }
  })

  watch(aspectRatio, (newRatio, oldRatio) => {
    if (reduceEffort.value !== 'custom') {
      const preset = EFFORT_PRESETS[newRatio][reduceEffort.value]
      if (preset) {
        customColors.value = preset.colors
        customSize.value = preset.size
      }
      return
    }

    const sourceList = oldRatio === '16:9' ? SIZE_OPTIONS_16_9 : SIZE_OPTIONS_4_3
    const targetList = newRatio === '16:9' ? SIZE_OPTIONS_16_9 : SIZE_OPTIONS_4_3
    const idx = sourceList.indexOf(customSize.value)
    customSize.value = idx >= 0 ? targetList[idx] : targetList[0]
  })

  let progressCleanup: (() => void) | null = null

  const sortedFolders = computed<T[]>(() => {
    if (useCustomOrder.value && customOrder.value.length > 0) {
      const ordered: T[] = []
      const remaining = [...deps.folders.value]

      for (const name of customOrder.value) {
        const index = remaining.findIndex((folder) => folder.name === name)
        if (index !== -1) {
          ordered.push(remaining.splice(index, 1)[0])
        }
      }

      remaining.sort((a, b) => compareToolFolders(a.name, b.name))
      return [...ordered, ...remaining]
    }

    return [...deps.folders.value].sort((a, b) => compareToolFolders(a.name, b.name))
  })

  const displaySize = computed(() => {
    const [w, h] = customSize.value.split('x')
    return w && h ? `${w}×${h}` : customSize.value
  })

  function handleFolderReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return

    const folderNames = sortedFolders.value.map((folder) => folder.name)
    const [moved] = folderNames.splice(fromIndex, 1)
    folderNames.splice(toIndex, 0, moved)

    customOrder.value = folderNames
    useCustomOrder.value = true
  }

  function resetSortOrder() {
    customOrder.value = []
    useCustomOrder.value = false
  }

  function enableCustomOrder() {
    customOrder.value = sortedFolders.value.map((folder) => folder.name)
    useCustomOrder.value = true
  }

  function parseSize(size: string): { width: number; height: number } {
    const [width, height] = size.split('x').map(Number)
    return { width, height }
  }

  async function getSelectedFolderEntries(): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = []
    const selectedFolders = sortedFolders.value.filter(
      (folder) => folder.path && deps.selectedNames.value.includes(folder.name)
    )

    for (const folder of selectedFolders) {
      const folderPath = folder.path as string
      const folderImages = overrides.resultsProvider
        ? await overrides.resultsProvider.getImages(folderPath)
        : await window.electronAPI.pdfmaker.getImages(folderPath)
      const sortedImagePaths = folderImages
        .sort((a, b) => compareToolImages(a.name, b.name))
        .map((image) => image.path)

      entries.push({
        name: formatToolFolderName(folder.name),
        path: folderPath,
        images: sortedImagePaths,
      })
    }

    return entries
  }

  function buildPdfOptions(): PdfMakeOptions {
    const options: PdfMakeOptions = {
      reduceEnabled: reduceEnabled.value,
      aspectRatio: aspectRatio.value,
      effort: reduceEffort.value,
    }

    if (reduceEffort.value === 'custom') {
      options.customColors = customColors.value
      const size = parseSize(customSize.value)
      options.customWidth = size.width
      options.customHeight = size.height
    }

    return options
  }

  async function makePdf(): Promise<PdfMakeResult> {
    if (deps.selectedNames.value.length === 0) {
      return { success: false, error: 'No folders selected' }
    }

    isGenerating.value = true
    generateProgress.value = { current: 0, total: 0 }
    progressCleanup = window.electronAPI.pdfmaker.onProgress((progress) => {
      generateProgress.value = progress
    })

    try {
      const folderEntries = await getSelectedFolderEntries()
      const options = buildPdfOptions()
      return await window.electronAPI.pdfmaker.makePdf(folderEntries, {
        ...options,
        outputMode: outputMode.value,
        outputFormat: outputFormat.value,
        includeCover: includeCover.value,
        copyrightText: includeCover.value ? t('pdfmaker.coverCopyright') : undefined,
      })
    } catch (error) {
      log.error('Failed to make PDF:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      isGenerating.value = false
      generateProgress.value = { current: 0, total: 0 }

      if (progressCleanup) {
        progressCleanup()
        progressCleanup = null
      }
    }
  }

  onUnmounted(() => {
    if (progressCleanup) {
      progressCleanup()
      progressCleanup = null
    }
  })

  return {
    sortedFolders,
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
    handleFolderReorder,
    resetSortOrder,
    enableCustomOrder,
    makePdf,
  }
}
