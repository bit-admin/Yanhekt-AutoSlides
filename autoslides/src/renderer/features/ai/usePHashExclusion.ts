import { ref, nextTick, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createPHashWorkerClient } from '@shared/workers/pHashWorkerClient'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('PHashExclusion');

export interface PHashExclusionItem {
  id: string
  name: string
  pHash: string
  createdAt: number
  isPreset?: boolean
  isEnabled?: boolean
}

export interface UsePHashExclusionReturn {
  // State
  pHashExclusionList: Ref<PHashExclusionItem[]>
  isAddingExclusion: Ref<boolean>

  // Name input modal state
  showNameInputModal: Ref<boolean>
  nameInputValue: Ref<string>

  // Methods
  loadPHashExclusionList: () => Promise<void>
  addExclusionItem: () => Promise<void>
  removeExclusionItem: (id: string) => Promise<void>
  editExclusionItemName: (item: PHashExclusionItem) => Promise<void>
  clearExclusionList: () => Promise<void>
  showNameInputDialog: (defaultValue?: string) => Promise<string | null>
  confirmNameInput: () => void
  cancelNameInput: () => void
}

export function usePHashExclusion(): UsePHashExclusionReturn {
  const { t } = useI18n()

  // State
  const pHashExclusionList = ref<PHashExclusionItem[]>([])
  const isAddingExclusion = ref(false)

  // Name input modal state
  const showNameInputModal = ref(false)
  const nameInputValue = ref('')
  const nameInputCallback = ref<((name: string | null) => void) | null>(null)

  // Load exclusion list
  const loadPHashExclusionList = async () => {
    try {
      const exclusionList = await window.electronAPI.config.getPHashExclusionList()
      pHashExclusionList.value = exclusionList || []
    } catch (error) {
      log.error('Failed to load pHash exclusion list:', error)
      pHashExclusionList.value = []
    }
  }

  // Calculate pHash via the shared worker client (one-shot — worker is
  // destroyed after the result resolves or after a 30s timeout).
  const calculatePHashWithWorker = async (imageData: ImageData): Promise<string> => {
    const client = createPHashWorkerClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const result = await Promise.race<string>([
        client.calculatePHash(imageData),
        new Promise<string>((_, reject) => {
          timer = setTimeout(() => reject(new Error('pHash calculation timeout')), 30000)
        }),
      ])
      return result
    } finally {
      if (timer) clearTimeout(timer)
      client.destroy()
    }
  }

  // Show name input dialog
  const showNameInputDialog = (defaultValue = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      nameInputValue.value = defaultValue
      nameInputCallback.value = resolve
      showNameInputModal.value = true

      nextTick(() => {
        const inputField = document.querySelector('.name-input-field') as HTMLInputElement
        if (inputField) {
          inputField.focus()
          inputField.select()
        }
      })
    })
  }

  // Confirm name input
  const confirmNameInput = () => {
    const callback = nameInputCallback.value
    if (callback) {
      callback(nameInputValue.value.trim() || null)
    }
    closeNameInputDialog()
  }

  // Cancel name input
  const cancelNameInput = () => {
    const callback = nameInputCallback.value
    if (callback) {
      callback(null)
    }
    closeNameInputDialog()
  }

  // Close name input dialog
  const closeNameInputDialog = () => {
    showNameInputModal.value = false
    nameInputValue.value = ''
    nameInputCallback.value = null
  }

  // Add exclusion item
  const addExclusionItem = async () => {
    if (isAddingExclusion.value) return

    isAddingExclusion.value = true
    try {
      // Select image file
      const result = await window.electronAPI.config.selectImageForExclusion()

      if (!result.success) {
        if (!result.canceled) {
          log.error('Failed to select image:', result.error)
          alert('Failed to select image: ' + (result.error || 'Unknown error'))
        }
        return
      }

      if (!result.imageBuffer || !result.fileName) {
        log.error('Missing image data or filename')
        alert('Failed to process selected image: Missing data')
        return
      }

      // Convert array back to Uint8Array
      const imageBuffer = new Uint8Array(result.imageBuffer)

      // Create image from buffer
      const blob = new Blob([imageBuffer])
      const imageUrl = URL.createObjectURL(blob)

      try {
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })

        // Create canvas and get ImageData
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)

        // Calculate pHash
        const pHash = await calculatePHashWithWorker(imageData)

        // Prompt for name
        const defaultName = result.fileName.replace(/\.[^/.]+$/, '')
        const name = await showNameInputDialog(defaultName)
        if (!name || !name.trim()) {
          return
        }

        // Add to exclusion list
        await window.electronAPI.config.addPHashExclusionItem(name.trim(), pHash)

        // Reload the list
        await loadPHashExclusionList()

        log.debug('Added exclusion item:', { name: name.trim(), pHash })
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
    } catch (error) {
      log.error('Failed to add exclusion item:', error)
      alert('Failed to add exclusion item: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      isAddingExclusion.value = false
    }
  }

  // Remove exclusion item
  const removeExclusionItem = async (id: string) => {
    try {
      const success = await window.electronAPI.config.removePHashExclusionItem(id)
      if (success) {
        await loadPHashExclusionList()
      } else {
        log.error('Failed to remove exclusion item')
      }
    } catch (error) {
      log.error('Failed to remove exclusion item:', error)
    }
  }

  // Edit exclusion item name
  const editExclusionItemName = async (item: PHashExclusionItem) => {
    const newName = await showNameInputDialog(item.name)
    if (newName && newName.trim() && newName.trim() !== item.name) {
      try {
        const success = await window.electronAPI.config.updatePHashExclusionItemName(item.id, newName.trim())
        if (success) {
          await loadPHashExclusionList()
        } else {
          log.error('Failed to update exclusion item name')
        }
      } catch (error) {
        log.error('Failed to update exclusion item name:', error)
      }
    }
  }

  // Clear exclusion list
  const clearExclusionList = async () => {
    try {
      const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
        type: 'question',
        buttons: [t('advanced.cancel'), t('advanced.clearAll')],
        defaultId: 1,
        cancelId: 0,
        title: t('advanced.clearExclusionListTitle'),
        message: t('advanced.clearExclusionListMessage'),
        detail: t('advanced.clearExclusionListDetail')
      })

      if (confirmed?.response === 1) {
        await window.electronAPI.config.clearPHashExclusionList()
        await loadPHashExclusionList()
      }
    } catch (error) {
      log.error('Failed to clear exclusion list:', error)
    }
  }

  return {
    // State
    pHashExclusionList,
    isAddingExclusion,

    // Name input modal state
    showNameInputModal,
    nameInputValue,

    // Methods
    loadPHashExclusionList,
    addExclusionItem,
    removeExclusionItem,
    editExclusionItemName,
    clearExclusionList,
    showNameInputDialog,
    confirmNameInput,
    cancelNameInput
  }
}
