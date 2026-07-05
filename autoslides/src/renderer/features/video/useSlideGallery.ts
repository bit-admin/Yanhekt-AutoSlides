import { ref, type Ref, type ShallowRef } from 'vue'
import type { ExtractedSlide, SlideExtractionHandle } from '@shared/processing'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('SlideGallery');

export interface UseSlideGalleryOptions {
  extractedSlides: Ref<ExtractedSlide[]>
  slideExtractorInstance: ShallowRef<SlideExtractionHandle | null>
  t: (key: string, params?: Record<string, unknown>) => string
}

export interface UseSlideGalleryReturn {
  // State
  selectedSlide: Ref<ExtractedSlide | null>

  // Methods
  openSlideModal: (slide: ExtractedSlide) => void
  closeSlideModal: () => void
  deleteSlide: (slide: ExtractedSlide, showConfirmation?: boolean) => Promise<void>
  clearAllSlides: () => Promise<void>
  formatSlideTime: (timestamp: string) => string
}

export function useSlideGallery(options: UseSlideGalleryOptions): UseSlideGalleryReturn {
  const { extractedSlides, slideExtractorInstance, t } = options

  // State
  const selectedSlide = ref<ExtractedSlide | null>(null)

  // Open slide modal
  const openSlideModal = (slide: ExtractedSlide) => {
    selectedSlide.value = slide
  }

  // Close slide modal
  const closeSlideModal = () => {
    selectedSlide.value = null
  }

  // Format slide time
  const formatSlideTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  // Delete a single slide
  const deleteSlide = async (slide: ExtractedSlide, showConfirmation = true) => {
    try {
      // Show confirmation dialog if requested
      if (showConfirmation) {
        const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
          type: 'question',
          buttons: [t('playback.gallery.cancel'), t('playback.gallery.moveToTrash')],
          defaultId: 1,
          cancelId: 0,
          title: t('playback.gallery.deleteConfirmTitle'),
          message: t('playback.gallery.deleteConfirmMessage', { name: `${slide.title}.png` }),
          detail: t('playback.gallery.deleteConfirmDetail')
        })

        if (confirmed?.response !== 1) {
          return // User cancelled
        }
      }

      // Get the output path from the slide extractor
      const outputPath = slideExtractorInstance.value?.getOutputPath()
      if (!outputPath) {
        throw new Error('Output path not found')
      }

      // Move the file to in-app trash
      await window.electronAPI.slideExtraction?.moveToInAppTrash?.(outputPath, `${slide.title}.png`, {
        reason: 'manual',
        reasonDetails: 'User manually deleted slide'
      })

      // Remove from local array
      const index = extractedSlides.value.findIndex(s => s.id === slide.id)
      if (index !== -1) {
        extractedSlides.value.splice(index, 1)
      }

      // Close modal if this slide was being viewed
      if (selectedSlide.value?.id === slide.id) {
        selectedSlide.value = null
      }

      log.debug(`Slide moved to in-app trash: ${slide.title}`)
    } catch (error) {
      log.error('Failed to move slide to trash:', error)
      // Show error dialog
      const errorMessage = error instanceof Error ? error.message : String(error)
      await window.electronAPI.dialog?.showErrorBox?.(
        t('playback.gallery.trashFailedTitle'),
        t('playback.gallery.trashFailedSingle', { error: errorMessage })
      )
    }
  }

  // Clear all slides
  const clearAllSlides = async () => {
    try {
      if (extractedSlides.value.length === 0) {
        return
      }

      // Show confirmation dialog
      const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
        type: 'question',
        buttons: [t('playback.gallery.cancel'), t('playback.gallery.moveAllToTrash')],
        defaultId: 1,
        cancelId: 0,
        title: t('playback.gallery.clearAllConfirmTitle'),
        message: t('playback.gallery.clearAllConfirmMessage', { count: extractedSlides.value.length }),
        detail: t('playback.gallery.clearAllConfirmDetail')
      })

      if (confirmed?.response !== 1) {
        return // User cancelled
      }

      // Get the output path from the slide extractor
      const outputPath = slideExtractorInstance.value?.getOutputPath()
      if (!outputPath) {
        throw new Error('Output path not found')
      }

      // Move all files to in-app trash
      const deletePromises = extractedSlides.value.map(slide =>
        window.electronAPI.slideExtraction?.moveToInAppTrash?.(outputPath, `${slide.title}.png`, {
          reason: 'manual',
          reasonDetails: 'User manually deleted all slides'
        })
      )
      await Promise.all(deletePromises)

      // Clear local array
      extractedSlides.value = []

      // Close modal if open
      selectedSlide.value = null

      // Clear slides in the extractor instance
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.clearSlides()
      }

      log.debug('All slides moved to in-app trash')
    } catch (error) {
      log.error('Failed to move all slides to trash:', error)
      // Show error dialog
      const errorMessage = error instanceof Error ? error.message : String(error)
      await window.electronAPI.dialog?.showErrorBox?.(
        t('playback.gallery.trashFailedTitle'),
        t('playback.gallery.trashFailedAll', { error: errorMessage })
      )
    }
  }

  return {
    // State
    selectedSlide,

    // Methods
    openSlideModal,
    closeSlideModal,
    deleteSlide,
    clearAllSlides,
    formatSlideTime
  }
}
