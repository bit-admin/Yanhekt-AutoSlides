import { ref } from 'vue'
import { tokenManager } from '@shared/services/authService'
import { PostProcessingPipeline } from '@shared/postProcessing/pipeline'
import { createOfflineDataSource } from '@shared/postProcessing/imageSources'
import type {
  PostProcessingConfig,
  PostProcessingProgress
} from '@shared/postProcessing/types'

export interface OfflineProgress {
  phase: 'idle' | 'copying' | 'phase1' | 'phase2' | 'phase3' | 'completed' | 'error' | 'cancelled'
  currentIndex: number
  total: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  errorMessage?: string
}

export function useOfflineProcessing() {
  const showOfflineModal = ref(false)
  const inputFolderPath = ref('')
  const inputFolderName = ref('')
  const outputDir = ref('')
  const enableDuplicateRemoval = ref(true)
  const enableExclusionList = ref(true)
  const enableAIFiltering = ref(true)
  const enablePngColorReduction = ref(true)
  const isProcessing = ref(false)
  const isCancelled = ref(false)
  const progress = ref<OfflineProgress>({
    phase: 'idle',
    currentIndex: 0,
    total: 0,
    duplicatesRemoved: 0,
    excludedRemoved: 0,
    aiFiltered: 0
  })

  // Active abort controller for the current run. cancelProcessing() trips it.
  let abortController: AbortController | null = null

  const resetProgress = () => {
    progress.value = {
      phase: 'idle',
      currentIndex: 0,
      total: 0,
      duplicatesRemoved: 0,
      excludedRemoved: 0,
      aiFiltered: 0
    }
  }

  const openModal = () => {
    inputFolderPath.value = ''
    inputFolderName.value = ''
    outputDir.value = ''
    enableDuplicateRemoval.value = true
    enableExclusionList.value = true
    enableAIFiltering.value = true
    enablePngColorReduction.value = true
    isProcessing.value = false
    isCancelled.value = false
    resetProgress()
    showOfflineModal.value = true
  }

  const closeModal = () => {
    if (isProcessing.value) return
    showOfflineModal.value = false
  }

  const selectInputFolder = async () => {
    const folderPath = await window.electronAPI.offline.selectInputFolder()
    if (folderPath) {
      inputFolderPath.value = folderPath
      const parts = folderPath.replace(/\\/g, '/').split('/')
      inputFolderName.value = parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
      const config = await window.electronAPI.config.get()
      const configuredOutputDir = config.outputDirectory || ''
      outputDir.value = configuredOutputDir
        ? `${configuredOutputDir}/slides_${inputFolderName.value}`
        : ''
      progress.value.errorMessage = undefined
    }
  }

  const cancelProcessing = () => {
    isCancelled.value = true
    abortController?.abort()
  }

  const mirrorProgress = (snap: PostProcessingProgress) => {
    switch (snap.phase) {
      case 'phase1':
        progress.value.phase = 'phase1'
        progress.value.currentIndex = snap.phase1.processed
        progress.value.total = snap.phase1.total
        progress.value.duplicatesRemoved = snap.phase1.duplicatesRemoved
        break
      case 'phase2':
        progress.value.phase = 'phase2'
        progress.value.currentIndex = snap.phase2.processed
        progress.value.total = snap.phase2.total
        progress.value.excludedRemoved = snap.phase2.excludedRemoved
        break
      case 'phase3':
        progress.value.phase = 'phase3'
        progress.value.currentIndex = snap.phase3.processed
        progress.value.total = snap.phase3.total
        progress.value.aiFiltered = snap.phase3.aiFiltered + snap.phase3.aiFilteredEdit
        break
      case 'completed':
        progress.value.phase = 'completed'
        break
      case 'cancelled':
        progress.value.phase = 'cancelled'
        break
      case 'failed':
        progress.value.phase = 'error'
        break
      default:
        break
    }
  }

  // Reads offline-tab-specific toggles (the modal checkboxes) plus the shared
  // AI / pHash settings, and packs them into a PostProcessingConfig.
  const loadConfig = async (): Promise<PostProcessingConfig> => {
    const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
    const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
    const exclusionListRaw =
      (await window.electronAPI.config.getPHashExclusionList()) || []
    const exclusionList = exclusionListRaw
      .filter((item: { isPreset?: boolean; isEnabled?: boolean }) =>
        !item.isPreset || item.isEnabled !== false
      )
      .map((item: { name: string; pHash: string }) => ({ name: item.name, pHash: item.pHash }))

    return {
      pHashThreshold: slideConfig?.pHashThreshold ?? 10,
      // Per-run overrides from the modal checkboxes take precedence over global settings.
      enableDuplicateRemoval: enableDuplicateRemoval.value,
      enableExclusionList: enableExclusionList.value,
      enableAIFiltering: enableAIFiltering.value,
      exclusionList,
      aiBatchSize: aiConfig?.batchSize || 5,
      aiImageResizeWidth: aiConfig?.imageResizeWidth || 768,
      aiImageResizeHeight: aiConfig?.imageResizeHeight || 432
    }
  }

  const startProcessing = async () => {
    if (!inputFolderPath.value || !outputDir.value) return

    isProcessing.value = true
    isCancelled.value = false
    resetProgress()
    abortController = new AbortController()

    try {
      const images = await window.electronAPI.offline.listImages(inputFolderPath.value)
      if (images.length === 0) {
        resetProgress()
        progress.value.errorMessage = 'noImagesFound'
        isProcessing.value = false
        return
      }

      // Copy & convert is offline-tab-specific (it transcodes inputs to PNG with
      // optional color reduction). The unified pipeline picks up from the output dir.
      progress.value.phase = 'copying'
      progress.value.total = images.length
      progress.value.currentIndex = 0

      for (let i = 0; i < images.length; i++) {
        if (isCancelled.value) {
          progress.value.phase = 'cancelled'
          isProcessing.value = false
          return
        }
        const imageName = images[i]
        const nameWithoutExt = imageName.replace(/\.[^.]+$/, '')
        const outputFilename = `Slide_${nameWithoutExt}.png`
        const inputPath = `${inputFolderPath.value}/${imageName}`

        await window.electronAPI.offline.copyAndConvert(
          inputPath,
          outputDir.value,
          outputFilename,
          enablePngColorReduction.value
        )
        progress.value.currentIndex = i + 1
      }

      let outputFiles = await window.electronAPI.offline.listImages(outputDir.value)
      outputFiles = outputFiles.filter((f: string) => f.startsWith('Slide_') && f.endsWith('.png'))

      if (outputFiles.length === 0) {
        progress.value.phase = 'completed'
        return
      }

      const config = await loadConfig()
      const dataSource = createOfflineDataSource(outputDir.value)
      const token = tokenManager.getToken() || undefined

      const result = await PostProcessingPipeline.run(
        {
          outputPath: outputDir.value,
          imageFiles: outputFiles,
          config,
          promptType: 'recorded',
          token
        },
        dataSource,
        {
          signal: abortController.signal,
          onProgress: mirrorProgress
        }
      )

      if (result.status === 'cancelled') {
        progress.value.phase = 'cancelled'
      } else if (result.status === 'failed') {
        progress.value.phase = 'error'
        progress.value.errorMessage = result.failed[0]?.message || 'Post-processing failed'
      } else {
        progress.value.phase = 'completed'
      }
    } catch (error) {
      console.error('Offline processing error:', error)
      progress.value.phase = 'error'
      progress.value.errorMessage = error instanceof Error ? error.message : String(error)
    } finally {
      isProcessing.value = false
      abortController = null
    }
  }

  return {
    showOfflineModal,
    inputFolderPath,
    inputFolderName,
    outputDir,
    enableDuplicateRemoval,
    enableExclusionList,
    enableAIFiltering,
    enablePngColorReduction,
    isProcessing,
    progress,
    openModal,
    closeModal,
    selectInputFolder,
    startProcessing,
    cancelProcessing
  }
}
