import {
  normalizeCurrentTermSearchSource,
  normalizeEarlierTermSearchSource,
  type CurrentTermSearchSource,
  type EarlierTermSearchSource,
} from '@common/searchSources'
import { ref, type Ref } from 'vue'
import { YANHE2_CAPTION_OFFSET_DEFAULT, type ConnectionMode, type Yanhe2CaptionMode } from '@common/types'
import { languageService } from '@features/settings/languageService'
import { configStore } from '@shared/services/configStore'
import { DownloadService } from '@shared/services/downloadService'
import { followOutsideChange } from './followOutsideChange'

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
  connectionMode: Ref<ConnectionMode>
  muteMode: Ref<MuteMode>
  taskSpeed: Ref<number>
  parallelTasks: Ref<number>
  maxManualTabs: Ref<number>
  showMorePlaybackSpeed: Ref<boolean>
  preferMicAudioByDefault: Ref<boolean>
  checkMicAudioBeforeOffering: Ref<boolean>
  yanhe2CaptionMode: Ref<Yanhe2CaptionMode>
  yanhe2CaptionOffsetSeconds: Ref<number>
  resumeFromServerProgress: Ref<boolean>
  resumeFromServerProgressLectures: Ref<boolean>
  preventSystemSleep: Ref<boolean>
  developerMode: Ref<boolean>
  logYanhektCatalog: Ref<boolean>
  rememberPassword: Ref<boolean>
  autoSignIn: Ref<boolean>
  currentTermSearchSource: Ref<CurrentTermSearchSource>
  earlierTermSearchSource: Ref<EarlierTermSearchSource>
  courseIndexAutoUpdate: Ref<boolean>
  yanhe2SignInWithMain: Ref<boolean>
  closeToTray: Ref<boolean>
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
    preferMicAudioByDefault,
    checkMicAudioBeforeOffering,
    yanhe2CaptionMode,
    yanhe2CaptionOffsetSeconds,
    resumeFromServerProgress,
    resumeFromServerProgressLectures,
    preventSystemSleep,
    developerMode,
    logYanhektCatalog,
    rememberPassword,
    autoSignIn,
    currentTermSearchSource,
    earlierTermSearchSource,
    courseIndexAutoUpdate,
    yanhe2SignInWithMain,
    closeToTray
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
  const tempConnectionMode = ref<ConnectionMode>('auto')
  const tempMuteMode = ref<MuteMode>('normal')
  const tempTaskSpeed = ref(16)
  const tempParallelTasks = ref(2)
  const tempMaxManualTabs = ref(3)
  const tempShowMorePlaybackSpeed = ref(false)
  const tempPreferMicAudioByDefault = ref(false)
  const tempCheckMicAudioBeforeOffering = ref(true)
  const tempYanhe2CaptionMode = ref<Yanhe2CaptionMode>('auto')
  const tempYanhe2CaptionOffsetSeconds = ref(YANHE2_CAPTION_OFFSET_DEFAULT)
  const tempResumeFromServerProgress = ref(true)
  const tempResumeFromServerProgressLectures = ref(true)
  const tempPreventSystemSleep = ref(true)
  const tempDeveloperMode = ref(false)
  const tempLogYanhektCatalog = ref(false)
  const tempRememberPassword = ref(true)
  const tempAutoSignIn = ref(true)
  const tempCurrentTermSearchSource = ref<CurrentTermSearchSource>('yanhekt')
  const tempEarlierTermSearchSource = ref<EarlierTermSearchSource>('local-then-online')
  const tempCourseIndexAutoUpdate = ref(true)
  const tempYanhe2SignInWithMain = ref(true)
  const tempCloseToTray = ref(true)

  // Settings the command line can change too (`autoslides config`).
  followOutsideChange(() => configStore.connectionMode, tempConnectionMode)
  followOutsideChange(() => configStore.maxConcurrentDownloads, tempMaxConcurrentDownloads)
  followOutsideChange(() => configStore.downloadMaxWorkers, tempDownloadMaxWorkers)
  followOutsideChange(() => configStore.downloadNumRetries, tempDownloadNumRetries)

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
    tempPreferMicAudioByDefault.value = preferMicAudioByDefault.value
    tempCheckMicAudioBeforeOffering.value = checkMicAudioBeforeOffering.value
    tempYanhe2CaptionMode.value = yanhe2CaptionMode.value
    tempYanhe2CaptionOffsetSeconds.value = yanhe2CaptionOffsetSeconds.value
    tempResumeFromServerProgress.value = resumeFromServerProgress.value
    tempResumeFromServerProgressLectures.value = resumeFromServerProgressLectures.value
    tempPreventSystemSleep.value = preventSystemSleep.value
    tempDeveloperMode.value = developerMode.value
    tempLogYanhektCatalog.value = logYanhektCatalog.value
    tempRememberPassword.value = rememberPassword.value
    tempAutoSignIn.value = autoSignIn.value
    tempCurrentTermSearchSource.value = currentTermSearchSource.value
    tempEarlierTermSearchSource.value = earlierTermSearchSource.value
    tempCourseIndexAutoUpdate.value = courseIndexAutoUpdate.value
    tempYanhe2SignInWithMain.value = yanhe2SignInWithMain.value
    tempCloseToTray.value = closeToTray.value
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

    if (tempPreferMicAudioByDefault.value !== preferMicAudioByDefault.value) {
      const micResult = await window.electronAPI.config.setPreferMicAudioByDefault(tempPreferMicAudioByDefault.value)
      preferMicAudioByDefault.value = micResult.preferMicAudioByDefault ?? false
      // No broadcast event needed: the default is only read when a playback tab
      // opens, and configStore is already kept in sync by config:onUpdate.
    }

    if (tempCheckMicAudioBeforeOffering.value !== checkMicAudioBeforeOffering.value) {
      const checkResult = await window.electronAPI.config.setCheckMicAudioBeforeOffering(tempCheckMicAudioBeforeOffering.value)
      checkMicAudioBeforeOffering.value = checkResult.checkMicAudioBeforeOffering ?? true
      // Open players follow through configStore (see useMicAudioCheck).
    }

    // An emptied number field reads as '' — keep the saved offset then.
    const captionOffset = Number(tempYanhe2CaptionOffsetSeconds.value)
    const nextCaptionOffset = Number.isFinite(captionOffset) && String(tempYanhe2CaptionOffsetSeconds.value) !== ''
      ? captionOffset
      : yanhe2CaptionOffsetSeconds.value
    if (tempYanhe2CaptionMode.value !== yanhe2CaptionMode.value || nextCaptionOffset !== yanhe2CaptionOffsetSeconds.value) {
      const captionResult = await window.electronAPI.config.setYanhe2Captions(tempYanhe2CaptionMode.value, nextCaptionOffset)
      yanhe2CaptionMode.value = captionResult.yanhe2CaptionMode ?? 'auto'
      yanhe2CaptionOffsetSeconds.value = captionResult.yanhe2CaptionOffsetSeconds ?? YANHE2_CAPTION_OFFSET_DEFAULT
    }
    tempYanhe2CaptionOffsetSeconds.value = yanhe2CaptionOffsetSeconds.value

    // Both resume toggles are read when a lecture opens, so — like the mic
    // default above — configStore's own config:onUpdate sync is enough.
    if (tempResumeFromServerProgress.value !== resumeFromServerProgress.value) {
      const resumeResult = await window.electronAPI.config.setResumeFromServerProgress(tempResumeFromServerProgress.value)
      resumeFromServerProgress.value = resumeResult.resumeFromServerProgress ?? true
    }

    if (tempResumeFromServerProgressLectures.value !== resumeFromServerProgressLectures.value) {
      const resumeLecturesResult = await window.electronAPI.config.setResumeFromServerProgressLectures(tempResumeFromServerProgressLectures.value)
      resumeFromServerProgressLectures.value = resumeLecturesResult.resumeFromServerProgressLectures ?? true
    }

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
        await window.electronAPI.powerManagement.preventSleep('settings')
      } else {
        await window.electronAPI.powerManagement.allowSleep('settings')
      }
    }

    if (tempDeveloperMode.value !== developerMode.value) {
      const developerResult = await window.electronAPI.config.setDeveloperMode(tempDeveloperMode.value)
      developerMode.value = developerResult.developerMode ?? false
      // Turning Developer mode off clears the catalog flag in main.
      logYanhektCatalog.value = developerResult.logYanhektCatalog ?? false
    }

    if (!tempDeveloperMode.value) tempLogYanhektCatalog.value = false
    if (tempLogYanhektCatalog.value !== logYanhektCatalog.value) {
      const catalogResult = await window.electronAPI.config.setLogYanhektCatalog(tempLogYanhektCatalog.value)
      logYanhektCatalog.value = catalogResult.logYanhektCatalog ?? false
    }

    if (tempRememberPassword.value !== rememberPassword.value) {
      const rememberResult = await window.electronAPI.config.setRememberPassword(tempRememberPassword.value)
      rememberPassword.value = rememberResult.rememberPassword ?? true
    }

    if (
      tempCurrentTermSearchSource.value !== currentTermSearchSource.value
      || tempEarlierTermSearchSource.value !== earlierTermSearchSource.value
      || tempCourseIndexAutoUpdate.value !== courseIndexAutoUpdate.value
    ) {
      const searchResult = await window.electronAPI.config.setSearchSettings({
        currentTermSource: tempCurrentTermSearchSource.value,
        earlierTermSource: tempEarlierTermSearchSource.value,
        courseIndexAutoUpdate: tempCourseIndexAutoUpdate.value,
      })
      currentTermSearchSource.value = normalizeCurrentTermSearchSource(searchResult.currentTermSearchSource)
      earlierTermSearchSource.value = normalizeEarlierTermSearchSource(searchResult.earlierTermSearchSource)
      courseIndexAutoUpdate.value = searchResult.courseIndexAutoUpdate ?? true
    }

    if (tempAutoSignIn.value !== autoSignIn.value) {
      const autoSignInResult = await window.electronAPI.config.setAutoSignIn(tempAutoSignIn.value)
      autoSignIn.value = autoSignInResult.autoSignIn ?? true
    }

    if (tempYanhe2SignInWithMain.value !== yanhe2SignInWithMain.value) {
      const yanhe2Result = await window.electronAPI.config.setYanhe2SignInWithMain(tempYanhe2SignInWithMain.value)
      yanhe2SignInWithMain.value = yanhe2Result.yanhe2SignInWithMain ?? true
    }

    if (tempCloseToTray.value !== closeToTray.value) {
      const trayResult = await window.electronAPI.config.setCloseToTray(tempCloseToTray.value)
      closeToTray.value = trayResult.closeToTray ?? true
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
    tempPreferMicAudioByDefault,
    tempCheckMicAudioBeforeOffering,
    tempYanhe2CaptionMode,
    tempYanhe2CaptionOffsetSeconds,
    tempResumeFromServerProgress,
    tempResumeFromServerProgressLectures,
    tempPreventSystemSleep,
    tempDeveloperMode,
    tempLogYanhektCatalog,
    tempRememberPassword,
    tempAutoSignIn,
    tempCurrentTermSearchSource,
    tempEarlierTermSearchSource,
    tempCourseIndexAutoUpdate,
    tempYanhe2SignInWithMain,
    tempCloseToTray,

    resetTemp,
    save,

    updateMaxConcurrentDownloads,
    updateDownloadMaxWorkers,
    updateDownloadNumRetries,
    updateVideoRetryCount
  }
}

export type UseGeneralSettingsReturn = ReturnType<typeof useGeneralSettings>
