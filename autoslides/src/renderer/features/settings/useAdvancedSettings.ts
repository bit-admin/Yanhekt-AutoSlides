import { nextTick, ref, type Ref } from 'vue'
import { useGeneralSettings } from './useGeneralSettings'
import { useImageProcessingSettings } from './useImageProcessingSettings'
import { useNetworkSettings } from './useNetworkSettings'
import { useExtractorSettings } from './useExtractorSettings'
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

  // Modal state
  const showAdvancedModal = ref(false)
  const activeAdvancedTab = ref<AdvancedTabId>('general')
  const advancedSettingsTabs: { id: AdvancedTabId }[] = [
    { id: 'general' },
    { id: 'imageProcessing' },
    { id: 'playback' },
    { id: 'network' },
    { id: 'ai' }
  ]

  let advancedSettingsOpenRequestId = 0

  const openAdvancedSettings = async () => {
    const requestId = ++advancedSettingsOpenRequestId

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()

    showAdvancedModal.value = true

    await nextTick()

    const shouldContinue = () => requestId === advancedSettingsOpenRequestId && showAdvancedModal.value

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
      onOpenModal ? onOpenModal() : Promise.resolve()
    ])
  }

  const closeAdvancedSettings = () => {
    advancedSettingsOpenRequestId++

    general.resetTemp()
    imageProcessing.resetTemp()
    network.resetTemp()
    extractor.resetTemp()
    tempEnableAIFiltering.value = enableAIFiltering.value

    showAdvancedModal.value = false
  }

  const saveAdvancedSettings = async () => {
    try {
      await general.save()
      await imageProcessing.save()
      await network.save()
      await extractor.save()

      if (onSaveSettings) {
        await onSaveSettings()
      }

      showAdvancedModal.value = false
    } catch (error) {
      log.error('Failed to save advanced settings:', error)
      alert('Failed to save settings')
    }
  }

  return {
    // Modal state
    showAdvancedModal,
    activeAdvancedTab,
    advancedSettingsTabs,

    // General settings (concurrency, retries, theme, language)
    tempMaxConcurrentDownloads: general.tempMaxConcurrentDownloads,
    tempDownloadMaxWorkers: general.tempDownloadMaxWorkers,
    tempDownloadNumRetries: general.tempDownloadNumRetries,
    tempVideoRetryCount: general.tempVideoRetryCount,
    tempPreviewFromVideo: general.tempPreviewFromVideo,
    tempPreviewSeekSeconds: general.tempPreviewSeekSeconds,
    tempThemeMode: general.tempThemeMode,
    tempLanguageMode: general.tempLanguageMode,
    tempConnectionMode: general.tempConnectionMode,
    tempMuteMode: general.tempMuteMode,
    tempTaskSpeed: general.tempTaskSpeed,
    tempParallelTasks: general.tempParallelTasks,
    tempMaxManualTabs: general.tempMaxManualTabs,
    tempShowMorePlaybackSpeed: general.tempShowMorePlaybackSpeed,
    tempPreventSystemSleep: general.tempPreventSystemSleep,
    updateMaxConcurrentDownloads: general.updateMaxConcurrentDownloads,
    updateDownloadMaxWorkers: general.updateDownloadMaxWorkers,
    updateDownloadNumRetries: general.updateDownloadNumRetries,
    updateVideoRetryCount: general.updateVideoRetryCount,

    // Image processing
    ssimThreshold: imageProcessing.ssimThreshold,
    tempSsimThreshold: imageProcessing.tempSsimThreshold,
    ssimPreset: imageProcessing.ssimPreset,
    pHashThreshold: imageProcessing.pHashThreshold,
    tempPHashThreshold: imageProcessing.tempPHashThreshold,
    enableDuplicateRemoval: imageProcessing.enableDuplicateRemoval,
    tempEnableDuplicateRemoval: imageProcessing.tempEnableDuplicateRemoval,
    enableExclusionList: imageProcessing.enableExclusionList,
    tempEnableExclusionList: imageProcessing.tempEnableExclusionList,
    enableDownsampling: imageProcessing.enableDownsampling,
    tempEnableDownsampling: imageProcessing.tempEnableDownsampling,
    downsampleWidth: imageProcessing.downsampleWidth,
    tempDownsampleWidth: imageProcessing.tempDownsampleWidth,
    downsampleHeight: imageProcessing.downsampleHeight,
    tempDownsampleHeight: imageProcessing.tempDownsampleHeight,
    selectedDownsamplingPreset: imageProcessing.selectedDownsamplingPreset,
    tempSelectedDownsamplingPreset: imageProcessing.tempSelectedDownsamplingPreset,
    downsamplingPresets: imageProcessing.downsamplingPresets,
    enablePngColorReduction: imageProcessing.enablePngColorReduction,
    tempEnablePngColorReduction: imageProcessing.tempEnablePngColorReduction,
    tempAutoCropAspectTolerance: imageProcessing.tempAutoCropAspectTolerance,
    tempAutoCropBlackThreshold: imageProcessing.tempAutoCropBlackThreshold,
    tempAutoCropMaxBorderFrac: imageProcessing.tempAutoCropMaxBorderFrac,
    tempAutoCropCannyLowThreshold: imageProcessing.tempAutoCropCannyLowThreshold,
    tempAutoCropCannyHighThreshold: imageProcessing.tempAutoCropCannyHighThreshold,
    tempAutoCropAreaRatioMin: imageProcessing.tempAutoCropAreaRatioMin,
    tempAutoCropAreaRatioMax: imageProcessing.tempAutoCropAreaRatioMax,
    tempAutoCropMarginFrac: imageProcessing.tempAutoCropMarginFrac,
    tempAutoCropFillRatioMin: imageProcessing.tempAutoCropFillRatioMin,
    tempAutoCropDetectorMode: imageProcessing.tempAutoCropDetectorMode,
    tempAutoCropYoloConfidenceThreshold: imageProcessing.tempAutoCropYoloConfidenceThreshold,
    tempAutoCropYoloIouThreshold: imageProcessing.tempAutoCropYoloIouThreshold,
    tempAutoCropYoloInputSize: imageProcessing.tempAutoCropYoloInputSize,
    autoCropYoloInputSizes: imageProcessing.autoCropYoloInputSizes,
    autoCropModelInfo: imageProcessing.autoCropModelInfo,
    refreshAutoCropModelInfo: imageProcessing.refreshAutoCropModelInfo,
    selectAutoCropCustomModel: imageProcessing.selectAutoCropCustomModel,
    deleteAutoCropCustomModel: imageProcessing.deleteAutoCropCustomModel,
    distinguishMaybeSlide: imageProcessing.distinguishMaybeSlide,
    tempDistinguishMaybeSlide: imageProcessing.tempDistinguishMaybeSlide,
    tempSlideCheckInterval: imageProcessing.tempSlideCheckInterval,
    tempSlideDoubleVerification: imageProcessing.tempSlideDoubleVerification,
    tempSlideVerificationCount: imageProcessing.tempSlideVerificationCount,
    validateAndCorrectInterval: imageProcessing.validateAndCorrectInterval,
    tempAutoPostProcessing: imageProcessing.tempAutoPostProcessing,
    tempAutoPostProcessingLive: imageProcessing.tempAutoPostProcessingLive,
    loadImageProcessingConfig: imageProcessing.load,
    selectDownsamplingPreset: imageProcessing.selectDownsamplingPreset,
    updateImageProcessingParams: imageProcessing.updateImageProcessingParams,
    updatePostProcessingPhases: imageProcessing.updatePostProcessingPhases,
    onSsimPresetChange: imageProcessing.onSsimPresetChange,
    onSsimInputChange: imageProcessing.onSsimInputChange,
    updateThresholdProgrammatically: imageProcessing.updateThresholdProgrammatically,
    onAdaptiveThresholdChanged: imageProcessing.onAdaptiveThresholdChanged,

    // Network
    intranetMappings: network.intranetMappings,
    expandedMappings: network.expandedMappings,
    availableNetworkInterfaces: network.availableNetworkInterfaces,
    intranetInterfaceIp: network.intranetInterfaceIp,
    tempIntranetInterfaceIp: network.tempIntranetInterfaceIp,
    intranetInterfaceWarning: network.intranetInterfaceWarning,
    refreshNetworkInterfaces: network.refreshNetworkInterfaces,
    loadIntranetMappings: network.loadIntranetMappings,
    toggleMappingExpanded: network.toggleMappingExpanded,
    getStrategyDisplayName: network.getStrategyDisplayName,

    // Qt Extractor
    qtExtractorAutoRun: extractor.qtExtractorAutoRun,
    tempQtExtractorAutoRun: extractor.tempQtExtractorAutoRun,
    qtExtractorAutoPostProcess: extractor.qtExtractorAutoPostProcess,
    tempQtExtractorAutoPostProcess: extractor.tempQtExtractorAutoPostProcess,
    qtExtractorBinaryPath: extractor.qtExtractorBinaryPath,
    qtExtractorResolvedPath: extractor.qtExtractorResolvedPath,
    qtExtractorStatusOk: extractor.qtExtractorStatusOk,
    qtExtractorStatusVersion: extractor.qtExtractorStatusVersion,
    qtExtractorStatusError: extractor.qtExtractorStatusError,
    qtExtractorVerifying: extractor.qtExtractorVerifying,
    showExtractorInstallModal: extractor.showExtractorInstallModal,
    loadQtExtractorConfig: extractor.loadQtExtractorConfig,
    qtExtractorVerify: extractor.qtExtractorVerify,
    qtExtractorBrowseBinary: extractor.qtExtractorBrowseBinary,
    openExtractorInstallModal: extractor.openExtractorInstallModal,
    closeExtractorInstallModal: extractor.closeExtractorInstallModal,

    // Top-level methods
    openAdvancedSettings,
    closeAdvancedSettings,
    saveAdvancedSettings,

    // Programmatic update flag (forwarded from imageProcessing)
    get isUpdatingProgrammatically() { return imageProcessing.isUpdatingProgrammatically },
    set isUpdatingProgrammatically(value: boolean) { imageProcessing.isUpdatingProgrammatically = value }
  }
}

export type UseAdvancedSettingsReturn = ReturnType<typeof useAdvancedSettings>
