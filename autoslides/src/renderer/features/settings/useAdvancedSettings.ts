import type { CurrentTermSearchSource, EarlierTermSearchSource } from '@common/searchSources'
import { nextTick, ref, type Ref } from 'vue'
import type { ConnectionMode, Yanhe2CaptionMode } from '@common/types'
import { useGeneralSettings } from './useGeneralSettings'
import { useImageProcessingSettings } from './useImageProcessingSettings'
import { useNetworkSettings } from './useNetworkSettings'
import { useExtractorSettings } from './useExtractorSettings'
import { useAddonsSettings } from './useAddonsSettings'
import type {
  AdvancedTabId,
  AutoCropDetectorMode,
  AutoCropModelInfoView,
  DownsamplingPreset,
  IntranetMapping,
  NetworkInterfaceInfo
} from './settingsTypes'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('AdvancedSettings');

export type {
  AdvancedTabId,
  AutoCropDetectorMode,
  AutoCropModelInfoView,
  DownsamplingPreset,
  IntranetMapping,
  NetworkInterfaceInfo
}

export interface UseAdvancedSettingsOptions {
  maxConcurrentDownloads: Ref<number>
  downloadMaxWorkers: Ref<number>
  downloadNumRetries: Ref<number>
  videoRetryCount: Ref<number>
  videoTokenRefreshSeconds: Ref<number>
  previewFromVideo: Ref<boolean>
  previewSeekSeconds: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>
  preventSystemSleep: Ref<boolean>
  connectionMode: Ref<ConnectionMode>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>
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
  developerMode: Ref<boolean>
  logYanhektCatalog: Ref<boolean>
  rememberPassword: Ref<boolean>
  autoSignIn: Ref<boolean>
  currentTermSearchSource: Ref<CurrentTermSearchSource>
  earlierTermSearchSource: Ref<EarlierTermSearchSource>
  courseIndexAutoUpdate: Ref<boolean>
  courseCloudSync: Ref<boolean>
  yanhe2SignInWithMain: Ref<boolean>
  closeToTray: Ref<boolean>
  enableAIFiltering: Ref<boolean>
  tempEnableAIFiltering: Ref<boolean>
}

export function useAdvancedSettings(
  options: UseAdvancedSettingsOptions,
  onOpenModal?: () => Promise<void>,
  onSaveSettings?: () => Promise<void>,
  t?: (key: string, params?: Record<string, unknown>) => string
) {
  const { enableAIFiltering, tempEnableAIFiltering } = options

  const general = useGeneralSettings(options)
  const imageProcessing = useImageProcessingSettings()
  const network = useNetworkSettings({ t })
  const extractor = useExtractorSettings()
  const addons = useAddonsSettings()

  // The Settings page renders these underline tabs. activeAdvancedTab is shared
  // state so settingsLauncher (and the page) can drive the active tab.
  const activeAdvancedTab = ref<AdvancedTabId>('general')
  const advancedSettingsTabs: { id: AdvancedTabId }[] = [
    { id: 'general' },
    { id: 'imageProcessing' },
    { id: 'playback' },
    { id: 'network' },
    { id: 'ai' },
    { id: 'addons' }
  ]

  let advancedSettingsOpenRequestId = 0
  let committing = false
  let discardAfterCommit = false
  let commitInFlight: Promise<void> = Promise.resolve()

  // Entering the Settings page: copy config → temp buffers and kick off the
  // async loads (network interfaces, extractor verify, AI/pHash, …). Called by
  // SettingsPage each time the page becomes active.
  const prepareSettings = async () => {
    // A save reads its drafts group by group: never reset them under it.
    await commitInFlight
    const requestId = ++advancedSettingsOpenRequestId

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()
    addons.resetTemp()

    await nextTick()

    const shouldContinue = () => requestId === advancedSettingsOpenRequestId

    await Promise.all([
      imageProcessing.load(),
      network.load(),
      extractor.load().then(() => {
        if (shouldContinue()) {
          void extractor.qtExtractorVerify()
        }
      }).catch((err) => {
        // Isolate extractor load/verify failure so it does not reject the
        // whole Promise.all and abort the other settings loads.
        log.error('Failed to load extractor settings:', err)
      }),
      addons.load(),
      onOpenModal ? onOpenModal() : Promise.resolve()
    ])
  }

  // Discard buffered edits when navigating away from the page. Only a partial
  // reset (AI tab and auto-crop temps are re-seeded by the next prepare), so
  // in-page Cancel calls prepareSettings instead. Bumps the request id so any
  // in-flight prepare loads are ignored. Idempotent.
  const discardSettings = () => {
    if (committing) {
      discardAfterCommit = true
      return
    }
    advancedSettingsOpenRequestId++

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()
    addons.resetTemp()
    tempEnableAIFiltering.value = enableAIFiltering.value
  }

  // Persist buffered edits (Save). The groups are independent writes, so a
  // failure part-way says which were saved. Leaving the page meanwhile waits
  // for the save, because each group reads its drafts only when it is reached.
  const commitSettings = async () => {
    committing = true
    let finishCommit = () => {}
    commitInFlight = new Promise<void>((resolve) => { finishCommit = resolve })
    const groups: Array<[AdvancedTabId, () => Promise<unknown>]> = [
      ['general', general.save],
      ['imageProcessing', imageProcessing.save],
      ['network', network.save],
      ['playback', extractor.save],
      ['addons', addons.save],
    ]
    const saved: AdvancedTabId[] = []
    let current: AdvancedTabId = 'general'
    try {
      for (const [tab, save] of groups) {
        current = tab
        await save()
        saved.push(tab)
      }
      current = 'ai'
      if (onSaveSettings) await onSaveSettings()
    } catch (error) {
      log.error('Failed to save advanced settings:', error)
      // Rethrow so the Settings footer does not flash "Applied" after a failed commit.
      const detail = error instanceof Error ? error.message : String(error)
      const name = (tab: AdvancedTabId) => t?.(`advanced.tabs.${tab}`) ?? tab
      const message = saved.length > 0
        ? t?.('advanced.savePartial', { saved: saved.map(name).join(', '), failed: name(current) }) ?? 'Some settings were saved.'
        : t?.('advanced.saveFailed', { failed: name(current) }) ?? 'Settings were not saved.'
      void window.electronAPI.dialog?.showErrorBox?.(t?.('advanced.saveFailedTitle') ?? 'Settings', `${message}\n\n${detail}`)
      throw error
    } finally {
      committing = false
      finishCommit()
      if (discardAfterCommit) {
        discardAfterCommit = false
        discardSettings()
      }
    }
  }

  return {
    // Settings-page tab state
    activeAdvancedTab,
    advancedSettingsTabs,

    // Sub-composables — consumers destructure the group they need instead of
    // this facade re-exporting ~100 individual keys.
    general,
    imageProcessing,
    network,
    extractor,
    addons,

    // Settings-page lifecycle
    prepareSettings,
    discardSettings,
    commitSettings
  }
}

export type UseAdvancedSettingsReturn = ReturnType<typeof useAdvancedSettings>
