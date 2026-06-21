import { ref, type Ref } from 'vue'
import { languageService } from '@features/settings/languageService'
import { DownloadService } from '@shared/services/downloadService'

type MuteMode = 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'

export interface UseGeneralSettingsOptions {
  maxConcurrentDownloads: Ref<number>
  downloadMaxWorkers: Ref<number>
  downloadNumRetries: Ref<number>
  videoRetryCount: Ref<number>
  videoTokenRefreshSeconds: Ref<number>
  previewFromVideo: Ref<boolean>
  previewSeekSeconds: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<MuteMode>
  taskSpeed: Ref<number>
  parallelTasks: Ref<number>
  maxManualTabs: Ref<number>
  showMorePlaybackSpeed: Ref<boolean>
  preventSystemSleep: Ref<boolean>
}

export function useGeneralSettings(options: UseGeneralSettingsOptions) {
  const {
    maxConcurrentDownloads,
    downloadMaxWorkers,
    downloadNumRetries,
    videoRetryCount,
    videoTokenRefreshSeconds,
    previewFromVideo,
    previewSeekSeconds,
    themeMode,
    languageMode,
    connectionMode,
    muteMode,
    taskSpeed,
    parallelTasks,
    maxManualTabs,
    showMorePlaybackSpeed,
    preventSystemSleep
  } = options

  const tempMaxConcurrentDownloads = ref(5)
  const tempDownloadMaxWorkers = ref(32)
  const tempDownloadNumRetries = ref(15)
  const tempVideoRetryCount = ref(5)
  const tempVideoTokenRefreshSeconds = ref(300)
  const tempPreviewFromVideo = ref(true)
  const tempPreviewSeekSeconds = ref(150)
  const tempThemeMode = ref<'system' | 'light' | 'dark'>('system')
  const tempLanguageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')
  const tempConnectionMode = ref<'internal' | 'external'>('external')
  const tempMuteMode = ref<MuteMode>('normal')
  const tempTaskSpeed = ref(10)
  const tempParallelTasks = ref(2)
  const tempMaxManualTabs = ref(3)
  const tempShowMorePlaybackSpeed = ref(false)
  const tempPreventSystemSleep = ref(true)

  const resetTemp = () => {
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    tempDownloadMaxWorkers.value = downloadMaxWorkers.value
    tempDownloadNumRetries.value = downloadNumRetries.value
    tempVideoRetryCount.value = videoRetryCount.value
    tempVideoTokenRefreshSeconds.value = videoTokenRefreshSeconds.value
    tempPreviewFromVideo.value = previewFromVideo.value
    tempPreviewSeekSeconds.value = previewSeekSeconds.value
    tempThemeMode.value = themeMode.value
    tempLanguageMode.value = languageMode.value
    tempConnectionMode.value = connectionMode.value
    tempMuteMode.value = muteMode.value
    tempTaskSpeed.value = taskSpeed.value
    tempParallelTasks.value = parallelTasks.value
    tempMaxManualTabs.value = maxManualTabs.value
    tempShowMorePlaybackSpeed.value = showMorePlaybackSpeed.value
    tempPreventSystemSleep.value = preventSystemSleep.value
  }

  const save = async () => {
    const downloadResult = await window.electronAPI.config.setMaxConcurrentDownloads(tempMaxConcurrentDownloads.value)
    maxConcurrentDownloads.value = downloadResult.maxConcurrentDownloads

    const workersResult = await window.electronAPI.config.setDownloadMaxWorkers(tempDownloadMaxWorkers.value)
    downloadMaxWorkers.value = workersResult.downloadMaxWorkers

    const retriesResult = await window.electronAPI.config.setDownloadNumRetries(tempDownloadNumRetries.value)
    downloadNumRetries.value = retriesResult.downloadNumRetries

    const retryResult = await window.electronAPI.config.setVideoRetryCount(tempVideoRetryCount.value)
    videoRetryCount.value = retryResult.videoRetryCount

    const tokenRefreshResult = await window.electronAPI.config.setVideoTokenRefreshSeconds(tempVideoTokenRefreshSeconds.value)
    videoTokenRefreshSeconds.value = tokenRefreshResult.videoTokenRefreshSeconds

    const previewFromVideoResult = await window.electronAPI.config.setPreviewFromVideo(tempPreviewFromVideo.value)
    previewFromVideo.value = previewFromVideoResult.previewFromVideo

    const previewSeekResult = await window.electronAPI.config.setPreviewSeekSeconds(tempPreviewSeekSeconds.value)
    previewSeekSeconds.value = previewSeekResult.previewSeekSeconds

    if (tempThemeMode.value !== themeMode.value) {
      const themeResult = await window.electronAPI.config.setThemeMode(tempThemeMode.value)
      themeMode.value = themeResult.themeMode
    }

    if (tempLanguageMode.value !== languageMode.value) {
      const langResult = await window.electronAPI.config.setLanguageMode(tempLanguageMode.value)
      languageMode.value = langResult.languageMode
      await languageService.setLanguageMode(tempLanguageMode.value)
    }

    DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)

    const connectionResult = await window.electronAPI.config.setConnectionMode(tempConnectionMode.value)
    connectionMode.value = connectionResult.connectionMode

    const muteResult = await window.electronAPI.config.setMuteMode(tempMuteMode.value)
    muteMode.value = muteResult.muteMode

    const taskSpeedResult = await window.electronAPI.config.setTaskSpeed(tempTaskSpeed.value)
    taskSpeed.value = taskSpeedResult.taskSpeed

    const parallelResult = await window.electronAPI.config.setParallelTasks(tempParallelTasks.value)
    parallelTasks.value = parallelResult.parallelTasks

    const maxTabsResult = await window.electronAPI.config.setMaxManualTabs(tempMaxManualTabs.value)
    maxManualTabs.value = maxTabsResult.maxManualTabs

    if (tempShowMorePlaybackSpeed.value !== showMorePlaybackSpeed.value) {
      const showMoreResult = await window.electronAPI.config.setShowMorePlaybackSpeed(tempShowMorePlaybackSpeed.value)
      showMorePlaybackSpeed.value = showMoreResult.showMorePlaybackSpeed ?? false
      // Notify open playback pages so the speed menu updates live.
      window.dispatchEvent(new CustomEvent('showMorePlaybackSpeedChanged', { detail: showMorePlaybackSpeed.value }))
    }

    if (tempPreventSystemSleep.value !== preventSystemSleep.value) {
      const sleepResult = await window.electronAPI.config.setPreventSystemSleep(tempPreventSystemSleep.value)
      preventSystemSleep.value = sleepResult.preventSystemSleep
      if (preventSystemSleep.value) {
        await window.electronAPI.powerManagement.preventSleep()
      } else {
        await window.electronAPI.powerManagement.allowSleep()
      }
    }
  }

  // Placeholders — actual save happens in save()
  const updateMaxConcurrentDownloads = () => { /* noop */ }
  const updateDownloadMaxWorkers = () => { /* noop */ }
  const updateDownloadNumRetries = () => { /* noop */ }
  const updateVideoRetryCount = () => { /* noop */ }

  return {
    tempMaxConcurrentDownloads,
    tempDownloadMaxWorkers,
    tempDownloadNumRetries,
    tempVideoRetryCount,
    tempVideoTokenRefreshSeconds,
    tempPreviewFromVideo,
    tempPreviewSeekSeconds,
    tempThemeMode,
    tempLanguageMode,
    tempConnectionMode,
    tempMuteMode,
    tempTaskSpeed,
    tempParallelTasks,
    tempMaxManualTabs,
    tempShowMorePlaybackSpeed,
    tempPreventSystemSleep,

    resetTemp,
    save,

    updateMaxConcurrentDownloads,
    updateDownloadMaxWorkers,
    updateDownloadNumRetries,
    updateVideoRetryCount
  }
}

export type UseGeneralSettingsReturn = ReturnType<typeof useGeneralSettings>
