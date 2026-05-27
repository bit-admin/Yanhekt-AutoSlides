import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type Preset = 'tiny' | 'small' | 'readable'
type AudioPreset = 'low' | 'mid' | 'high' | 'max'
type AudioFilterPreset = 'none' | 'clean' | 'speech' | 'strong' | 'loudnorm'
type CropMode = 'none' | '4:3' | 'auto'
type FilterMode = 'none' | 'denoise' | 'sharpen' | 'both'
type Scaler = 'lanczos' | 'bicubic'
type Container = 'mp4' | 'mkv'
type OpusVbr = 'on' | 'constrained' | 'off'

type UiStatus = 'idle' | 'previewing' | 'running' | 'completed' | 'cancelled' | 'error'

type CompressLectureOptions = {
  inputPath: string
  outputPath?: string
  preset?: Preset
  audioPreset?: AudioPreset
  audioFilterPreset?: AudioFilterPreset
  cropMode?: CropMode
  filterMode?: FilterMode
  scaler?: Scaler
  container?: Container
  opusVbr?: OpusVbr
  opusFrameDuration?: 20 | 40 | 60
  keepAac?: boolean
  x265Params?: string
}

type CompressLectureProgress = {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'completed'
  current: number
  total: number
  message?: string
}

type CompressLecturePreviewResult = {
  command: string
  outputPath: string
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  contentAspect: '4:3' | '16:9' | 'cropped' | 'source'
  videoFiltergraph: string
  audioFiltergraph: string
}

const buildDefaultValues = () => ({
  preset: 'tiny' as Preset,
  audioPreset: 'mid' as AudioPreset,
  audioFilterPreset: 'speech' as AudioFilterPreset,
  cropMode: 'none' as CropMode,
  filterMode: 'none' as FilterMode,
  scaler: 'lanczos' as Scaler,
  container: 'mp4' as Container,
  opusVbr: 'constrained' as OpusVbr,
  opusFrameDuration: 60 as 20 | 40 | 60,
  keepAac: false,
  x265Params: 'aq-mode=1'
})

const isWindowsPath = (filePath: string): boolean => {
  return /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')
}

const getPathParts = (filePath: string): { dir: string; stem: string; separator: '/' | '\\' } => {
  const lastForwardSlash = filePath.lastIndexOf('/')
  const lastBackwardSlash = filePath.lastIndexOf('\\')
  const slashIndex = Math.max(lastForwardSlash, lastBackwardSlash)

  const separator = slashIndex >= 0
    ? (filePath[slashIndex] as '/' | '\\')
    : (isWindowsPath(filePath) ? '\\' : '/')

  const dir = slashIndex >= 0 ? filePath.slice(0, slashIndex) : ''
  const fileName = slashIndex >= 0 ? filePath.slice(slashIndex + 1) : filePath
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return { dir, stem, separator }
}

const toSafeToken = (token: string, filePath: string): string => {
  if (!isWindowsPath(filePath)) {
    return token
  }
  return token.replace(/[<>:"/\\|?*]/g, '_')
}

export function useCompressLecture() {
  const inputPath = ref('')
  const outputPath = ref('')
  const hasCustomOutputPath = ref(false)

  const preset = ref<Preset>('tiny')
  const audioPreset = ref<AudioPreset>('mid')
  const audioFilterPreset = ref<AudioFilterPreset>('speech')
  const cropMode = ref<CropMode>('none')
  const filterMode = ref<FilterMode>('none')
  const scaler = ref<Scaler>('lanczos')
  const container = ref<Container>('mp4')
  const opusVbr = ref<OpusVbr>('constrained')
  const opusFrameDuration = ref<20 | 40 | 60>(60)
  const keepAac = ref(false)
  const x265Params = ref('aq-mode=1')

  const isRunning = ref(false)
  const status = ref<UiStatus>('idle')
  const statusMessage = ref('')
  const progress = ref<CompressLectureProgress>({
    phase: 'preparing',
    current: 0,
    total: 100,
    message: ''
  })
  const fakeProgress = ref(0)

  const lastOutputPath = ref('')
  const previewResult = ref<CompressLecturePreviewResult | null>(null)

  let removeProgressListener: (() => void) | null = null
  let removeCompletedListener: (() => void) | null = null
  let removeErrorListener: (() => void) | null = null
  let fakeProgressTimer: ReturnType<typeof setInterval> | null = null

  const suggestedOutputPath = computed(() => {
    if (!inputPath.value) {
      return ''
    }

    const { dir, stem, separator } = getPathParts(inputPath.value)
    const safeCrop = toSafeToken(cropMode.value, inputPath.value)
    const outputName = `${stem}_${preset.value}_${audioPreset.value}_${audioFilterPreset.value}_${safeCrop}_${filterMode.value}.${container.value}`
    return dir ? `${dir}${separator}${outputName}` : outputName
  })

  const previewCommand = computed(() => previewResult.value?.command || '')

  const canStart = computed(() => Boolean(inputPath.value) && !isRunning.value)

  const stopFakeProgress = () => {
    if (fakeProgressTimer) {
      clearInterval(fakeProgressTimer)
      fakeProgressTimer = null
    }
  }

  const startFakeProgress = () => {
    stopFakeProgress()
    fakeProgress.value = Math.max(8, fakeProgress.value)

    fakeProgressTimer = setInterval(() => {
      if (!isRunning.value) {
        return
      }

      const next = Math.round((fakeProgress.value + 0.75) * 100) / 100
      fakeProgress.value = Math.min(92, next)
    }, 1000)
  }

  const applyDefaults = () => {
    const defaults = buildDefaultValues()
    preset.value = defaults.preset
    audioPreset.value = defaults.audioPreset
    audioFilterPreset.value = defaults.audioFilterPreset
    cropMode.value = defaults.cropMode
    filterMode.value = defaults.filterMode
    scaler.value = defaults.scaler
    container.value = defaults.container
    opusVbr.value = defaults.opusVbr
    opusFrameDuration.value = defaults.opusFrameDuration
    keepAac.value = defaults.keepAac
    x265Params.value = defaults.x265Params
  }

  const resetState = () => {
    stopFakeProgress()
    inputPath.value = ''
    outputPath.value = ''
    hasCustomOutputPath.value = false
    applyDefaults()
    isRunning.value = false
    status.value = 'idle'
    statusMessage.value = ''
    progress.value = {
      phase: 'preparing',
      current: 0,
      total: 100,
      message: ''
    }
    fakeProgress.value = 0
    lastOutputPath.value = ''
    previewResult.value = null
  }

  const buildOptions = (): CompressLectureOptions => {
    return {
      inputPath: inputPath.value,
      outputPath: outputPath.value || undefined,
      preset: preset.value,
      audioPreset: audioPreset.value,
      audioFilterPreset: audioFilterPreset.value,
      cropMode: cropMode.value,
      filterMode: filterMode.value,
      scaler: scaler.value,
      container: container.value,
      opusVbr: opusVbr.value,
      opusFrameDuration: opusFrameDuration.value,
      keepAac: keepAac.value,
      x265Params: x265Params.value.trim() || 'aq-mode=1'
    }
  }

  const updateOutputIfNotCustom = () => {
    if (!hasCustomOutputPath.value) {
      outputPath.value = suggestedOutputPath.value
    }
  }

  const selectInput = async () => {
    const selected = await window.electronAPI.compressLecture.selectInput()
    if (!selected) {
      return
    }

    inputPath.value = selected
    if (!hasCustomOutputPath.value) {
      outputPath.value = suggestedOutputPath.value
    }

    previewResult.value = null
    status.value = 'idle'
    statusMessage.value = ''
  }

  const selectOutput = async () => {
    const defaultPath = outputPath.value || suggestedOutputPath.value
    const selected = await window.electronAPI.compressLecture.selectOutput(defaultPath)
    if (!selected) {
      return
    }

    outputPath.value = selected
    hasCustomOutputPath.value = true
  }

  const useSuggestedOutput = () => {
    hasCustomOutputPath.value = false
    outputPath.value = suggestedOutputPath.value
  }

  const preview = async () => {
    if (!inputPath.value) {
      status.value = 'error'
      statusMessage.value = 'missingInput'
      return
    }

    status.value = 'previewing'
    statusMessage.value = ''

    try {
      previewResult.value = await window.electronAPI.compressLecture.preview(buildOptions())
      outputPath.value = previewResult.value.outputPath
      status.value = 'idle'
    } catch (error) {
      status.value = 'error'
      statusMessage.value = error instanceof Error ? error.message : 'Preview failed'
    }
  }

  const start = async () => {
    if (!canStart.value) {
      return
    }

    isRunning.value = true
    status.value = 'running'
    statusMessage.value = ''
    progress.value = {
      phase: 'preparing',
      current: 0,
      total: 100,
      message: ''
    }
    fakeProgress.value = 8
    startFakeProgress()

    try {
      const result = await window.electronAPI.compressLecture.start(buildOptions())
      if (result?.outputPath) {
        lastOutputPath.value = result.outputPath
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '')

      stopFakeProgress()
      fakeProgress.value = 0
      isRunning.value = false

      if (message.toLowerCase().includes('cancel')) {
        status.value = 'cancelled'
        statusMessage.value = ''
        return
      }

      if (!statusMessage.value) {
        status.value = 'error'
        statusMessage.value = message || 'Compression failed'
      }
    }
  }

  const cancel = async () => {
    await window.electronAPI.compressLecture.cancel()
  }

  const openOutput = async () => {
    const target = lastOutputPath.value || outputPath.value
    if (!target) {
      return
    }

    await window.electronAPI.shell?.openPath?.(target)
  }

  const attachListeners = () => {
    if (!removeProgressListener) {
      removeProgressListener = window.electronAPI.compressLecture.onProgress((nextProgress) => {
        progress.value = nextProgress
        status.value = 'running'
        statusMessage.value = nextProgress.message || ''
      })
    }

    if (!removeCompletedListener) {
      removeCompletedListener = window.electronAPI.compressLecture.onCompleted((result) => {
        stopFakeProgress()
        fakeProgress.value = 100
        isRunning.value = false
        status.value = 'completed'
        statusMessage.value = ''
        if (result.outputPath) {
          lastOutputPath.value = result.outputPath
          outputPath.value = result.outputPath
        }
      })
    }

    if (!removeErrorListener) {
      removeErrorListener = window.electronAPI.compressLecture.onError((error) => {
        stopFakeProgress()
        fakeProgress.value = 0
        isRunning.value = false
        if (error.toLowerCase().includes('cancel')) {
          status.value = 'cancelled'
          statusMessage.value = ''
          return
        }
        status.value = 'error'
        statusMessage.value = error
      })
    }
  }

  const detachListeners = () => {
    if (removeProgressListener) {
      removeProgressListener()
      removeProgressListener = null
    }

    if (removeCompletedListener) {
      removeCompletedListener()
      removeCompletedListener = null
    }

    if (removeErrorListener) {
      removeErrorListener()
      removeErrorListener = null
    }
  }

  watch(
    [inputPath, preset, audioPreset, audioFilterPreset, cropMode, filterMode, container],
    () => {
      updateOutputIfNotCustom()
    }
  )

  onMounted(async () => {
    resetState()
    attachListeners()

    const active = await window.electronAPI.compressLecture.isActive()
    if (active) {
      isRunning.value = true
      status.value = 'running'
      statusMessage.value = 'Running'
      fakeProgress.value = 8
      startFakeProgress()
    }
  })

  onUnmounted(() => {
    stopFakeProgress()
    detachListeners()
  })

  return {
    inputPath,
    outputPath,
    hasCustomOutputPath,
    preset,
    audioPreset,
    audioFilterPreset,
    cropMode,
    filterMode,
    scaler,
    container,
    opusVbr,
    opusFrameDuration,
    keepAac,
    x265Params,
    isRunning,
    status,
    statusMessage,
    progress,
    fakeProgress,
    previewResult,
    previewCommand,
    canStart,
    suggestedOutputPath,
    lastOutputPath,
    selectInput,
    selectOutput,
    useSuggestedOutput,
    preview,
    start,
    cancel,
    openOutput
  }
}
