import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

export interface UseYuketangReturn {
  currentPageMode: Ref<'none' | 'lesson' | 'class'>
  lessonId: Ref<string>
  isExporting: Ref<boolean>
  exportFormat: Ref<'pdf' | 'images'>
  statusMessage: Ref<string>
  latestExportDir: Ref<string>
  latestPdfPath: Ref<string>
  classCapture: Ref<{ presentationId: string; hasAuthorization: boolean }>
  canExport: ComputedRef<boolean>
  handleNavigation: (url: string) => void
  scheduleNavigationEvaluation: (url: string, delayMs?: number) => void
  startExport: () => Promise<void>
  openExportResult: () => Promise<void>
  cleanup: () => void
}

export function useYuketang(): UseYuketangReturn {
  const currentPageMode = ref<'none' | 'lesson' | 'class'>('none')
  const lessonId = ref('')
  const isExporting = ref(false)
  const exportFormat = ref<'pdf' | 'images'>('pdf')
  const statusMessage = ref('')
  const latestExportDir = ref('')
  const latestPdfPath = ref('')
  const classCapture = ref<{ presentationId: string; hasAuthorization: boolean }>({
    presentationId: '',
    hasAuthorization: false,
  })

  let navTimer: ReturnType<typeof setTimeout> | null = null
  let removeProgressListener: (() => void) | null = null
  let removeCaptureListener: (() => void) | null = null

  const hasReadyClassCapture = () => {
    return Boolean(classCapture.value.presentationId && classCapture.value.hasAuthorization)
  }

  const canExport = computed(() => {
    if (isExporting.value) return false
    if (currentPageMode.value === 'lesson') return true
    if (currentPageMode.value === 'class') return hasReadyClassCapture()
    return false
  })

  function extractLessonId(urlString: string): string | null {
    try {
      const url = new URL(urlString)
      const parts = url.pathname.split('/').filter(Boolean)
      const marker = parts.indexOf('student-lesson-report')
      if (marker === -1) return null

      const segments = parts.slice(marker + 1)
      if (segments.length >= 2 && /^\d+$/.test(segments[1])) {
        return segments[1]
      }

      const fallback = segments.find((segment) => /^\d+$/.test(segment))
      return fallback || null
    } catch {
      return null
    }
  }

  function isClassFullscreenUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString)
      return /^\/lesson\/fullscreen\/v3\/\d+\/ppt\/\d+/.test(url.pathname)
    } catch {
      return false
    }
  }

  function handleNavigation(url: string) {
    latestExportDir.value = ''

    const extracted = extractLessonId(url)
    if (extracted) {
      currentPageMode.value = 'lesson'
      lessonId.value = extracted
      statusMessage.value = 'lessonReady'
      return
    }

    if (isClassFullscreenUrl(url)) {
      currentPageMode.value = 'class'
      lessonId.value = ''
      statusMessage.value = hasReadyClassCapture() ? 'classReady' : 'classWaiting'
      return
    }

    currentPageMode.value = 'none'
    lessonId.value = ''
    statusMessage.value = 'defaultStatus'
  }

  function scheduleNavigationEvaluation(url: string, delayMs = 180) {
    if (navTimer) {
      clearTimeout(navTimer)
    }
    navTimer = setTimeout(() => {
      handleNavigation(url)
      navTimer = null
    }, delayMs)
  }

  async function startExport() {
    if (!canExport.value) return

    isExporting.value = true
    latestExportDir.value = ''
    latestPdfPath.value = ''
    statusMessage.value = 'exporting'

    try {
      const payload: {
        lessonId?: string
        format: 'pdf' | 'images'
      } = {
        format: exportFormat.value,
      }

      if (currentPageMode.value === 'lesson' && /^\d+$/.test(lessonId.value)) {
        payload.lessonId = lessonId.value
      }

      const result = await window.electronAPI.yuketang.exportLesson(payload)

      // User cancelled the save dialog
      if ('cancelled' in result && result.cancelled) {
        statusMessage.value = currentPageMode.value === 'lesson' ? 'lessonReady' : 'classReady'
        return
      }

      statusMessage.value = 'exported'
      latestExportDir.value = result.lessonDir
      if (result.pdfPath) {
        latestPdfPath.value = result.pdfPath
      }
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : String(error)
      latestExportDir.value = ''
      latestPdfPath.value = ''
    } finally {
      isExporting.value = false
    }
  }

  async function openExportResult() {
    // Open PDF if available, otherwise open folder
    const target = latestPdfPath.value || latestExportDir.value
    if (!target) return
    try {
      await window.electronAPI.yuketang.openFolder(target)
    } catch (error) {
      console.error('Failed to open export result:', error)
    }
  }

  function cleanup() {
    if (navTimer) {
      clearTimeout(navTimer)
      navTimer = null
    }
    removeProgressListener?.()
    removeCaptureListener?.()
  }

  onMounted(async () => {
    // Set up progress listener
    removeProgressListener = window.electronAPI.yuketang.onExportProgress((message: string) => {
      latestExportDir.value = ''
      statusMessage.value = message
    })

    // Set up class capture listener
    removeCaptureListener = window.electronAPI.yuketang.onClassCaptureUpdate((data: { presentationId: string; hasAuthorization: boolean }) => {
      classCapture.value = data
      // If we're on a class fullscreen page, update status
      if (currentPageMode.value === 'class') {
        statusMessage.value = hasReadyClassCapture() ? 'classReady' : 'classWaiting'
      }
    })

    // Load initial class capture state
    try {
      const capture = await window.electronAPI.yuketang.getClassCapture()
      classCapture.value = capture
    } catch {
      // Ignore errors
    }

    // Set initial status
    statusMessage.value = 'defaultStatus'
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    currentPageMode,
    lessonId,
    isExporting,
    exportFormat,
    statusMessage,
    latestExportDir,
    latestPdfPath,
    classCapture,
    canExport,
    handleNavigation,
    scheduleNavigationEvaluation,
    startExport,
    openExportResult,
    cleanup,
  }
}
