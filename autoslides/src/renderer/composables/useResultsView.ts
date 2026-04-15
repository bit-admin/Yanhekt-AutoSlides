import { ref, computed, onMounted, watch } from 'vue'
import { compareToolFolders, compareToolImages, formatToolFolderName } from '../utils/toolWindowFolders'

export type ResultsReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'manual'

interface RemovedEntry {
  id: string
  filename: string
  originalPath: string
  originalParentFolder: string
  trashPath: string
  reason: ResultsReason
  reasonDetails?: string
  trashedAt: string
}

export interface ResultsFolder {
  name: string
  path?: string
  activeCount: number
  removedCount: number
}

export interface ResultsItem {
  id: string
  name: string
  status: 'active' | 'removed'
  imagePath?: string
  trashPath?: string
  originalPath?: string
  reason?: ResultsReason
  reasonDetails?: string
  trashedAt?: string
}

type ResultsViewMode = 'folders' | 'images'
type ContextMode = 'context' | 'removed-only' | 'extracted-only'

export function useResultsView() {
  const folders = ref<ResultsFolder[]>([])
  const activeFolders = ref<Array<{ name: string; path: string }>>([])
  const trashEntries = ref<RemovedEntry[]>([])
  const currentView = ref<ResultsViewMode>('folders')
  const currentFolder = ref<ResultsFolder | null>(null)
  const folderItems = ref<ResultsItem[]>([])
  const selectedIds = ref<string[]>([])
  const selectedReason = ref<ResultsReason | ''>('')
  const contextMode = ref<ContextMode>('context')
  const thumbnails = ref<Record<string, string>>({})
  const thumbnailSize = ref(250)
  const isLoading = ref(false)
  const previewItem = ref<ResultsItem | null>(null)

  let thumbnailLoadVersion = 0

  const currentFolderDisplayName = computed(() => {
    return currentFolder.value ? formatToolFolderName(currentFolder.value.name) : ''
  })

  const filteredItems = computed(() => {
    return folderItems.value.filter((item) => {
      if (item.status === 'active') {
        return contextMode.value === 'context' || contextMode.value === 'extracted-only'
      }

      if (contextMode.value === 'extracted-only') {
        return false
      }

      if (selectedReason.value && item.reason !== selectedReason.value) {
        return false
      }

      return true
    })
  })

  const selectedItems = computed(() => {
    const selected = new Set(selectedIds.value)
    return folderItems.value.filter((item) => selected.has(item.id))
  })

  const selectedActiveItems = computed(() => {
    return selectedItems.value.filter((item) => item.status === 'active')
  })

  const selectedRemovedItems = computed(() => {
    return selectedItems.value.filter((item) => item.status === 'removed')
  })

  const hasRemovedItems = computed(() => {
    return folderItems.value.some((item) => item.status === 'removed')
  })

  watch([selectedReason, contextMode], () => {
    selectedIds.value = []
  })

  async function loadFolderSummaries() {
    const [activeFolderList, removedEntries] = await Promise.all([
      window.electronAPI.pdfmaker.getFolders(),
      window.electronAPI.trash.getEntries(),
    ])

    activeFolders.value = activeFolderList
    trashEntries.value = removedEntries

    const activeCounts = await Promise.all(
      activeFolderList.map(async (folder) => {
        try {
          const images = await window.electronAPI.pdfmaker.getImages(folder.path)
          return { folder, count: images.length }
        } catch (error) {
          console.warn(`Failed to count images for ${folder.name}:`, error)
          return { folder, count: 0 }
        }
      })
    )

    const folderMap = new Map<string, ResultsFolder>()

    for (const { folder, count } of activeCounts) {
      folderMap.set(folder.name, {
        name: folder.name,
        path: folder.path,
        activeCount: count,
        removedCount: 0,
      })
    }

    for (const entry of removedEntries) {
      const existing = folderMap.get(entry.originalParentFolder)
      if (existing) {
        existing.removedCount += 1
      } else {
        folderMap.set(entry.originalParentFolder, {
          name: entry.originalParentFolder,
          activeCount: 0,
          removedCount: 1,
        })
      }
    }

    folders.value = Array.from(folderMap.values()).sort((a, b) => compareToolFolders(a.name, b.name))
  }

  async function buildFolderItems(folder: ResultsFolder): Promise<ResultsItem[]> {
    const activeFolder = activeFolders.value.find((entry) => entry.name === folder.name)

    let activeItems: ResultsItem[] = []
    if (activeFolder?.path) {
      try {
        const images = await window.electronAPI.pdfmaker.getImages(activeFolder.path)
        activeItems = images.map((image) => ({
          id: image.path,
          name: image.name,
          status: 'active',
          imagePath: image.path,
          originalPath: image.path,
        }))
      } catch (error) {
        console.warn(`Failed to load images for ${folder.name}:`, error)
      }
    }

    const removedItems: ResultsItem[] = trashEntries.value
      .filter((entry) => entry.originalParentFolder === folder.name)
      .map((entry) => ({
        id: entry.id,
        name: entry.filename,
        status: 'removed',
        trashPath: entry.trashPath,
        originalPath: entry.originalPath,
        reason: entry.reason,
        reasonDetails: entry.reasonDetails,
        trashedAt: entry.trashedAt,
      }))

    return [...activeItems, ...removedItems].sort((a, b) => compareToolImages(a.name, b.name))
  }

  async function loadCurrentFolderItems(folder: ResultsFolder) {
    thumbnails.value = {}
    folderItems.value = await buildFolderItems(folder)
    void loadThumbnails(folderItems.value)
  }

  async function loadThumbnails(items: ResultsItem[]) {
    const version = ++thumbnailLoadVersion

    for (const item of items) {
      if (version !== thumbnailLoadVersion) return
      if (thumbnails.value[item.id]) continue

      try {
        const base64 = item.status === 'removed' && item.trashPath
          ? await window.electronAPI.trash.getImageAsBase64(item.trashPath)
          : item.imagePath
            ? await window.electronAPI.pdfmaker.getImageAsBase64(item.imagePath)
            : null

        if (base64 && version === thumbnailLoadVersion) {
          thumbnails.value[item.id] = `data:image/png;base64,${base64}`
        }
      } catch (error) {
        console.warn(`Failed to load thumbnail for ${item.name}:`, error)
      }
    }
  }

  async function refresh() {
    isLoading.value = true
    selectedIds.value = []
    previewItem.value = null

    try {
      await loadFolderSummaries()

      if (currentView.value === 'images' && currentFolder.value) {
        const refreshedFolder = folders.value.find((folder) => folder.name === currentFolder.value?.name)
        if (!refreshedFolder) {
          goBack()
          return
        }

        currentFolder.value = refreshedFolder
        await loadCurrentFolderItems(refreshedFolder)
      }
    } catch (error) {
      console.error('Failed to refresh results view:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function openFolder(folder: ResultsFolder) {
    currentView.value = 'images'
    currentFolder.value = folder
    selectedIds.value = []
    selectedReason.value = ''
    contextMode.value = 'context'
    previewItem.value = null
    isLoading.value = true

    try {
      await loadCurrentFolderItems(folder)
    } catch (error) {
      console.error('Failed to open results folder:', error)
    } finally {
      isLoading.value = false
    }
  }

  function goBack() {
    currentView.value = 'folders'
    currentFolder.value = null
    folderItems.value = []
    selectedIds.value = []
    selectedReason.value = ''
    contextMode.value = 'context'
    previewItem.value = null
    thumbnails.value = {}
    thumbnailLoadVersion += 1
  }

  function toggleSelection(id: string) {
    const index = selectedIds.value.indexOf(id)
    if (index === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(index, 1)
    }
  }

  function openPreview(item: ResultsItem) {
    previewItem.value = item
  }

  function closePreview() {
    previewItem.value = null
  }

  async function deleteSelected() {
    if (selectedActiveItems.value.length === 0) return

    isLoading.value = true
    try {
      for (const item of selectedActiveItems.value) {
        if (item.imagePath) {
          await window.electronAPI.pdfmaker.deleteImage(item.imagePath)
        }
      }

      await refresh()
    } catch (error) {
      console.error('Failed to delete selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function restoreSelected() {
    if (selectedRemovedItems.value.length === 0) return

    isLoading.value = true
    try {
      const ids = selectedRemovedItems.value.map((item) => item.id)
      await window.electronAPI.trash.restore(ids)
      await refresh()
    } catch (error) {
      console.error('Failed to restore selected images:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function clearTrash(ids?: string[]) {
    isLoading.value = true
    try {
      if (ids && ids.length > 0) {
        await window.electronAPI.trash.clearEntries(ids)
      } else {
        await window.electronAPI.trash.clear()
      }
      await refresh()
    } catch (error) {
      console.error('Failed to clear trash:', error)
    } finally {
      isLoading.value = false
    }
  }

  function formatDate(value?: string): string {
    if (!value) return ''

    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  onMounted(() => {
    refresh()
  })

  return {
    folders,
    currentView,
    currentFolder,
    currentFolderDisplayName,
    folderItems,
    filteredItems,
    selectedIds,
    selectedActiveItems,
    selectedRemovedItems,
    selectedReason,
    contextMode,
    thumbnails,
    thumbnailSize,
    isLoading,
    previewItem,
    hasRemovedItems,
    openFolder,
    goBack,
    refresh,
    toggleSelection,
    openPreview,
    closePreview,
    deleteSelected,
    restoreSelected,
    clearTrash,
    formatDate,
    formatToolFolderName,
  }
}
