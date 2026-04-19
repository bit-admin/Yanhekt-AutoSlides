import { ref, shallowRef, computed, onBeforeUnmount, onMounted, type Ref, type ShallowRef } from 'vue'
import {
  SlideExtractor,
  slideExtractionManager,
  type ExtractedSlide,
} from '../services/slideExtractor'
import { usePostProcessing } from './usePostProcessing'

export type WebCaptureMode = 'inject' | 'capturePage'
export type WebCaptureState = 'idle' | 'confirming' | 'running'

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

type WebviewTag = Electron.WebviewTag & {
  send: (channel: string, ...args: unknown[]) => void
  capturePage: (rect?: CustomRegion) => Promise<Electron.NativeImage>
  executeJavaScript: (code: string) => Promise<unknown>
}

export interface WebCapturePreset {
  label: string
  url: string
  beforeNavigate?: (webview: WebviewTag) => Promise<void>
}

const PRESETS: WebCapturePreset[] = [
  {
    label: 'YanHeKT',
    url: 'https://www.yanhekt.cn',
    beforeNavigate: async (webview) => {
      const token = await window.electronAPI.config.getAuthToken()
      console.log('[WebCapture] YanHeKT preset – token:', token ? `${token.slice(0, 6)}...` : 'null')
      if (!token) return
      const expiredAt = Date.now() + 7 * 24 * 60 * 60 * 1000
      const payload = JSON.stringify({ login: true, token, expired_at: expiredAt })
      console.log('[WebCapture] Injecting auth localStorage, payload length:', payload.length)
      const result = await webview.executeJavaScript(
        `try { localStorage.setItem('auth', ${JSON.stringify(payload)}); 'ok:' + localStorage.getItem('auth'); } catch(e) { 'err:' + e.message; }`
      )
      console.log('[WebCapture] executeJavaScript result:', result)
    },
  },
]

const sanitizeFileName = (name: string): string =>
  name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').replace(/_{2,}/g, '_').trim()

const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^file:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function useWebCapture() {
  // ---- Reactive state ----
  const preloadPath = ref<string>('')
  const currentUrl = ref('')
  const pendingUrl = ref('')
  const pageTitle = ref('')
  const courseName = ref('')
  const courseNameDirty = ref(false)
  const detectedVideo = ref<DetectedVideoInfo | null>(null)
  const userSelector = ref('')
  const customRegion = ref<CustomRegion | null>(null)
  const blockedSelectors = ref<string[]>([])
  const captureState = ref<WebCaptureState>('idle')
  const captureMode = ref<WebCaptureMode>('inject')
  const tickCount = ref(0)
  const savedCount = ref(0)
  const pickerActive = ref<'pick' | 'block' | null>(null)
  const regionDrawMode = ref(false)
  const statusMessage = ref('')

  // Extractor + interval handles
  const extractedSlides: Ref<ExtractedSlide[]> = ref([])
  const slideExtractorInstance: ShallowRef<SlideExtractor | null> = shallowRef(null)
  let captureInterval: ReturnType<typeof setInterval> | null = null
  let webviewRef: WebviewTag | null = null
  let slideExtractedHandler: ((event: Event) => void) | null = null

  const postProcessing = usePostProcessing({
    mode: 'live',
    extractedSlides,
    slideExtractorInstance,
  })

  const canStart = computed(
    () =>
      captureState.value === 'idle' &&
      (!!detectedVideo.value || !!userSelector.value.trim() || !!customRegion.value)
  )

  // ---- Preload path bootstrap ----
  onMounted(async () => {
    try {
      preloadPath.value = await window.electronAPI.webCapture.getGuestPreloadPath()
    } catch (err) {
      console.error('Failed to resolve guest preload path:', err)
    }
  })

  // ---- Webview binding ----
  const attachWebview = (el: WebviewTag | null) => {
    if (webviewRef === el) return
    if (webviewRef) detachWebview()
    webviewRef = el
    if (!el) return
    el.addEventListener('ipc-message', onIpcMessage as EventListener)
    el.addEventListener('page-title-updated', onPageTitleUpdated as EventListener)
    el.addEventListener('did-navigate', onDidNavigate as EventListener)
    el.addEventListener('did-navigate-in-page', onDidNavigate as EventListener)
    el.addEventListener('new-window', onNewWindow as EventListener)
  }

  const detachWebview = () => {
    if (!webviewRef) return
    webviewRef.removeEventListener('ipc-message', onIpcMessage as EventListener)
    webviewRef.removeEventListener('page-title-updated', onPageTitleUpdated as EventListener)
    webviewRef.removeEventListener('did-navigate', onDidNavigate as EventListener)
    webviewRef.removeEventListener('did-navigate-in-page', onDidNavigate as EventListener)
    webviewRef.removeEventListener('new-window', onNewWindow as EventListener)
    webviewRef = null
  }

  const onPageTitleUpdated = (event: Event) => {
    const title = (event as Event & { title: string }).title || ''
    pageTitle.value = title
    if (!courseNameDirty.value) {
      courseName.value = title
    }
  }

  const onDidNavigate = (event: Event) => {
    const url = (event as Event & { url: string }).url
    if (url) currentUrl.value = url
    // Reset per-session picker + region state on cross-origin navigation.
    if (captureState.value !== 'running') {
      detectedVideo.value = null
      customRegion.value = null
    }
  }

  // Fallback for <webview> new-window (main process also handles via setWindowOpenHandler).
  const onNewWindow = (event: Event) => {
    event.preventDefault()
    const url = (event as Event & { url: string }).url
    if (url && webviewRef) webviewRef.loadURL(url)
  }

  // ---- Navigation ----
  const navigate = (raw?: string) => {
    const target = normalizeUrl(raw ?? pendingUrl.value)
    if (!target) return
    currentUrl.value = target
    try {
      webviewRef?.loadURL?.(target)
    } catch {
      // Webview may not yet be fully mounted; :src binding will pick this up.
    }
  }

  const navigatePreset = async (preset: WebCapturePreset) => {
    if (!webviewRef) return
    const origin = new URL(preset.url).origin
    console.log('[WebCapture] navigatePreset: loading origin', origin)
    currentUrl.value = origin
    webviewRef.loadURL(origin)
    await new Promise<void>((resolve) => {
      const onStop = () => {
        webviewRef?.removeEventListener('did-stop-loading', onStop)
        console.log('[WebCapture] navigatePreset: origin loaded, URL now:', webviewRef?.getURL?.())
        resolve()
      }
      webviewRef!.addEventListener('did-stop-loading', onStop)
    })
    if (preset.beforeNavigate) {
      await preset.beforeNavigate(webviewRef)
    }
    console.log('[WebCapture] navigatePreset: navigating to final URL', preset.url)
    pendingUrl.value = preset.url
    currentUrl.value = preset.url
    webviewRef.loadURL(preset.url)
  }

  const goBack = () => {
    if (webviewRef?.canGoBack?.()) webviewRef.goBack()
  }
  const goForward = () => {
    if (webviewRef?.canGoForward?.()) webviewRef.goForward()
  }
  const reload = () => webviewRef?.reload?.()

  // ---- Guest → host IPC routing ----
  const onIpcMessage = (event: Event) => {
    const { channel, args } = event as Event & { channel: string; args: unknown[] }
    const payload = args?.[0] as Record<string, unknown> | undefined
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
        statusMessage.value = 'Inject capture blocked by cross-origin media; switching to capturePage'
        captureMode.value = 'capturePage'
        break
      }
      case 'capture:noVideo': {
        if (captureMode.value === 'inject') {
          captureMode.value = 'capturePage'
          statusMessage.value = 'No <video> found; switching to capturePage'
        }
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
    if (!webviewRef) return
    pickerActive.value = 'pick'
    webviewRef.send('picker:start')
  }
  const startBlocker = () => {
    if (!webviewRef) return
    pickerActive.value = 'block'
    webviewRef.send('blocker:start')
  }
  const cancelPicker = () => {
    if (!webviewRef) return
    if (pickerActive.value === 'pick') webviewRef.send('picker:cancel')
    else if (pickerActive.value === 'block') webviewRef.send('blocker:cancel')
    pickerActive.value = null
  }
  const clearBlocks = () => {
    if (!webviewRef) return
    webviewRef.send('blocker:clear')
    blockedSelectors.value = []
  }
  const setRegion = (region: CustomRegion | null) => {
    customRegion.value = region
    regionDrawMode.value = false
    if (region) captureMode.value = 'capturePage'
  }
  const clearRegion = () => {
    customRegion.value = null
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
    if (captureState.value !== 'confirming' || !webviewRef) return
    const name = courseName.value.trim() || pageTitle.value.trim() || 'Untitled'
    try {
      const appConfig = await window.electronAPI.config.get()
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
      const outputDir = appConfig.outputDirectory || '~/Downloads/AutoSlides'
      const folder = `${outputDir}/slides_${sanitizeFileName(name)}`
      await window.electronAPI.slideExtraction.ensureDirectory(folder)

      const instanceId = `webcapture_${Date.now()}`
      const extractor = slideExtractionManager.getExtractor('live', instanceId)
      extractor.setOutputPath(folder, { courseName: name, mode: 'live' })
      slideExtractorInstance.value = extractor
      extractedSlides.value = []
      tickCount.value = 0
      savedCount.value = 0

      // Listen for saves to update counter.
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

      const started = extractor.startPushedExtraction()
      if (!started) throw new Error('Failed to start pushed extraction')

      try {
        await window.electronAPI.powerManagement.preventSleep()
      } catch {
        // non-fatal
      }

      const downsampleW = slideConfig?.downsampleWidth || 480
      const downsampleH = slideConfig?.downsampleHeight || 270
      const intervalMs = slideConfig?.checkInterval || 2000

      if (captureMode.value === 'inject') {
        const selectorToUse = userSelector.value.trim() || detectedVideo.value?.selector || ''
        webviewRef.send('capture:start', {
          selector: selectorToUse,
          downsampleW,
          downsampleH,
        })
        captureInterval = setInterval(() => {
          webviewRef?.send('capture:tick')
        }, intervalMs)
      } else {
        captureInterval = setInterval(() => {
          void capturePageTick(downsampleW, downsampleH)
        }, intervalMs)
      }

      captureState.value = 'running'
      statusMessage.value = `Capturing (${captureMode.value})`
    } catch (err) {
      console.error('Failed to start web capture:', err)
      statusMessage.value = `Failed to start: ${(err as Error).message}`
      captureState.value = 'idle'
    }
  }

  const capturePageTick = async (targetW: number, targetH: number) => {
    if (!webviewRef || !slideExtractorInstance.value) return
    try {
      const rect = customRegion.value ?? undefined
      const image = await webviewRef.capturePage(rect)
      if (!image || image.isEmpty()) return
      const size = image.getSize()
      if (!size.width || !size.height) return
      const dataUrl = image.toDataURL()
      const imageData = await dataUrlToImageData(dataUrl, targetW, targetH)
      if (!imageData) return
      await slideExtractorInstance.value.pushFrame(imageData)
      tickCount.value += 1
    } catch (err) {
      console.error('capturePage tick failed:', err)
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

  const stopCapture = async () => {
    if (captureInterval) {
      clearInterval(captureInterval)
      captureInterval = null
    }
    if (webviewRef) webviewRef.send('capture:stop')
    const extractor = slideExtractorInstance.value
    if (extractor) extractor.stopExtraction()
    if (slideExtractedHandler) {
      window.removeEventListener('slideExtracted', slideExtractedHandler)
      slideExtractedHandler = null
    }
    try {
      await window.electronAPI.powerManagement.allowSleep()
    } catch {
      // non-fatal
    }
    captureState.value = 'idle'
    statusMessage.value = `Stopped. Saved ${savedCount.value} slide(s).`

    try {
      const liveAutoEnabled = await window.electronAPI.config.getAutoPostProcessingLive()
      if (liveAutoEnabled && extractedSlides.value.length > 0) {
        await postProcessing.executePostProcessing(false)
      }
    } catch (err) {
      console.error('Auto post-processing failed:', err)
    }
  }

  // ---- Teardown ----
  onBeforeUnmount(() => {
    if (captureState.value === 'running') {
      void stopCapture()
    }
    if (slideExtractedHandler) {
      window.removeEventListener('slideExtracted', slideExtractedHandler)
      slideExtractedHandler = null
    }
    detachWebview()
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
    preloadPath,
    currentUrl,
    pendingUrl,
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
    canStart,

    // Webview wiring
    attachWebview,

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
