/**
 * PDF Maker composable.
 * Handles folder browsing, ordering, and PDF generation.
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { compareToolFolders, compareToolImages, formatToolFolderName } from '../utils/toolWindowFolders'

export interface Folder {
  name: string
  path: string
}

export interface FolderEntry {
  name: string
  path: string
  images: string[]
}

export interface PdfMakeOptions {
  reduceEnabled: boolean
  effort: 'standard' | 'compact' | 'minimal' | 'custom'
  customColors?: number | null
  customWidth?: number | null
  customHeight?: number | null
}

export function usePdfMaker() {
  const folders = ref<Folder[]>([])
  const selectedItems = ref<string[]>([])
  const customOrder = ref<string[]>([])
  const useCustomOrder = ref(false)
  const isLoading = ref(false)

  const reduceEnabled = ref(true)
  const reduceEffort = ref<'standard' | 'compact' | 'minimal' | 'custom'>('standard')
  const customColors = ref<number | null>(128)
  const customSize = ref<string>('1280x720')
  const isGenerating = ref(false)
  const generateProgress = ref({ current: 0, total: 0 })

  const EFFORT_PRESETS: Record<string, { colors: number; size: string }> = {
    standard: { colors: 128, size: '1280x720' },
    compact: { colors: 64, size: '960x540' },
    minimal: { colors: 16, size: '854x480' },
  }

  watch(reduceEffort, (newEffort) => {
    if (newEffort !== 'custom') {
      const preset = EFFORT_PRESETS[newEffort]
      if (preset) {
        customColors.value = preset.colors
        customSize.value = preset.size
      }
    }
  })

  let progressCleanup: (() => void) | null = null

  const sortedFolders = computed(() => {
    if (useCustomOrder.value && customOrder.value.length > 0) {
      const ordered: Folder[] = []
      const remaining = [...folders.value]

      for (const name of customOrder.value) {
        const index = remaining.findIndex((folder) => folder.name === name)
        if (index !== -1) {
          ordered.push(remaining.splice(index, 1)[0])
        }
      }

      remaining.sort((a, b) => compareToolFolders(a.name, b.name))
      return [...ordered, ...remaining]
    }

    return [...folders.value].sort((a, b) => compareToolFolders(a.name, b.name))
  })

  const displaySize = computed(() => {
    const sizeMap: Record<string, string> = {
      original: '1920×1080',
      '1600x900': '1600×900',
      '1280x720': '1280×720',
      '960x540': '960×540',
      '854x480': '854×480',
    }
    return sizeMap[customSize.value] || customSize.value
  })

  async function loadFolders() {
    isLoading.value = true

    try {
      folders.value = await window.electronAPI.pdfmaker.getFolders()
      customOrder.value = []
      useCustomOrder.value = false
      selectedItems.value = []
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function refresh() {
    await loadFolders()
  }

  function toggleSelection(name: string) {
    const index = selectedItems.value.indexOf(name)
    if (index === -1) {
      selectedItems.value.push(name)
    } else {
      selectedItems.value.splice(index, 1)
    }
  }

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
    if (size === 'original') {
      return { width: 1920, height: 1080 }
    }

    const [width, height] = size.split('x').map(Number)
    return { width, height }
  }

  async function getSelectedFolderEntries(): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = []
    const selectedFolders = sortedFolders.value.filter((folder) => selectedItems.value.includes(folder.name))

    for (const folder of selectedFolders) {
      const folderImages = await window.electronAPI.pdfmaker.getImages(folder.path)
      const sortedImagePaths = folderImages
        .sort((a, b) => compareToolImages(a.name, b.name))
        .map((image) => image.path)

      entries.push({
        name: formatToolFolderName(folder.name),
        path: folder.path,
        images: sortedImagePaths,
      })
    }

    return entries
  }

  function buildPdfOptions(): PdfMakeOptions {
    const options: PdfMakeOptions = {
      reduceEnabled: reduceEnabled.value,
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

  async function makePdf(): Promise<{ success: boolean; path?: string; error?: string }> {
    if (selectedItems.value.length === 0) {
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
      return await window.electronAPI.pdfmaker.makePdf(folderEntries, options)
    } catch (error) {
      console.error('Failed to make PDF:', error)
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
  }
}

