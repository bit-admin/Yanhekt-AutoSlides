import { ref } from 'vue'
import { TokenManager } from '../services/authService'
import { classifyMultipleImages as dispatchClassifyMultiple } from '../services/slideClassificationService'

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
  const tokenManager = new TokenManager()

  // State
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

  // Worker helpers (same pattern as usePostProcessing)
  const createWorkerHelpers = (worker: Worker) => {
    const calculatePHash = (imageData: ImageData): Promise<string> => {
      return new Promise((resolve, reject) => {
        const messageId = `pHash_${Date.now()}_${Math.random()}`
        const messageHandler = (event: MessageEvent) => {
          const { id, success, result, error } = event.data
          if (id === messageId) {
            worker.removeEventListener('message', messageHandler)
            success ? resolve(result) : reject(new Error(error))
          }
        }
        worker.addEventListener('message', messageHandler)
        worker.postMessage({ id: messageId, type: 'calculatePHash', data: { imageData } })
      })
    }

    const calculateHammingDistance = (hash1: string, hash2: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const messageId = `hamming_${Date.now()}_${Math.random()}`
        const messageHandler = (event: MessageEvent) => {
          const { id, success, result, error } = event.data
          if (id === messageId) {
            worker.removeEventListener('message', messageHandler)
            success ? resolve(result) : reject(new Error(error))
          }
        }
        worker.addEventListener('message', messageHandler)
        worker.postMessage({ id: messageId, type: 'calculateHammingDistance', data: { hash1, hash2 } })
      })
    }

    return { calculatePHash, calculateHammingDistance }
  }

  // Convert Uint8Array to ImageData for pHash worker
  const bufferToImageData = (buffer: Uint8Array): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer as BlobPart])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        URL.revokeObjectURL(url)
        resolve(imageData)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }
      img.src = url
    })
  }

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
      // Extract folder name
      const parts = folderPath.replace(/\\/g, '/').split('/')
      inputFolderName.value = parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
      // Compute output dir: {configuredOutputDir}/slides_{folderName}
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
  }

  const startProcessing = async () => {
    if (!inputFolderPath.value || !outputDir.value) return

    isProcessing.value = true
    isCancelled.value = false
    resetProgress()

    try {
      // Read pHash threshold from app config
      const slideConfig = await window.electronAPI.config?.getSlideExtractionConfig?.()
      const configPHashThreshold = slideConfig?.pHashThreshold ?? 10

      // Step 1: List images
      const images = await window.electronAPI.offline.listImages(inputFolderPath.value)
      if (images.length === 0) {
        resetProgress()
        progress.value.errorMessage = 'noImagesFound'
        isProcessing.value = false
        return
      }

      // Step 2: Copy & Convert
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

      // Get list of output files for processing
      let outputFiles = await window.electronAPI.offline.listImages(outputDir.value)
      outputFiles = outputFiles.filter((f: string) => f.startsWith('Slide_') && f.endsWith('.png'))

      // Step 3: Phase 1 — Duplicate Removal
      if (enableDuplicateRemoval.value && !isCancelled.value) {
        progress.value.phase = 'phase1'
        progress.value.total = outputFiles.length
        progress.value.currentIndex = 0

        const worker = new Worker(
          new URL('../workers/postProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        )
        const { calculatePHash, calculateHammingDistance } = createWorkerHelpers(worker)

        // Calculate pHashes
        const hashes: Array<{ filename: string; pHash: string }> = []
        for (let i = 0; i < outputFiles.length; i++) {
          if (isCancelled.value) break
          const filename = outputFiles[i]
          try {
            const buffer = await window.electronAPI.offline.readImageBuffer(`${outputDir.value}/${filename}`)
            const imageData = await bufferToImageData(buffer)
            const pHash = await calculatePHash(imageData)
            hashes.push({ filename, pHash })
          } catch (err) {
            console.warn(`Failed to calculate pHash for ${filename}:`, err)
            hashes.push({ filename, pHash: '' })
          }
          progress.value.currentIndex = i + 1
        }

        if (!isCancelled.value) {
          // Find and delete duplicates
          const seenHashes = new Map<string, string>()
          const duplicates: Array<{ filename: string; duplicateOf: string }> = []

          for (const item of hashes) {
            if (!item.pHash) {
              seenHashes.set(item.filename, item.filename)
              continue
            }
            let duplicateOf = ''
            for (const [seenHash, seenFilename] of seenHashes.entries()) {
              try {
                const distance = await calculateHammingDistance(item.pHash, seenHash)
                if (distance <= configPHashThreshold) {
                  duplicateOf = seenFilename
                  break
                }
              } catch {
                // skip
              }
            }
            if (duplicateOf) {
              duplicates.push({ filename: item.filename, duplicateOf })
            } else {
              seenHashes.set(item.pHash, item.filename)
            }
          }

          for (const dup of duplicates) {
            if (isCancelled.value) break
            try {
              await window.electronAPI.slideExtraction.moveToInAppTrash(outputDir.value, dup.filename, {
                reason: 'duplicate',
                reasonDetails: `Duplicate of ${dup.duplicateOf}`
              })
              progress.value.duplicatesRemoved++
            } catch (err) {
              console.warn(`Failed to move duplicate ${dup.filename} to trash:`, err)
            }
          }

          // Update file list
          outputFiles = outputFiles.filter((f: string) => !duplicates.some(d => d.filename === f))
        }

        worker.terminate()
      }

      if (isCancelled.value) {
        progress.value.phase = 'cancelled'
        isProcessing.value = false
        return
      }

      // Step 4: Phase 2 — Exclusion List
      if (enableExclusionList.value && !isCancelled.value) {
        progress.value.phase = 'phase2'
        progress.value.total = outputFiles.length
        progress.value.currentIndex = 0

        const exclusionList: Array<{ name: string; pHash: string; isEnabled?: boolean; isPreset?: boolean }> =
          await window.electronAPI.config.getPHashExclusionList() || []
        const activeExclusions = exclusionList.filter(
          item => !item.isPreset || item.isEnabled !== false
        )

        if (activeExclusions.length > 0) {
          const worker = new Worker(
            new URL('../workers/postProcessor.worker.ts', import.meta.url),
            { type: 'module' }
          )
          const { calculatePHash, calculateHammingDistance } = createWorkerHelpers(worker)

          const excluded: Array<{ filename: string; reasonDetails: string }> = []

          for (let i = 0; i < outputFiles.length; i++) {
            if (isCancelled.value) break
            const filename = outputFiles[i]
            try {
              const buffer = await window.electronAPI.offline.readImageBuffer(`${outputDir.value}/${filename}`)
              const imageData = await bufferToImageData(buffer)
              const pHash = await calculatePHash(imageData)

              for (const excItem of activeExclusions) {
                try {
                  const distance = await calculateHammingDistance(pHash, excItem.pHash)
                  if (distance <= configPHashThreshold) {
                    excluded.push({
                      filename,
                      reasonDetails: `Similar to "${excItem.name}" (distance: ${distance})`
                    })
                    break
                  }
                } catch {
                  // skip
                }
              }
            } catch (err) {
              console.warn(`Failed to check exclusion for ${filename}:`, err)
            }
            progress.value.currentIndex = i + 1
          }

          for (const exc of excluded) {
            if (isCancelled.value) break
            try {
              await window.electronAPI.slideExtraction.moveToInAppTrash(outputDir.value, exc.filename, {
                reason: 'exclusion',
                reasonDetails: exc.reasonDetails
              })
              progress.value.excludedRemoved++
            } catch (err) {
              console.warn(`Failed to move excluded ${exc.filename} to trash:`, err)
            }
          }

          outputFiles = outputFiles.filter((f: string) => !excluded.some(e => e.filename === f))
          worker.terminate()
        }
      }

      if (isCancelled.value) {
        progress.value.phase = 'cancelled'
        isProcessing.value = false
        return
      }

      // Step 5: Phase 3 — AI Classification
      if (enableAIFiltering.value && !isCancelled.value) {
        progress.value.phase = 'phase3'
        progress.value.total = outputFiles.length
        progress.value.currentIndex = 0

        const token = tokenManager.getToken() || undefined
        const aiConfig = await window.electronAPI.config?.getAIFilteringConfig?.()
        const batchSize = aiConfig?.batchSize || 5
        const imageResizeWidth = aiConfig?.imageResizeWidth || 768
        const imageResizeHeight = aiConfig?.imageResizeHeight || 432

        for (let i = 0; i < outputFiles.length; i += batchSize) {
          if (isCancelled.value) break

          const batch = outputFiles.slice(i, i + batchSize)
          const base64Images: string[] = []

          for (const filename of batch) {
            try {
              const base64 = await window.electronAPI.offline.readImageForAI(
                `${outputDir.value}/${filename}`,
                imageResizeWidth,
                imageResizeHeight
              )
              base64Images.push(base64)
            } catch (err) {
              console.warn(`Failed to read ${filename} for AI:`, err)
              base64Images.push('')
            }
          }

          // Filter out empty images
          const validIndices = base64Images.map((b, idx) => b ? idx : -1).filter(idx => idx >= 0)
          const validImages = validIndices.map(idx => base64Images[idx])

          if (validImages.length > 0) {
            try {
              const result = await dispatchClassifyMultiple(
                validImages, 'recorded', token
              )

              if (result.success && result.result) {
                type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit'
                const batchResult = result.result as { [key: string]: ClassificationValue }
                for (let j = 0; j < validIndices.length; j++) {
                  const originalIdx = validIndices[j]
                  const classification: ClassificationValue = batchResult[`image_${j}`] || 'slide'
                  if (classification === 'not_slide' || classification === 'may_be_slide_edit') {
                    const isEdit = classification === 'may_be_slide_edit'
                    try {
                      await window.electronAPI.slideExtraction.moveToInAppTrash(
                        outputDir.value, batch[originalIdx], {
                          reason: isEdit ? 'ai_filtered_edit' : 'ai_filtered',
                          reasonDetails: isEdit
                            ? 'AI classified as may_be_slide_edit'
                            : 'AI classified as not_slide'
                        }
                      )
                      progress.value.aiFiltered++
                    } catch (err) {
                      console.warn(`Failed to move AI-filtered ${batch[originalIdx]} to trash:`, err)
                    }
                  }
                }
              }
            } catch (aiError: unknown) {
              // Only reached on thrown IPC / runtime exceptions. Typed rate-limit errors
              // (429/502) are already retried in llmApiService and return via result.success,
              // not via thrown exceptions — so we don't retry 429 here anymore.
              const errorStr = aiError instanceof Error ? aiError.message : String(aiError)
              if (errorStr.includes('413') || errorStr.toLowerCase().includes('payload too large')) {
                console.warn('AI batch too large, processing individually')
                for (const idx of validIndices) {
                  if (isCancelled.value) break
                  try {
                    const singleResult = await dispatchClassifyMultiple(
                      [base64Images[idx]], 'recorded', token
                    )
                    if (singleResult.success && singleResult.result) {
                      type ClassificationValue = 'slide' | 'not_slide' | 'may_be_slide_edit'
                      const sr = singleResult.result as { [key: string]: ClassificationValue }
                      const cls = sr['image_0']
                      if (cls === 'not_slide' || cls === 'may_be_slide_edit') {
                        const isEdit = cls === 'may_be_slide_edit'
                        await window.electronAPI.slideExtraction.moveToInAppTrash(
                          outputDir.value, batch[idx], {
                            reason: isEdit ? 'ai_filtered_edit' : 'ai_filtered',
                            reasonDetails: isEdit
                              ? 'AI classified as may_be_slide_edit'
                              : 'AI classified as not_slide'
                          }
                        )
                        progress.value.aiFiltered++
                      }
                    }
                  } catch {
                    console.warn(`AI classification failed for ${batch[idx]}`)
                  }
                }
              } else {
                console.error('AI classification error:', aiError)
              }
            }
          }

          progress.value.currentIndex = Math.min(i + batchSize, outputFiles.length)
        }
      }

      if (isCancelled.value) {
        progress.value.phase = 'cancelled'
      } else {
        progress.value.phase = 'completed'
      }
    } catch (error) {
      console.error('Offline processing error:', error)
      progress.value.phase = 'error'
      progress.value.errorMessage = error instanceof Error ? error.message : String(error)
    } finally {
      isProcessing.value = false
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
