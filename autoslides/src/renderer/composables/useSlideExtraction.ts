import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { slideExtractionManager, type SlideExtractor, type ExtractedSlide } from '../services/slideExtractor'
import { ssimThresholdService } from '../services/ssimThresholdService'

// Types for slide extraction
export interface SlideExtractionStatus {
  isRunning: boolean
  slideCount: number
  verificationState: string
  currentVerification: number
}

export interface Course {
  id: string
  title: string
  instructor: string
  time: string
  status?: number
  subtitle?: string
  schedule_started_at?: string
  schedule_ended_at?: string
  participant_count?: number
  session?: {
    professor?: {
      name: string
    }
    section_group_title?: string
  }
  target?: string // Camera stream URL
  target_vga?: string // Screen stream URL
  // Record mode specific fields
  professors?: string[]
  classrooms?: { name: string }[]
  school_year?: string
  semester?: string
  college_name?: string
}

export interface Session {
  id: string
  session_id: string
  video_id: string
  title: string
  duration: number
  week_number: number
  day: number
  started_at: string
  ended_at: string
  main_url?: string
  vga_url?: string
}

export interface UseSlideExtractionOptions {
  mode: 'live' | 'recorded'
  course: Ref<Course | null>
  session: Ref<Session | null>
  currentPlaybackRate: Ref<number>
}

export interface UseSlideExtractionReturn {
  // State
  isSlideExtractionEnabled: Ref<boolean>
  slideExtractionStatus: Ref<SlideExtractionStatus>
  slideExtractorInstance: ShallowRef<SlideExtractor | null>
  extractorInstanceId: Ref<string | null>
  extractedSlides: Ref<ExtractedSlide[]>

  // Methods
  toggleSlideExtraction: () => Promise<void>
  initializeSlideExtraction: () => Promise<void>
  updateSlideExtractionStatus: () => void
  updateSSIMThresholdForClassrooms: () => void
  sanitizeFileName: (name: string) => string
  onSlideExtracted: (event: CustomEvent) => Promise<void>
  onSlidesCleared: (event: CustomEvent) => void
  cleanupSlideExtraction: () => void
  setupEventListeners: () => void
  removeEventListeners: () => void
}

export function useSlideExtraction(options: UseSlideExtractionOptions) {
  const { mode, course, session, currentPlaybackRate } = options

  // State
  const isSlideExtractionEnabled = ref(false)
  const slideExtractionStatus = ref<SlideExtractionStatus>({
    isRunning: false,
    slideCount: 0,
    verificationState: 'none',
    currentVerification: 0
  })
  const slideExtractorInstance = shallowRef<SlideExtractor | null>(null)
  const extractorInstanceId = ref<string | null>(null)
  const extractedSlides = ref<ExtractedSlide[]>([])

  // Event handlers stored for cleanup
  let slideExtractedHandler: ((event: CustomEvent) => Promise<void>) | null = null
  let slidesClearedHandler: ((event: CustomEvent) => void) | null = null

  // Sanitize filename by removing special characters
  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim()
  }

  // Update SSIM threshold based on classroom information
  const updateSSIMThresholdForClassrooms = () => {
    try {
      const classrooms = course.value?.classrooms

      if (classrooms && classrooms.length > 0) {
        console.log('Setting classroom context for SSIM threshold:', classrooms.map(c => c.name).join(', '))
        ssimThresholdService.setCurrentClassrooms(classrooms)
      } else {
        console.log('No classroom information available, clearing SSIM classroom context')
        ssimThresholdService.setCurrentClassrooms(null)
      }
    } catch (error) {
      console.error('Failed to update SSIM threshold for classrooms:', error)
    }
  }

  // Initialize slide extraction with course/session context
  const initializeSlideExtraction = async () => {
    try {
      // Update SSIM threshold based on classroom information before starting extraction
      updateSSIMThresholdForClassrooms()

      // Get output directory from config
      const config = await window.electronAPI.config.get()
      const outputDir = config.outputDirectory || '~/Downloads/AutoSlides'

      // Create folder name based on course and session info
      let folderName = 'slides'

      if (course.value?.title) {
        folderName += `_${sanitizeFileName(course.value.title)}`
      }

      if (session.value?.title) {
        folderName += `_${sanitizeFileName(session.value.title)}`
      } else if (course.value?.session?.section_group_title && mode === 'live') {
        folderName += `_${sanitizeFileName(course.value.session.section_group_title)}`
      }

      // Set up slide extraction output directory
      const slideOutputPath = `${outputDir}/${folderName}`

      // Prepare course info for slide extractor
      const courseInfo = {
        courseName: course.value?.title,
        sessionTitle: session.value?.title || course.value?.session?.section_group_title,
        mode: mode
      }

      // Ensure the output directory exists
      await window.electronAPI.slideExtraction.ensureDirectory(slideOutputPath)

      // Store the output path and course info for later use when saving slides
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.setOutputPath(slideOutputPath, courseInfo)
      }

    } catch (error) {
      console.error('Failed to initialize slide extraction:', error)
      throw error
    }
  }

  // Toggle slide extraction
  const toggleSlideExtraction = async () => {
    if (isSlideExtractionEnabled.value) {
      try {
        // Get or create extractor instance for this mode
        const instanceId = `${mode}_${course.value?.id || 'unknown'}_${Date.now()}`
        slideExtractorInstance.value = slideExtractionManager.getExtractor(mode, instanceId)
        extractorInstanceId.value = instanceId

        // Initialize slide extraction with current course/session info
        await initializeSlideExtraction()

        // Sync with current playback rate before starting extraction
        slideExtractorInstance.value.updatePlaybackRate(Number(currentPlaybackRate.value))

        // Start the extraction process
        const success = slideExtractorInstance.value.startExtraction()
        if (!success) {
          isSlideExtractionEnabled.value = false
          return
        }

        // Update status
        updateSlideExtractionStatus()
      } catch (error) {
        console.error('Failed to start slide extraction:', error)
        isSlideExtractionEnabled.value = false
      }
    } else {
      // Stop slide extraction
      if (slideExtractorInstance.value) {
        slideExtractorInstance.value.stopExtraction()
        slideExtractionStatus.value.isRunning = false
      }
    }
  }

  // Update slide extraction status
  const updateSlideExtractionStatus = () => {
    if (slideExtractorInstance.value) {
      const status = slideExtractorInstance.value.getStatus()
      slideExtractionStatus.value = {
        isRunning: status.isRunning,
        slideCount: status.slideCount,
        verificationState: status.verificationState,
        currentVerification: status.currentVerification
      }
    }
  }

  // Handle slide extracted event
  const onSlideExtracted = async (event: CustomEvent) => {
    const { slide, instanceId, mode: eventMode } = event.detail
    // Only handle events from our instance
    if (instanceId === extractorInstanceId.value && eventMode === mode) {
      extractedSlides.value.push(slide)
      updateSlideExtractionStatus()
    }
  }

  // Handle slides cleared event
  const onSlidesCleared = (event: CustomEvent) => {
    const { instanceId, mode: eventMode } = event.detail
    // Only handle events from our instance
    if (instanceId === extractorInstanceId.value && eventMode === mode) {
      extractedSlides.value = []
      updateSlideExtractionStatus()
    }
  }

  // Setup event listeners
  const setupEventListeners = () => {
    slideExtractedHandler = onSlideExtracted
    slidesClearedHandler = onSlidesCleared
    window.addEventListener('slideExtracted', slideExtractedHandler as unknown as EventListener)
    window.addEventListener('slidesCleared', slidesClearedHandler as EventListener)
  }

  // Remove event listeners
  const removeEventListeners = () => {
    if (slideExtractedHandler) {
      window.removeEventListener('slideExtracted', slideExtractedHandler as unknown as EventListener)
    }
    if (slidesClearedHandler) {
      window.removeEventListener('slidesCleared', slidesClearedHandler as EventListener)
    }
  }

  // Cleanup slide extraction
  const cleanupSlideExtraction = () => {
    // Stop slide extraction if running
    if (isSlideExtractionEnabled.value && slideExtractorInstance.value) {
      slideExtractorInstance.value.stopExtraction()
    }

    // Clean up extractor instance if it was created specifically for this component
    if (extractorInstanceId.value) {
      slideExtractionManager.removeExtractor(extractorInstanceId.value)
    }

    // Remove event listeners
    removeEventListeners()
  }

  return {
    // State
    isSlideExtractionEnabled,
    slideExtractionStatus,
    slideExtractorInstance,
    extractorInstanceId,
    extractedSlides,

    // Methods
    toggleSlideExtraction,
    initializeSlideExtraction,
    updateSlideExtractionStatus,
    updateSSIMThresholdForClassrooms,
    sanitizeFileName,
    onSlideExtracted,
    onSlidesCleared,
    cleanupSlideExtraction,
    setupEventListeners,
    removeEventListeners
  }
}
