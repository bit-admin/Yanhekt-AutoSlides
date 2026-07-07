import { nextTick, ref, type Ref } from 'vue'
import { useGeneralSettings } from './useGeneralSettings'
import { useImageProcessingSettings } from './useImageProcessingSettings'
import { useNetworkSettings } from './useNetworkSettings'
import { useExtractorSettings } from './useExtractorSettings'
import { useCloudSettings } from './useCloudSettings'
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
  connectionMode: Ref<'internal' | 'external'>
  muteMode: Ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>
  taskSpeed: Ref<number>
  parallelTasks: Ref<number>
  maxManualTabs: Ref<number>
  showMorePlaybackSpeed: Ref<boolean>
  enableAIFiltering: Ref<boolean>
  tempEnableAIFiltering: Ref<boolean>
}

export function useAdvancedSettings(
  options: UseAdvancedSettingsOptions,
  onOpenModal?: () => Promise<void>,
  onSaveSettings?: () => Promise<void>,
  t?: (key: string) => string
) {
  const { enableAIFiltering, tempEnableAIFiltering } = options

  const general = useGeneralSettings(options)
  const imageProcessing = useImageProcessingSettings()
  const network = useNetworkSettings({ t })
  const extractor = useExtractorSettings()
  const cloud = useCloudSettings()

  // The Settings page renders these underline tabs. activeAdvancedTab is shared
  // state so settingsLauncher (and the page) can drive the active tab.
  const activeAdvancedTab = ref<AdvancedTabId>('general')
  const advancedSettingsTabs: { id: AdvancedTabId }[] = [
    { id: 'general' },
    { id: 'imageProcessing' },
    { id: 'playback' },
    { id: 'network' },
    { id: 'ai' },
    { id: 'cloud' }
  ]

  let advancedSettingsOpenRequestId = 0

  // Entering the Settings page: copy config → temp buffers and kick off the
  // async loads (network interfaces, extractor verify, AI/pHash, …). Called by
  // SettingsPage each time the page becomes active.
  const prepareSettings = async () => {
    const requestId = ++advancedSettingsOpenRequestId

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()
    cloud.resetTemp()

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
      cloud.load(),
      onOpenModal ? onOpenModal() : Promise.resolve()
    ])
  }

  // Discard buffered edits (Cancel, or navigating away from the page). Bumps the
  // request id so any in-flight prepare loads are ignored. Idempotent.
  const discardSettings = () => {
    advancedSettingsOpenRequestId++

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()
    cloud.resetTemp()
    tempEnableAIFiltering.value = enableAIFiltering.value
  }

  // Persist buffered edits (Save). Throws are surfaced to the user as today.
  const commitSettings = async () => {
    try {
      await general.save()
      await imageProcessing.save()
      await network.save()
      await extractor.save()
      await cloud.save()

      if (onSaveSettings) {
        await onSaveSettings()
      }
    } catch (error) {
      log.error('Failed to save advanced settings:', error)
      // A mid-sequence failure leaves earlier groups saved — tell the user
      // which error stopped the save instead of failing silently.
      const detail = error instanceof Error ? error.message : String(error)
      void window.electronAPI.dialog?.showErrorBox?.('Settings', `Failed to save settings: ${detail}`)
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
    cloud,

    // Settings-page lifecycle
    prepareSettings,
    discardSettings,
    commitSettings
  }
}

export type UseAdvancedSettingsReturn = ReturnType<typeof useAdvancedSettings>
