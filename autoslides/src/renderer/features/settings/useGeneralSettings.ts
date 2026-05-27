import { ref, type Ref } from 'vue'
import { languageService } from '@features/settings/languageService'
import { DownloadService } from '@shared/services/downloadService'

export interface UseGeneralSettingsOptions {
  maxConcurrentDownloads: Ref<number>
  downloadMaxWorkers: Ref<number>
  downloadNumRetries: Ref<number>
  videoRetryCount: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>
}

export function useGeneralSettings(options: UseGeneralSettingsOptions) {
  const {
    maxConcurrentDownloads,
    downloadMaxWorkers,
    downloadNumRetries,
    videoRetryCount,
    themeMode,
    languageMode
  } = options

  const tempMaxConcurrentDownloads = ref(5)
  const tempDownloadMaxWorkers = ref(32)
  const tempDownloadNumRetries = ref(15)
  const tempVideoRetryCount = ref(5)
  const tempThemeMode = ref<'system' | 'light' | 'dark'>('system')
  const tempLanguageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

  const resetTemp = () => {
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    tempDownloadMaxWorkers.value = downloadMaxWorkers.value
    tempDownloadNumRetries.value = downloadNumRetries.value
    tempVideoRetryCount.value = videoRetryCount.value
    tempThemeMode.value = themeMode.value
    tempLanguageMode.value = languageMode.value
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
    tempThemeMode,
    tempLanguageMode,

    resetTemp,
    save,

    updateMaxConcurrentDownloads,
    updateDownloadMaxWorkers,
    updateDownloadNumRetries,
    updateVideoRetryCount
  }
}

export type UseGeneralSettingsReturn = ReturnType<typeof useGeneralSettings>
