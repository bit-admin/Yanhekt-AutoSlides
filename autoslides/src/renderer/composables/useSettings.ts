import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { DownloadService } from '../services/downloadService'
import { taskQueueState } from '../services/taskQueueService'
import { languageService } from '../services/languageService'

export interface UseSettingsReturn {
  // Basic settings state
  outputDirectory: Ref<string>
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>

  // Slide extraction settings
  slideCheckInterval: Ref<number>
  slideDoubleVerification: Ref<boolean>
  slideVerificationCount: Ref<number>

  // Task settings
  taskSpeed: Ref<number>
  autoPostProcessing: Ref<boolean>
  autoPostProcessingLive: Ref<boolean>
  enableAIFiltering: Ref<boolean>
  tempEnableAIFiltering: Ref<boolean>

  // Other settings
  preventSystemSleep: Ref<boolean>
  maxConcurrentDownloads: Ref<number>
  videoRetryCount: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>

  // Computed status
  taskStatus: ComputedRef<string>
  downloadQueueStatus: ComputedRef<string>

  // Methods
  loadConfig: () => Promise<void>
  selectOutputDirectory: () => Promise<void>
  setConnectionMode: (mode: 'internal' | 'external') => Promise<void>
  setMuteMode: () => Promise<void>
  setSlideCheckInterval: () => Promise<void>
  validateAndCorrectInterval: () => void
  setSlideDoubleVerification: () => Promise<void>
  resetSlideDetectionInterval: () => Promise<void>
  resetSlideStabilityVerification: () => Promise<void>
  setTaskSpeed: () => Promise<void>
  setAutoPostProcessing: () => Promise<void>
  setAutoPostProcessingLive: () => Promise<void>
  setEnableAIFiltering: () => Promise<void>
  resetTempEnableAIFiltering: () => void
  saveEnableAIFiltering: () => Promise<void>
  setPreventSystemSleep: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const { t } = useI18n()

  // Basic settings state
  const outputDirectory = ref('')
  const connectionMode = ref<'internal' | 'external'>('external')
  const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')

  // Slide extraction settings
  const slideCheckInterval = ref(2000)
  const slideDoubleVerification = ref(true)
  const slideVerificationCount = ref(2)

  // Task settings
  const taskSpeed = ref(10)
  const autoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const enableAIFiltering = ref(true)
  const tempEnableAIFiltering = ref(true)

  // Other settings
  const preventSystemSleep = ref(true)
  const maxConcurrentDownloads = ref(5)
  const videoRetryCount = ref(5)
  const themeMode = ref<'system' | 'light' | 'dark'>('system')
  const languageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

  // Computed status
  const taskStatus = computed(() => {
    const stats = taskQueueState.value
    const queued = stats.queuedCount
    const inProgress = stats.inProgressCount
    const completed = stats.completedCount
    const errors = stats.errorCount

    if (stats.isProcessing && inProgress > 0) {
      const currentTask = stats.currentTask
      if (currentTask && currentTask.progress > 0) {
        return `Processing ${currentTask.progress}%, ${queued} queued`
      } else {
        return `${inProgress} processing, ${queued} queued`
      }
    } else if (queued > 0) {
      if (stats.isProcessing) {
        return `Starting tasks... ${queued} queued`
      } else {
        return `${queued} queued (paused)`
      }
    } else if (completed > 0 || errors > 0) {
      return `${completed} completed, ${errors} failed`
    } else {
      return t('status.noTasks')
    }
  })

  const downloadQueueStatus = computed(() => {
    const queued = DownloadService.queuedCount
    const active = DownloadService.activeCount
    const completed = DownloadService.completedCount
    const errors = DownloadService.errorCount

    if (active > 0) {
      return `${active} downloading, ${queued} queued`
    } else if (queued > 0) {
      return `${queued} queued`
    } else if (completed > 0 || errors > 0) {
      return `${completed} done, ${errors} failed`
    } else {
      return t('status.noDownloads')
    }
  })

  // Validation function
  const validateAndCorrectInterval = () => {
    if (isNaN(slideCheckInterval.value) || slideCheckInterval.value === null || slideCheckInterval.value === undefined) {
      slideCheckInterval.value = 2000
      return
    }

    let value = Math.round(slideCheckInterval.value)

    if (value < 1000) {
      value = 1000
    } else if (value > 10000) {
      value = 10000
    }

    const remainder = value % 500
    if (remainder !== 0) {
      if (remainder <= 250) {
        value = value - remainder
      } else {
        value = value + (500 - remainder)
      }
    }

    if (value < 1000) {
      value = 1000
    }

    if (value !== slideCheckInterval.value) {
      slideCheckInterval.value = value
      console.log(`Slide check interval corrected to: ${value}ms`)
    }
  }

  // Config loading
  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.config.get()
      outputDirectory.value = config.outputDirectory
      connectionMode.value = config.connectionMode
      muteMode.value = config.muteMode || 'normal'
      maxConcurrentDownloads.value = config.maxConcurrentDownloads || 5
      DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)
      videoRetryCount.value = config.videoRetryCount || 5

      // Load slide extraction configuration
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
      slideCheckInterval.value = slideConfig.checkInterval || 2000
      validateAndCorrectInterval()
      slideDoubleVerification.value = slideConfig.enableDoubleVerification !== false
      slideVerificationCount.value = slideConfig.verificationCount || 2

      // Load task configuration
      taskSpeed.value = config.taskSpeed || 10
      autoPostProcessing.value = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true
      autoPostProcessingLive.value = config.autoPostProcessingLive !== undefined ? config.autoPostProcessingLive : true
      enableAIFiltering.value = config.enableAIFiltering !== undefined ? config.enableAIFiltering : true
      tempEnableAIFiltering.value = enableAIFiltering.value

      // Load theme/language configuration
      themeMode.value = config.themeMode || 'system'
      languageMode.value = config.languageMode || 'system'
      await languageService.initialize()

      // Load prevent system sleep
      preventSystemSleep.value = config.preventSystemSleep !== undefined ? config.preventSystemSleep : true
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  // Setting methods
  const selectOutputDirectory = async () => {
    try {
      const result = await window.electronAPI.config.selectOutputDirectory()
      if (result) {
        outputDirectory.value = result.outputDirectory
      }
    } catch (error) {
      console.error('Failed to select output directory:', error)
    }
  }

  const setConnectionMode = async (mode: 'internal' | 'external') => {
    try {
      const result = await window.electronAPI.config.setConnectionMode(mode)
      connectionMode.value = result.connectionMode
    } catch (error) {
      console.error('Failed to set connection mode:', error)
    }
  }

  const setMuteMode = async () => {
    try {
      const result = await window.electronAPI.config.setMuteMode(muteMode.value)
      muteMode.value = result.muteMode
    } catch (error) {
      console.error('Failed to set mute mode:', error)
    }
  }

  const setSlideCheckInterval = async () => {
    try {
      validateAndCorrectInterval()
      const result = await window.electronAPI.config.setSlideCheckInterval(slideCheckInterval.value)
      slideCheckInterval.value = result.checkInterval
    } catch (error) {
      console.error('Failed to set slide check interval:', error)
    }
  }

  const setSlideDoubleVerification = async () => {
    try {
      const result = await window.electronAPI.config.setSlideDoubleVerification(
        slideDoubleVerification.value,
        slideVerificationCount.value
      )
      slideDoubleVerification.value = result.enableDoubleVerification
      slideVerificationCount.value = result.verificationCount
    } catch (error) {
      console.error('Failed to set slide double verification:', error)
    }
  }

  const resetSlideDetectionInterval = async () => {
    try {
      slideCheckInterval.value = 2000
      validateAndCorrectInterval()
      await setSlideCheckInterval()
    } catch (error) {
      console.error('Failed to reset slide detection interval:', error)
    }
  }

  const resetSlideStabilityVerification = async () => {
    try {
      slideDoubleVerification.value = true
      slideVerificationCount.value = 2
      await setSlideDoubleVerification()
    } catch (error) {
      console.error('Failed to reset slide stability verification:', error)
    }
  }

  const setTaskSpeed = async () => {
    try {
      const result = await window.electronAPI.config.setTaskSpeed(taskSpeed.value)
      taskSpeed.value = result.taskSpeed
    } catch (error) {
      console.error('Failed to set task speed:', error)
    }
  }

  const setAutoPostProcessing = async () => {
    try {
      const result = await window.electronAPI.config.setAutoPostProcessing(autoPostProcessing.value)
      autoPostProcessing.value = result.autoPostProcessing
    } catch (error) {
      console.error('Failed to set auto post-processing:', error)
    }
  }

  const setAutoPostProcessingLive = async () => {
    try {
      const result = await window.electronAPI.config.setAutoPostProcessingLive(autoPostProcessingLive.value)
      autoPostProcessingLive.value = result.autoPostProcessingLive
    } catch (error) {
      console.error('Failed to set auto post-processing for live:', error)
    }
  }

  const setEnableAIFiltering = async () => {
    // Placeholder - actual save happens via saveEnableAIFiltering in saveAdvancedSettings
  }

  const resetTempEnableAIFiltering = () => {
    tempEnableAIFiltering.value = enableAIFiltering.value
  }

  const saveEnableAIFiltering = async () => {
    try {
      const result = await window.electronAPI.config.setEnableAIFiltering(tempEnableAIFiltering.value)
      enableAIFiltering.value = result.enableAIFiltering
      tempEnableAIFiltering.value = enableAIFiltering.value
    } catch (error) {
      console.error('Failed to set enable AI filtering:', error)
    }
  }

  const setPreventSystemSleep = async () => {
    try {
      const result = await window.electronAPI.config.setPreventSystemSleep(preventSystemSleep.value)
      preventSystemSleep.value = result.preventSystemSleep

      if (preventSystemSleep.value) {
        await window.electronAPI.powerManagement.preventSleep()
      } else {
        await window.electronAPI.powerManagement.allowSleep()
      }
    } catch (error) {
      console.error('Failed to set prevent system sleep:', error)
    }
  }

  return {
    // Basic settings state
    outputDirectory,
    connectionMode,
    muteMode,

    // Slide extraction settings
    slideCheckInterval,
    slideDoubleVerification,
    slideVerificationCount,

    // Task settings
    taskSpeed,
    autoPostProcessing,
    autoPostProcessingLive,
    enableAIFiltering,
    tempEnableAIFiltering,

    // Other settings
    preventSystemSleep,
    maxConcurrentDownloads,
    videoRetryCount,
    themeMode,
    languageMode,

    // Computed status
    taskStatus,
    downloadQueueStatus,

    // Methods
    loadConfig,
    selectOutputDirectory,
    setConnectionMode,
    setMuteMode,
    setSlideCheckInterval,
    validateAndCorrectInterval,
    setSlideDoubleVerification,
    resetSlideDetectionInterval,
    resetSlideStabilityVerification,
    setTaskSpeed,
    setAutoPostProcessing,
    setAutoPostProcessingLive,
    setEnableAIFiltering,
    resetTempEnableAIFiltering,
    saveEnableAIFiltering,
    setPreventSystemSleep
  }
}
