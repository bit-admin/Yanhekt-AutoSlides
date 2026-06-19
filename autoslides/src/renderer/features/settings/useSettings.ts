import { ref, type Ref } from 'vue'
import { DownloadService } from '@shared/services/downloadService'
import { languageService } from '@features/settings/languageService'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('Settings');

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
  parallelTasks: Ref<number>
  maxManualTabs: Ref<number>
  showMorePlaybackSpeed: Ref<boolean>
  autoPostProcessing: Ref<boolean>
  autoPostProcessingLive: Ref<boolean>
  enableAIFiltering: Ref<boolean>
  tempEnableAIFiltering: Ref<boolean>

  // Other settings
  preventSystemSleep: Ref<boolean>
  maxConcurrentDownloads: Ref<number>
  downloadMaxWorkers: Ref<number>
  downloadNumRetries: Ref<number>
  videoRetryCount: Ref<number>
  previewFromVideo: Ref<boolean>
  previewSeekSeconds: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>

  // Methods
  loadConfig: () => Promise<void>
  selectOutputDirectory: () => Promise<void>
  setConnectionMode: (mode: 'internal' | 'external') => Promise<void>
  setMuteMode: () => Promise<void>
  setSlideCheckInterval: () => Promise<void>
  validateAndCorrectInterval: () => void
  setSlideDoubleVerification: () => Promise<void>
  setTaskSpeed: () => Promise<void>
  setParallelTasks: () => Promise<void>
  setMaxManualTabs: () => Promise<void>
  setShowMorePlaybackSpeed: () => Promise<void>
  setAutoPostProcessing: () => Promise<void>
  setAutoPostProcessingLive: () => Promise<void>
  setEnableAIFiltering: () => Promise<void>
  resetTempEnableAIFiltering: () => void
  saveEnableAIFiltering: () => Promise<void>
  setPreventSystemSleep: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
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
  const parallelTasks = ref(2)
  const maxManualTabs = ref(3)
  const showMorePlaybackSpeed = ref(false)
  const autoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const enableAIFiltering = ref(true)
  const tempEnableAIFiltering = ref(true)

  // Other settings
  const preventSystemSleep = ref(true)
  const maxConcurrentDownloads = ref(5)
  const downloadMaxWorkers = ref(32)
  const downloadNumRetries = ref(15)
  const videoRetryCount = ref(5)
  const previewFromVideo = ref(true)
  const previewSeekSeconds = ref(150)
  const themeMode = ref<'system' | 'light' | 'dark'>('system')
  const languageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

  // Validation function
  const validateAndCorrectInterval = () => {
    if (isNaN(slideCheckInterval.value) || slideCheckInterval.value === null || slideCheckInterval.value === undefined) {
      slideCheckInterval.value = 2000
      return
    }

    let value = Math.round(slideCheckInterval.value)

    if (value < 500) {
      value = 500
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

    if (value < 500) {
      value = 500
    }

    if (value !== slideCheckInterval.value) {
      slideCheckInterval.value = value
      log.debug(`Slide check interval corrected to: ${value}ms`)
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
      downloadMaxWorkers.value = config.downloadMaxWorkers || 32
      downloadNumRetries.value = config.downloadNumRetries || 15
      videoRetryCount.value = config.videoRetryCount || 5
      previewFromVideo.value = config.previewFromVideo !== undefined ? config.previewFromVideo : true
      previewSeekSeconds.value = config.previewSeekSeconds ?? 150

      // Load slide extraction configuration
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
      slideCheckInterval.value = slideConfig.checkInterval || 2000
      validateAndCorrectInterval()
      slideDoubleVerification.value = slideConfig.enableDoubleVerification !== false
      slideVerificationCount.value = slideConfig.verificationCount || 2

      // Load task configuration
      taskSpeed.value = config.taskSpeed || 10
      parallelTasks.value = config.parallelTasks || 2
      maxManualTabs.value = config.maxManualTabs || 3
      showMorePlaybackSpeed.value = config.showMorePlaybackSpeed ?? false
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
      log.error('Failed to load config:', error)
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
      log.error('Failed to select output directory:', error)
    }
  }

  const setConnectionMode = async (mode: 'internal' | 'external') => {
    try {
      const result = await window.electronAPI.config.setConnectionMode(mode)
      connectionMode.value = result.connectionMode
    } catch (error) {
      log.error('Failed to set connection mode:', error)
    }
  }

  const setMuteMode = async () => {
    try {
      const result = await window.electronAPI.config.setMuteMode(muteMode.value)
      muteMode.value = result.muteMode
    } catch (error) {
      log.error('Failed to set mute mode:', error)
    }
  }

  const setSlideCheckInterval = async () => {
    try {
      validateAndCorrectInterval()
      const result = await window.electronAPI.config.setSlideCheckInterval(slideCheckInterval.value)
      slideCheckInterval.value = result.checkInterval
    } catch (error) {
      log.error('Failed to set slide check interval:', error)
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
      log.error('Failed to set slide double verification:', error)
    }
  }

  const setTaskSpeed = async () => {
    try {
      const result = await window.electronAPI.config.setTaskSpeed(taskSpeed.value)
      taskSpeed.value = result.taskSpeed
    } catch (error) {
      log.error('Failed to set task speed:', error)
    }
  }

  const setParallelTasks = async () => {
    try {
      const result = await window.electronAPI.config.setParallelTasks(parallelTasks.value)
      parallelTasks.value = result.parallelTasks
    } catch (error) {
      log.error('Failed to set parallel tasks:', error)
    }
  }

  const setMaxManualTabs = async () => {
    try {
      const result = await window.electronAPI.config.setMaxManualTabs(maxManualTabs.value)
      maxManualTabs.value = result.maxManualTabs
    } catch (error) {
      log.error('Failed to set max manual tabs:', error)
    }
  }

  const setShowMorePlaybackSpeed = async () => {
    try {
      const result = await window.electronAPI.config.setShowMorePlaybackSpeed(showMorePlaybackSpeed.value)
      showMorePlaybackSpeed.value = result.showMorePlaybackSpeed ?? false
      window.dispatchEvent(new CustomEvent('showMorePlaybackSpeedChanged', { detail: showMorePlaybackSpeed.value }))
    } catch (error) {
      log.error('Failed to set show-more playback speed:', error)
    }
  }

  const setAutoPostProcessing = async () => {
    try {
      const result = await window.electronAPI.config.setAutoPostProcessing(autoPostProcessing.value)
      autoPostProcessing.value = result.autoPostProcessing
    } catch (error) {
      log.error('Failed to set auto post-processing:', error)
    }
  }

  const setAutoPostProcessingLive = async () => {
    try {
      const result = await window.electronAPI.config.setAutoPostProcessingLive(autoPostProcessingLive.value)
      autoPostProcessingLive.value = result.autoPostProcessingLive
    } catch (error) {
      log.error('Failed to set auto post-processing for live:', error)
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
      log.error('Failed to set enable AI filtering:', error)
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
      log.error('Failed to set prevent system sleep:', error)
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
    parallelTasks,
    maxManualTabs,
    showMorePlaybackSpeed,
    autoPostProcessing,
    autoPostProcessingLive,
    enableAIFiltering,
    tempEnableAIFiltering,

    // Other settings
    preventSystemSleep,
    maxConcurrentDownloads,
    downloadMaxWorkers,
    downloadNumRetries,
    videoRetryCount,
    previewFromVideo,
    previewSeekSeconds,
    themeMode,
    languageMode,

    // Methods
    loadConfig,
    selectOutputDirectory,
    setConnectionMode,
    setMuteMode,
    setSlideCheckInterval,
    validateAndCorrectInterval,
    setSlideDoubleVerification,
    setTaskSpeed,
    setParallelTasks,
    setMaxManualTabs,
    setShowMorePlaybackSpeed,
    setAutoPostProcessing,
    setAutoPostProcessingLive,
    setEnableAIFiltering,
    resetTempEnableAIFiltering,
    saveEnableAIFiltering,
    setPreventSystemSleep
  }
}
