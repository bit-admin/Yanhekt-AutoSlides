/**
 * PDF Maker Composable
 * Handles folder/image browsing with Chinese natural sorting and PDF generation
 */

import { ref, computed, onUnmounted } from 'vue'

export interface Folder {
  name: string
  path: string
}

export interface ImageFile {
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

// Chinese weekday mapping for sorting (Monday = 1, Sunday = 7)
const WEEKDAY_ORDER: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7
}

/**
 * Parse session info from folder name
 * Pattern: slides_<courseName>_第N周_星期X_第N大节
 * Note: courseName may contain underscores
 */
function parseSessionInfo(folderName: string): {
  courseName: string
  week: number
  weekday: number
  session: number
} | null {
  // Remove slides_ prefix
  const name = folderName.startsWith('slides_') ? folderName.slice(7) : folderName

  // Match pattern from the end: 第N周_星期X_第N大节
  const sessionPattern = /^(.+)_第(\d+)周_星期([一二三四五六日])_第(\d+)大节$/
  const match = name.match(sessionPattern)

  if (!match) return null

  return {
    courseName: match[1],
    week: parseInt(match[2], 10),
    weekday: WEEKDAY_ORDER[match[3]] || 0,
    session: parseInt(match[4], 10)
  }
}

/**
 * Compare two folder names with Chinese natural sorting
 */
function compareFolders(a: string, b: string): number {
  const infoA = parseSessionInfo(a)
  const infoB = parseSessionInfo(b)

  // If both have valid session info, use structured comparison
  if (infoA && infoB) {
    // First compare course name alphabetically
    const courseCompare = infoA.courseName.localeCompare(infoB.courseName, 'zh')
    if (courseCompare !== 0) return courseCompare

    // Then compare week number
    if (infoA.week !== infoB.week) return infoA.week - infoB.week

    // Then compare weekday
    if (infoA.weekday !== infoB.weekday) return infoA.weekday - infoB.weekday

    // Finally compare session number
    return infoA.session - infoB.session
  }

  // If one has session info and one doesn't, prioritize the one with info
  if (infoA && !infoB) return -1
  if (!infoA && infoB) return 1

  // Fallback to simple locale compare
  return a.localeCompare(b, 'zh')
}

export function usePdfMaker() {
  // State
  const folders = ref<Folder[]>([])
  const images = ref<ImageFile[]>([])
  const currentView = ref<'folders' | 'images'>('folders')
  const currentFolder = ref<Folder | null>(null)
  const selectedItems = ref<string[]>([])
  const customOrder = ref<string[]>([])
  const useCustomOrder = ref(false)
  const thumbnails = ref<Record<string, string>>({})
  const thumbnailSize = ref(200)
  const isLoading = ref(false)

  // PDF generation state
  const reduceEnabled = ref(true)
  const reduceEffort = ref<'standard' | 'compact' | 'minimal' | 'custom'>('standard')
  const customColors = ref<number | null>(128)
  const customSize = ref<string>('1280x720')
  const isGenerating = ref(false)
  const generateProgress = ref({ current: 0, total: 0 })

  // Progress listener cleanup
  let progressCleanup: (() => void) | null = null

  // Sorted folders based on mode
  const sortedFolders = computed(() => {
    if (useCustomOrder.value && customOrder.value.length > 0) {
      // Use custom order, append any new folders at the end
      const ordered: Folder[] = []
      const remaining = [...folders.value]

      for (const name of customOrder.value) {
        const idx = remaining.findIndex(f => f.name === name)
        if (idx !== -1) {
          ordered.push(remaining.splice(idx, 1)[0])
        }
      }

      // Sort remaining with natural sort and append
      remaining.sort((a, b) => compareFolders(a.name, b.name))
      return [...ordered, ...remaining]
    }

    // Natural sort (a-z with Chinese session rules)
    return [...folders.value].sort((a, b) => compareFolders(a.name, b.name))
  })

  // Sorted images (always a-z)
  const sortedImages = computed(() => {
    return [...images.value].sort((a, b) => a.name.localeCompare(b.name))
  })

  // Current folder display name (without slides_ prefix)
  const currentFolderDisplayName = computed(() => {
    if (!currentFolder.value) return ''
    const name = currentFolder.value.name
    return name.startsWith('slides_') ? name.slice(7) : name
  })

  // Load folders from output directory
  async function loadFolders() {
    isLoading.value = true
    try {
      folders.value = await window.electronAPI.pdfmaker.getFolders()
      // Reset custom order when reloading
      customOrder.value = []
      useCustomOrder.value = false
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Open folder (switch to images view)
  async function openFolder(folder: Folder) {
    currentFolder.value = folder
    currentView.value = 'images'
    selectedItems.value = []
    thumbnails.value = {}
    isLoading.value = true

    try {
      images.value = await window.electronAPI.pdfmaker.getImages(folder.path)
      await loadThumbnails()
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Go back to folders view
  function goBack() {
    currentView.value = 'folders'
    currentFolder.value = null
    images.value = []
    selectedItems.value = []
    thumbnails.value = {}
  }

  // Refresh current view
  async function refresh() {
    if (currentView.value === 'folders') {
      await loadFolders()
    } else if (currentFolder.value) {
      selectedItems.value = []
      isLoading.value = true
      try {
        images.value = await window.electronAPI.pdfmaker.getImages(currentFolder.value.path)
        // Keep existing thumbnails, load new ones
        await loadThumbnails()
      } catch (error) {
        console.error('Failed to refresh images:', error)
      } finally {
        isLoading.value = false
      }
    }
  }

  // Load thumbnails for images
  async function loadThumbnails() {
    for (const image of images.value) {
      if (!thumbnails.value[image.name]) {
        try {
          const base64 = await window.electronAPI.pdfmaker.getImageAsBase64(image.path)
          thumbnails.value[image.name] = `data:image/png;base64,${base64}`
        } catch {
          console.warn(`Failed to load thumbnail for ${image.name}`)
        }
      }
    }
  }

  // Toggle item selection
  function toggleSelection(name: string) {
    const idx = selectedItems.value.indexOf(name)
    if (idx === -1) {
      selectedItems.value.push(name)
    } else {
      selectedItems.value.splice(idx, 1)
    }
  }

  // Select all items
  function selectAll() {
    if (currentView.value === 'folders') {
      selectedItems.value = sortedFolders.value.map(f => f.name)
    } else {
      selectedItems.value = sortedImages.value.map(img => img.name)
    }
  }

  // Deselect all items
  function deselectAll() {
    selectedItems.value = []
  }

  // Delete selected images (move to in-app trash)
  async function deleteSelected() {
    if (selectedItems.value.length === 0 || currentView.value !== 'images') return

    isLoading.value = true
    try {
      for (const name of selectedItems.value) {
        const image = images.value.find(img => img.name === name)
        if (image) {
          await window.electronAPI.pdfmaker.deleteImage(image.path)
        }
      }

      // Remove from local list
      images.value = images.value.filter(img => !selectedItems.value.includes(img.name))

      // Clean up thumbnails
      for (const name of selectedItems.value) {
        delete thumbnails.value[name]
      }

      selectedItems.value = []
    } catch (error) {
      console.error('Failed to delete images:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Handle folder reorder via drag-drop
  function handleFolderReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return

    const folderNames = sortedFolders.value.map(f => f.name)
    const [moved] = folderNames.splice(fromIndex, 1)
    folderNames.splice(toIndex, 0, moved)

    customOrder.value = folderNames
    useCustomOrder.value = true
  }

  // Reset to natural sort order
  function resetSortOrder() {
    customOrder.value = []
    useCustomOrder.value = false
  }

  // Enable custom order mode (preserve current sorted order)
  function enableCustomOrder() {
    customOrder.value = sortedFolders.value.map(f => f.name)
    useCustomOrder.value = true
  }

  // Parse size string to width/height
  function parseSize(size: string): { width: number; height: number } {
    if (size === 'original') return { width: 1920, height: 1080 }
    const [w, h] = size.split('x').map(Number)
    return { width: w, height: h }
  }

  // Build FolderEntry array from selection in current sort order
  async function getSelectedFolderEntries(): Promise<FolderEntry[]> {
    const entries: FolderEntry[] = []

    // Get selected folders in their current sorted order
    const selectedFolders = sortedFolders.value.filter(f => selectedItems.value.includes(f.name))

    for (const folder of selectedFolders) {
      // Get images for this folder
      const folderImages = await window.electronAPI.pdfmaker.getImages(folder.path)
      // Sort images a-z
      const sortedImagePaths = folderImages
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(img => img.path)

      entries.push({
        name: folder.name.startsWith('slides_') ? folder.name.slice(7) : folder.name,
        path: folder.path,
        images: sortedImagePaths,
      })
    }

    return entries
  }

  // Build PDF options from current state
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

  // Make PDF from selected folders
  async function makePdf(): Promise<{ success: boolean; path?: string; error?: string }> {
    if (selectedItems.value.length === 0 || currentView.value !== 'folders') {
      return { success: false, error: 'No folders selected' }
    }

    isGenerating.value = true
    generateProgress.value = { current: 0, total: 0 }

    // Set up progress listener
    progressCleanup = window.electronAPI.pdfmaker.onProgress((progress) => {
      generateProgress.value = progress
    })

    try {
      const folders = await getSelectedFolderEntries()
      const options = buildPdfOptions()

      const result = await window.electronAPI.pdfmaker.makePdf(folders, options)
      return result
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

  // Cleanup on unmount
  onUnmounted(() => {
    if (progressCleanup) {
      progressCleanup()
      progressCleanup = null
    }
  })

  return {
    // State
    folders,
    images,
    currentView,
    currentFolder,
    currentFolderDisplayName,
    selectedItems,
    sortedFolders,
    sortedImages,
    thumbnails,
    thumbnailSize,
    isLoading,
    useCustomOrder,

    // PDF generation state
    reduceEnabled,
    reduceEffort,
    customColors,
    customSize,
    isGenerating,
    generateProgress,

    // Methods
    loadFolders,
    openFolder,
    goBack,
    refresh,
    toggleSelection,
    selectAll,
    deselectAll,
    deleteSelected,
    handleFolderReorder,
    resetSortOrder,
    enableCustomOrder,
    makePdf,
  }
}
