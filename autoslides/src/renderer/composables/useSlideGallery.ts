import { ref, type Ref, type ShallowRef } from 'vue'
import type { ExtractedSlide, SlideExtractor } from '../services/slideExtractor'

export interface UseSlideGalleryOptions {
  extractedSlides: Ref<ExtractedSlide[]>
  slideExtractorInstance: ShallowRef<SlideExtractor | null>
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
  const { extractedSlides, slideExtractorInstance } = options

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
          buttons: ['Cancel', 'Move to Trash'],
          defaultId: 1,
          cancelId: 0,
          title: 'Delete Slide',
          message: `Are you sure you want to delete "${slide.title}.png"?`,
          detail: 'The file will be moved to the in-app trash and can be restored if needed.'
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

      console.log(`Slide moved to in-app trash: ${slide.title}`)
    } catch (error) {
      console.error('Failed to move slide to trash:', error)
      // Show error dialog
      const errorMessage = error instanceof Error ? error.message : String(error)
      await window.electronAPI.dialog?.showErrorBox?.('Move to Trash Failed', `Failed to move slide to trash: ${errorMessage}`)
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
        buttons: ['Cancel', 'Move All to Trash'],
        defaultId: 1,
        cancelId: 0,
        title: 'Delete All Slides',
        message: `Are you sure you want to delete all ${extractedSlides.value.length} slide(s)?`,
        detail: 'All slide files will be moved to the in-app trash and can be restored if needed.'
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

      console.log('All slides moved to in-app trash')
    } catch (error) {
      console.error('Failed to move all slides to trash:', error)
      // Show error dialog
      const errorMessage = error instanceof Error ? error.message : String(error)
      await window.electronAPI.dialog?.showErrorBox?.('Move to Trash Failed', `Failed to move slides to trash: ${errorMessage}`)
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
