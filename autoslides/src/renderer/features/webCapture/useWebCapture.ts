import { ref, shallowRef, computed, onBeforeUnmount, type Ref, type ShallowRef } from 'vue'
import {
  slideExtractionManager,
  type SlideExtractionHandle,
  type ExtractedSlide,
} from '@shared/processing'
import { sanitizeFileName } from '@common/sanitizeFileName'
import { configStore } from '@shared/services/configStore'
import { createGuestClient, type GuestClient } from '@shared/services/guestView'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('WebCapture');

export type WebCaptureMode = 'inject' | 'capturePage'
export type WebCaptureState = 'idle' | 'confirming' | 'starting' | 'running' | 'stopping'

// One Web Capture page lives in the shell. Its work can outlast the active page.
const captureState = ref<WebCaptureState>('idle')
export const webCaptureBusy = computed(() => captureState.value !== 'idle' && captureState.value !== 'confirming')

export interface DetectedVideoInfo {
  selector: string
  width: number
  height: number
  rect: { x: number; y: number; width: number; height: number }
}

export interface CustomRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface WebCapturePreset {
  labelKey: string
  url: string
  beforeNavigate?: (guest: GuestClient) => Promise<void>
  blockSelectors?: string[]
  videoSelectors?: { urlPattern: string; selector: string }[]
}

const YANHEKT_BLOCK_SELECTORS = [
  '#root > div.app > div.sidebar-open:first-child',
  '#ai-bit-shortcut',
  'div#ai-bit-animation-modal',
]

const PRESETS: WebCapturePreset[] = [
  {
    labelKey: 'webCapture.presetYanhekt',
    url: 'https://www.yanhekt.cn',
    blockSelectors: YANHEKT_BLOCK_SELECTORS,
    videoSelectors: [
      { urlPattern: '/session', selector: '#video_id_topPlayer_html5_api' },
      { urlPattern: '/live', selector: '#video_id_mainPlayer_html5_api' },
    ],
    beforeNavigate: async (guest) => {
      const token = await window.electronAPI.config.getAuthToken()
      if (!token) return
      const expiredAt = Date.now() + 7 * 24 * 60 * 60 * 1000
      const payload = JSON.stringify({ login: true, token, expired_at: expiredAt })
      await guest.executeJavaScript(
        `try { localStorage.setItem('auth', ${JSON.stringify(payload)}); 'ok'; } catch(e) { 'err:' + e.message; }`
      )
    },
  },
]

const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^file:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function useWebCapture() {
  // Reuse one pipeline per mounted page instead of accumulating one per run
  // for the lifetime of the main renderer.
  const instanceId = `webcapture_${Date.now()}`
  const powerHolderId = `webCapture:${instanceId}`
  const lifetime = new AbortController()
  // ---- Reactive state ----
  const currentUrl = ref('')
  const pendingUrl = ref('')
  const urlDraftDirty = ref(false)
  const pageTitle = ref('')
  const courseName = ref('')
  const courseNameDirty = ref(false)
  const detectedVideo = ref<DetectedVideoInfo | null>(null)
  const userSelector = ref('')
  const customRegion = ref<CustomRegion | null>(null)
  const blockedSelectors = ref<string[]>([])
  const captureMode = ref<WebCaptureMode>('inject')
  const tickCount = ref(0)
  const savedCount = ref(0)
  const pickerActive = ref<'pick' | 'block' | null>(null)
  const regionDrawMode = ref(false)
  const statusMessage = ref('')
  const statusParams = ref<Record<string, unknown>>({})
  let activePreset: WebCapturePreset | null = null

  // Extractor + interval handles
  const extractedSlides: Ref<ExtractedSlide[]> = ref([])
  const slideExtractorInstance: ShallowRef<SlideExtractionHandle | null> = shallowRef(null)
  let captureInterval: ReturnType<typeof setInterval> | null = null
  let captureTiming: { width: number; height: number; intervalMs: number } | null = null
  const guest = createGuestClient('webCapture')
  let slideExtractedHandler: ((event: Event) => void) | null = null

  const canStart = computed(
    () =>
      captureState.value === 'idle' &&
      (!!detectedVideo.value || !!userSelector.value.trim() || !!customRegion.value)
  )

  const regionOverridesSelector = computed(() => !!customRegion.value)

  // ---- Guest events ----
  guest.on('message', ({ channel, payload }) => onGuestMessage(channel, payload))
  guest.on('page-title-updated', ({ title }) => {
    pageTitle.value = title
    if (!courseNameDirty.value) courseName.value = title
  })
  guest.on('did-finish-load', () => onDidFinishLoad())

  const onDidNavigate = ({ url }: { url: string }) => {
    if (url) {
      // The address box follows the page unless the student is typing in it.
      if (!urlDraftDirty.value || pendingUrl.value === currentUrl.value) {
        pendingUrl.value = url
        urlDraftDirty.value = false
      }
      currentUrl.value = url
    }
    // Reset per-session picker + region state on cross-origin navigation.
    if (captureState.value !== 'running') {
      detectedVideo.value = null
      customRegion.value = null
    }
    // Apply preset rules on each navigation within the preset's origin.
    if (activePreset && url) {
      applyPresetRules(url)
    }
  }
  guest.on('did-navigate', onDidNavigate)
  guest.on('did-fail-load', () => {
    if (captureState.value === 'running') return
    statusMessage.value = 'webCapture.loadFailed'
    statusParams.value = {}
  })
  guest.on('did-navigate-in-page', onDidNavigate)

  const applyPresetRules = (url: string) => {
    if (!activePreset) return
    // Inject blocking CSS via the guest preload.
    if (activePreset.blockSelectors?.length) {
      const css = activePreset.blockSelectors
        .map((s) => `${s} { display: none !important; }`)
        .join('\n')
      guest.executeJavaScript(
        `(() => { let s = document.getElementById('__autoslides_preset_block'); if (!s) { s = document.createElement('style'); s.id = '__autoslides_preset_block'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(css)}; })()`
      ).catch(() => {/* page may not be ready yet */})
    }
    // Auto-select video selector based on URL pattern.
    if (activePreset.videoSelectors?.length && !courseNameDirty.value) {
      const match = activePreset.videoSelectors.find((vs) => url.includes(vs.urlPattern))
      if (match) {
        userSelector.value = match.selector
      }
    }
  }

  const onDidFinishLoad = () => {
    // Re-apply block rules after DOM is fully loaded (did-navigate fires too early for CSS injection).
    if (activePreset && currentUrl.value) {
      applyPresetRules(currentUrl.value)
    }
  }

  // ---- Navigation ----
  const navigate = (raw?: string) => {
    const target = normalizeUrl(raw ?? pendingUrl.value)
    if (!target) return
    currentUrl.value = target
    pendingUrl.value = target
    urlDraftDirty.value = false
    guest.loadURL(target).catch((err) => log.debug('Navigation refused:', err))
  }

  const navigatePreset = async (preset: WebCapturePreset) => {
    urlDraftDirty.value = false
    activePreset = preset
    const origin = new URL(preset.url).origin
    currentUrl.value = origin
    const stopped = guest.once('did-stop-loading')
    await guest.loadURL(origin)
    await stopped
    if (preset.beforeNavigate) {
      await preset.beforeNavigate(guest)
    }
    pendingUrl.value = preset.url
    currentUrl.value = preset.url
    await guest.loadURL(preset.url)
  }

  const goBack = () => { void guest.goBack() }
  const goForward = () => { void guest.goForward() }
  const reload = () => { void guest.reload() }

  // ---- Guest → host IPC routing ----
  const onGuestMessage = (channel: string, rawPayload: unknown) => {
    const payload = rawPayload as Record<string, unknown> | undefined
    switch (channel) {
      case 'video:detected': {
        detectedVideo.value = payload as unknown as DetectedVideoInfo
        break
      }
      case 'video:none': {
        detectedVideo.value = null
        break
      }
      case 'frame': {
        handleFrameFromGuest(payload as { width: number; height: number; buffer: ArrayBuffer })
        break
      }
      case 'capture:tainted': {
        fallBackToPageCapture('webCapture.captureModeSwitched')
        break
      }
      case 'capture:noVideo': {
        fallBackToPageCapture('webCapture.noVideoFallback')
        break
      }
      case 'picker:result': {
        pickerActive.value = null
        userSelector.value = (payload as { selector: string })?.selector ?? ''
        break
      }
      case 'picker:cancel': {
        pickerActive.value = null
        break
      }
      case 'blocker:result': {
        pickerActive.value = null
        const sel = (payload as { selector: string })?.selector
        if (sel) blockedSelectors.value = [...blockedSelectors.value, sel]
        break
      }
      case 'blocker:cancel': {
        pickerActive.value = null
        break
      }
    }
  }

  const handleFrameFromGuest = async (payload: {
    width: number
    height: number
    buffer: ArrayBuffer
  }) => {
    if (!slideExtractorInstance.value) return
    if (!payload?.buffer || !payload.width || !payload.height) return
    const bytes = new Uint8ClampedArray(payload.buffer)
    const expected = payload.width * payload.height * 4
    if (bytes.length !== expected) return
    const imageData = new ImageData(bytes, payload.width, payload.height)
    await slideExtractorInstance.value.pushFrame(imageData)
    tickCount.value += 1
  }

  // ---- Picker / blocker / region ----
  const pickVideoSelector = () => {
    pickerActive.value = 'pick'
    void guest.send('picker:start')
  }
  const startBlocker = () => {
    pickerActive.value = 'block'
    void guest.send('blocker:start')
  }
  const cancelPicker = () => {
    if (pickerActive.value === 'pick') void guest.send('picker:cancel')
    else if (pickerActive.value === 'block') void guest.send('blocker:cancel')
    pickerActive.value = null
  }
  const clearBlocks = () => {
    void guest.send('blocker:clear')
    blockedSelectors.value = []
  }
  const setRegion = (region: CustomRegion | null) => {
    customRegion.value = region
    regionDrawMode.value = false
    if (region) captureMode.value = 'capturePage'
  }
  const clearRegion = () => {
    customRegion.value = null
    if (detectedVideo.value || userSelector.value.trim()) {
      captureMode.value = 'inject'
    }
  }

  // ---- Start / stop ----
  const requestStart = () => {
    if (!canStart.value) return
    captureState.value = 'confirming'
  }

  const cancelStart = () => {
    if (captureState.value === 'confirming') captureState.value = 'idle'
  }

  const confirmAndStart = async () => {
    if (captureState.value !== 'confirming') return
    captureState.value = 'starting'
    // Reset capture mode: region forces capturePage, otherwise default to inject.
    captureMode.value = customRegion.value ? 'capturePage' : 'inject'
    const name = courseName.value.trim() || pageTitle.value.trim() || 'Untitled'
    try {
      const appConfig = configStore
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
      if (lifetime.signal.aborted) return
      const outputDir = appConfig.outputDirectory || '~/Downloads/AutoSlides'
      const folder = `${outputDir}/slides_${sanitizeFileName(name)}`
      await window.electronAPI.slideExtraction.ensureDirectory(folder)
      if (lifetime.signal.aborted) return
      extractedSlides.value = []
      tickCount.value = 0
      savedCount.value = 0

      const extractor = await slideExtractionManager.run({
        mode: 'live',
        instanceId,
        sourceMode: 'pushed',
        outputPath: folder,
        courseInfo: { courseName: name, mode: 'live' },
      }, { signal: lifetime.signal })
      if (lifetime.signal.aborted) return
      if (!extractor) throw new Error('Failed to start pushed extraction')
      slideExtractorInstance.value = extractor

      // The pipeline has finished draining the previous run before this point.
      slideExtractedHandler = (event: Event) => {
        const detail = (event as CustomEvent).detail as {
          instanceId: string
          slide: ExtractedSlide
        }
        if (detail?.instanceId !== instanceId) return
        savedCount.value += 1
        extractedSlides.value = [...extractedSlides.value, detail.slide]
      }
      window.addEventListener('slideExtracted', slideExtractedHandler)

      try {
        await window.electronAPI.powerManagement.preventSleep(powerHolderId)
      } catch {
        // non-fatal
      }

      if (lifetime.signal.aborted) {
        await releasePowerHolder()
        return
      }

      const downsampleW = slideConfig?.downsampleWidth || 480
      const downsampleH = slideConfig?.downsampleHeight || 270
      const intervalMs = slideConfig?.checkInterval || 2000

      captureTiming = { width: downsampleW, height: downsampleH, intervalMs }
      if (captureMode.value === 'inject') {
        const selectorToUse = userSelector.value.trim() || detectedVideo.value?.selector || ''
        await guest.send('capture:start', {
          selector: selectorToUse,
          downsampleW,
          downsampleH,
        })
        if (lifetime.signal.aborted) return
        // The guest may already have reported that it cannot capture.
        if (captureMode.value === 'inject') {
          captureInterval = setInterval(() => { void guest.send('capture:tick') }, intervalMs)
        }
      } else {
        captureInterval = setInterval(() => { void capturePageTick(downsampleW, downsampleH) }, intervalMs)
      }

      captureState.value = 'running'
      statusMessage.value = 'webCapture.capturingStatus'
      statusParams.value = { mode: captureMode.value === 'inject' ? 'webCapture.modeVideo' : 'webCapture.modePage' }
    } catch (err) {
      clearCapture()
      await releasePowerHolder()
      if (lifetime.signal.aborted) return
      log.error('Failed to start web capture:', err)
      statusMessage.value = `Failed to start: ${(err as Error).message}`
      statusParams.value = {}
      captureState.value = 'idle'
    }
  }

  /** One switch: the mode, the loop that runs and the status change together. */
  const fallBackToPageCapture = (status: string) => {
    if (captureMode.value !== 'inject' || !captureTiming) return
    if (captureState.value !== 'running' && captureState.value !== 'starting') return
    captureMode.value = 'capturePage'
    void guest.send('capture:stop').catch((err) => log.debug('Capture guest closed before stop:', err))
    if (captureInterval) clearInterval(captureInterval)
    const { width, height, intervalMs } = captureTiming
    captureInterval = setInterval(() => { void capturePageTick(width, height) }, intervalMs)
    statusMessage.value = status
    statusParams.value = {}
  }

  const capturePageTick = async (targetW: number, targetH: number) => {
    const extractor = slideExtractorInstance.value
    const interval = captureInterval
    if (!extractor) return
    try {
      // Spread to plain object — a Vue Proxy can't be structured-cloned across IPC.
      const rect = customRegion.value
        ? { x: customRegion.value.x, y: customRegion.value.y, width: customRegion.value.width, height: customRegion.value.height }
        : undefined
      const dataUrl = await guest.capturePage(rect)
      if (!dataUrl) return
      const imageData = await dataUrlToImageData(dataUrl, targetW, targetH)
      if (!imageData || interval !== captureInterval) return
      await extractor.pushFrame(imageData)
      if (interval === captureInterval) tickCount.value += 1
    } catch (err) {
      log.error('capturePage tick failed:', err)
    }
  }

  const dataUrlToImageData = (
    dataUrl: string,
    targetW: number,
    targetH: number
  ): Promise<ImageData | null> =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, targetW, targetH)
        try {
          resolve(ctx.getImageData(0, 0, targetW, targetH))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    })

  const clearCapture = () => {
    captureTiming = null
    if (captureInterval) {
      clearInterval(captureInterval)
      captureInterval = null
    }
    slideExtractorInstance.value?.stop()
    slideExtractorInstance.value = null
    if (slideExtractedHandler) {
      window.removeEventListener('slideExtracted', slideExtractedHandler)
      slideExtractedHandler = null
    }
  }

  const releasePowerHolder = async () => {
    try {
      await window.electronAPI.powerManagement.allowSleep(powerHolderId)
    } catch {
      // non-fatal
    }
  }

  const stopCapture = async () => {
    if (captureState.value !== 'running') return
    captureState.value = 'stopping'
    clearCapture()
    try {
      await guest.send('capture:stop')
    } catch (err) {
      log.debug('Capture guest closed before stop:', err)
    } finally {
      await releasePowerHolder()
    }
    if (lifetime.signal.aborted) return
    captureState.value = 'idle'
    statusMessage.value = 'webCapture.stoppedStatus'
    statusParams.value = { n: savedCount.value }
  }

  onBeforeUnmount(() => {
    lifetime.abort()
    if (captureState.value === 'running') void stopCapture()
    else if (captureState.value === 'starting') void releasePowerHolder()
    clearCapture()
    slideExtractionManager.remove(instanceId)
    guest.dispose()
    captureState.value = 'idle'
  })

  // ---- Public setters used by template ----
  const onCourseNameInput = (value: string) => {
    courseName.value = value
    courseNameDirty.value = value !== pageTitle.value
  }
  const onUserSelectorInput = (value: string) => {
    userSelector.value = value
  }
  const beginRegionDraw = () => {
    regionDrawMode.value = true
  }
  const cancelRegionDraw = () => {
    regionDrawMode.value = false
  }

  return {
    // State
    currentUrl,
    pendingUrl,
    urlDraftDirty,
    pageTitle,
    courseName,
    detectedVideo,
    userSelector,
    customRegion,
    blockedSelectors,
    captureState,
    captureMode,
    tickCount,
    savedCount,
    pickerActive,
    regionDrawMode,
    statusMessage,
    statusParams,
    canStart,
    regionOverridesSelector,

    // Embedded page
    guest,

    // Navigation
    presets: PRESETS,
    navigate,
    navigatePreset,
    goBack,
    goForward,
    reload,

    // Picker / blocker / region
    pickVideoSelector,
    startBlocker,
    cancelPicker,
    clearBlocks,
    setRegion,
    clearRegion,
    beginRegionDraw,
    cancelRegionDraw,

    // Capture lifecycle
    requestStart,
    cancelStart,
    confirmAndStart,
    stopCapture,

    // Template helpers
    onCourseNameInput,
    onUserSelectorInput,
  }
}
