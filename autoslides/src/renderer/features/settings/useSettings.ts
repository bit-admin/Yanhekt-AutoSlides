import { ref, watch, type Ref } from 'vue'
import { configStore } from '@shared/services/configStore'
import { DownloadService } from '@shared/services/downloadService'
import { languageService } from '@features/settings/languageService'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('Settings');

export interface UseSettingsReturn {
  // Basic settings state
  outputDirectory: Ref<string>
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>

  // Task settings
  taskSpeed: Ref<number>
  parallelTasks: Ref<number>
  maxManualTabs: Ref<number>
  showMorePlaybackSpeed: Ref<boolean>
  enableAIFiltering: Ref<boolean>
  tempEnableAIFiltering: Ref<boolean>

  // Other settings
  preventSystemSleep: Ref<boolean>
  maxConcurrentDownloads: Ref<number>
  downloadMaxWorkers: Ref<number>
  downloadNumRetries: Ref<number>
  videoRetryCount: Ref<number>
  videoTokenRefreshSeconds: Ref<number>
  previewFromVideo: Ref<boolean>
  previewSeekSeconds: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>

  // Methods
  loadConfig: () => Promise<void>
  selectOutputDirectory: () => Promise<void>
  setConnectionMode: (mode: 'internal' | 'external') => Promise<void>
  setMuteMode: () => Promise<void>
  setTaskSpeed: () => Promise<void>
  setParallelTasks: () => Promise<void>
  setEnableAIFiltering: () => Promise<void>
  resetTempEnableAIFiltering: () => void
  saveEnableAIFiltering: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  // Basic settings state
  const outputDirectory = ref('')
  const connectionMode = ref<'internal' | 'external'>('external')
  // Connection mode can be changed outside the settings modal (e.g. the Home-page
  // campus-network warning writes it directly). Mirror the broadcast-synced
  // configStore so the General tab never shows a stale value. This is an
  // immediate-write toggle (no temp buffer), so a live mirror is safe.
  watch(() => configStore.connectionMode, (mode) => {
    connectionMode.value = mode
  }, { immediate: true })
  const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')

  // Task settings
  const taskSpeed = ref(10)
  const parallelTasks = ref(2)
  const maxManualTabs = ref(3)
  const showMorePlaybackSpeed = ref(false)
  const enableAIFiltering = ref(true)
  const tempEnableAIFiltering = ref(true)

  // Other settings
  const preventSystemSleep = ref(true)
  const maxConcurrentDownloads = ref(5)
  const downloadMaxWorkers = ref(32)
  const downloadNumRetries = ref(15)
  const videoRetryCount = ref(5)
  const videoTokenRefreshSeconds = ref(300)
  const previewFromVideo = ref(true)
  const previewSeekSeconds = ref(150)
  const themeMode = ref<'system' | 'light' | 'dark'>('system')
  const languageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

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
      videoTokenRefreshSeconds.value = config.videoTokenRefreshSeconds ?? 300
      previewFromVideo.value = config.previewFromVideo !== undefined ? config.previewFromVideo : true
      previewSeekSeconds.value = config.previewSeekSeconds ?? 150

      // Load task configuration
      taskSpeed.value = config.taskSpeed || 10
      parallelTasks.value = config.parallelTasks || 2
      maxManualTabs.value = config.maxManualTabs || 3
      showMorePlaybackSpeed.value = config.showMorePlaybackSpeed ?? false
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

  const setEnableAIFiltering = async () => {
    // Placeholder - actual save happens via saveEnableAIFiltering in the Settings page's commitSettings
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

  return {
    // Basic settings state
    outputDirectory,
    connectionMode,
    muteMode,

    // Task settings
    taskSpeed,
    parallelTasks,
    maxManualTabs,
    showMorePlaybackSpeed,
    enableAIFiltering,
    tempEnableAIFiltering,

    // Other settings
    preventSystemSleep,
    maxConcurrentDownloads,
    downloadMaxWorkers,
    downloadNumRetries,
    videoRetryCount,
    videoTokenRefreshSeconds,
    previewFromVideo,
    previewSeekSeconds,
    themeMode,
    languageMode,

    // Methods
    loadConfig,
    selectOutputDirectory,
    setConnectionMode,
    setMuteMode,
    setTaskSpeed,
    setParallelTasks,
    setEnableAIFiltering,
    resetTempEnableAIFiltering,
    saveEnableAIFiltering
  }
}
