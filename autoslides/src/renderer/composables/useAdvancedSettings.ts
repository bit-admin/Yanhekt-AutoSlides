import { ref, type Ref } from 'vue'
import { languageService } from '../services/languageService'
import { ssimThresholdService, type SsimPresetType } from '../services/ssimThresholdService'
import { DownloadService } from '../services/downloadService'

export type AdvancedTabId = 'general' | 'imageProcessing' | 'playback' | 'network' | 'ai'

export interface DownsamplingPreset {
  key: string
  label: string
  width: number
  height: number
}

export interface IntranetMapping {
  type: 'single' | 'loadbalance'
  ip?: string
  ips?: string[]
  strategy?: 'round_robin' | 'random' | 'first_available'
  currentIndex?: number
}

export interface UseAdvancedSettingsOptions {
  // From useSettings - we need these refs to sync values
  maxConcurrentDownloads: Ref<number>
  videoRetryCount: Ref<number>
  themeMode: Ref<'system' | 'light' | 'dark'>
  languageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>
  preventSystemSleep: Ref<boolean>
  enableAIFiltering: Ref<boolean>
}

export interface UseAdvancedSettingsReturn {
  // Modal state
  showAdvancedModal: Ref<boolean>
  activeAdvancedTab: Ref<AdvancedTabId>
  advancedSettingsTabs: { id: AdvancedTabId }[]

  // Temp values for modal
  tempMaxConcurrentDownloads: Ref<number>
  tempVideoRetryCount: Ref<number>
  tempThemeMode: Ref<'system' | 'light' | 'dark'>
  tempLanguageMode: Ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>

  // Image processing
  ssimThreshold: Ref<number>
  tempSsimThreshold: Ref<number>
  ssimPreset: Ref<SsimPresetType>
  pHashThreshold: Ref<number>
  tempPHashThreshold: Ref<number>

  // Post-processing phases
  enableDuplicateRemoval: Ref<boolean>
  enableExclusionList: Ref<boolean>

  // Downsampling
  enableDownsampling: Ref<boolean>
  downsampleWidth: Ref<number>
  downsampleHeight: Ref<number>
  selectedDownsamplingPreset: Ref<string>
  downsamplingPresets: DownsamplingPreset[]

  // PNG color reduction
  enablePngColorReduction: Ref<boolean>

  // Intranet mappings
  intranetMappings: Ref<{ [domain: string]: IntranetMapping }>
  expandedMappings: Ref<{ [domain: string]: boolean }>

  // Methods
  openAdvancedSettings: () => Promise<void>
  closeAdvancedSettings: () => void
  saveAdvancedSettings: () => Promise<void>
  loadImageProcessingConfig: () => Promise<void>
  updateImageProcessingParams: () => void
  updatePostProcessingPhases: () => Promise<void>
  selectDownsamplingPreset: (preset: DownsamplingPreset) => void
  onSsimPresetChange: () => void
  onSsimInputChange: () => void
  updateThresholdProgrammatically: (newValue: number) => void
  onAdaptiveThresholdChanged: (event: CustomEvent) => Promise<void>
  loadIntranetMappings: () => Promise<void>
  toggleMappingExpanded: (domain: string) => void
  getStrategyDisplayName: (strategy?: string) => string
  updateMaxConcurrentDownloads: () => void
  updateVideoRetryCount: () => void

  // For programmatic updates
  isUpdatingProgrammatically: boolean
}

export function useAdvancedSettings(
  options: UseAdvancedSettingsOptions,
  onOpenModal?: () => Promise<void>,
  onSaveSettings?: () => Promise<void>,
  t?: (key: string) => string
): UseAdvancedSettingsReturn {
  const {
    maxConcurrentDownloads,
    videoRetryCount,
    themeMode,
    languageMode
  } = options

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

  // Temp values
  const tempMaxConcurrentDownloads = ref(5)
  const tempVideoRetryCount = ref(5)
  const tempThemeMode = ref<'system' | 'light' | 'dark'>('system')
  const tempLanguageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

  // Image processing state
  const ssimThreshold = ref(0.9987)
  const tempSsimThreshold = ref(0.9987)
  const ssimPreset = ref<SsimPresetType>('adaptive')
  const pHashThreshold = ref(10)
  const tempPHashThreshold = ref(10)

  // Post-processing phases
  const enableDuplicateRemoval = ref(true)
  const enableExclusionList = ref(true)

  // Downsampling state
  const enableDownsampling = ref(true)
  const downsampleWidth = ref(480)
  const downsampleHeight = ref(270)
  const selectedDownsamplingPreset = ref('480x270')
  const downsamplingPresets: DownsamplingPreset[] = [
    { key: '320x180', label: '320x180', width: 320, height: 180 },
    { key: '480x270', label: '480x270', width: 480, height: 270 },
    { key: '640x360', label: '640x360', width: 640, height: 360 },
    { key: '800x450', label: '800x450', width: 800, height: 450 }
  ]

  // PNG color reduction state
  const enablePngColorReduction = ref(true)

  // Intranet mappings
  const intranetMappings = ref<{ [domain: string]: IntranetMapping }>({})
  const expandedMappings = ref<{ [domain: string]: boolean }>({})

  // Flag for programmatic updates
  let isUpdatingProgrammatically = false

  // Load image processing config
  const loadImageProcessingConfig = async () => {
    try {
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()

      isUpdatingProgrammatically = true
      ssimThreshold.value = slideConfig.ssimThreshold || ssimThresholdService.getThresholdValue('adaptive')
      tempSsimThreshold.value = ssimThreshold.value
      isUpdatingProgrammatically = false

      const savedPresetMode = slideConfig.ssimPresetMode || 'adaptive'
      ssimPreset.value = savedPresetMode

      pHashThreshold.value = slideConfig.pHashThreshold || 10
      tempPHashThreshold.value = pHashThreshold.value

      enableDuplicateRemoval.value = slideConfig.enableDuplicateRemoval !== undefined ? slideConfig.enableDuplicateRemoval : true
      enableExclusionList.value = slideConfig.enableExclusionList !== undefined ? slideConfig.enableExclusionList : true

      enableDownsampling.value = slideConfig.enableDownsampling !== undefined ? slideConfig.enableDownsampling : true
      downsampleWidth.value = slideConfig.downsampleWidth || 480
      downsampleHeight.value = slideConfig.downsampleHeight || 270

      // PNG color reduction
      enablePngColorReduction.value = slideConfig.enablePngColorReduction !== undefined ? slideConfig.enablePngColorReduction : true

      const currentPreset = downsamplingPresets.find(preset =>
        preset.width === downsampleWidth.value && preset.height === downsampleHeight.value
      )
      selectedDownsamplingPreset.value = currentPreset ? currentPreset.key : '480x270'
    } catch (error) {
      console.error('Failed to load image processing config:', error)
    }
  }

  // Open modal
  const openAdvancedSettings = async () => {
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    tempVideoRetryCount.value = videoRetryCount.value
    tempThemeMode.value = themeMode.value
    tempLanguageMode.value = languageMode.value

    isUpdatingProgrammatically = true
    tempSsimThreshold.value = ssimThreshold.value
    tempPHashThreshold.value = pHashThreshold.value
    isUpdatingProgrammatically = false

    await loadIntranetMappings()

    // Call additional setup callback
    if (onOpenModal) {
      await onOpenModal()
    }

    showAdvancedModal.value = true
  }

  // Close modal
  const closeAdvancedSettings = () => {
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    tempVideoRetryCount.value = videoRetryCount.value
    tempSsimThreshold.value = ssimThreshold.value
    tempPHashThreshold.value = pHashThreshold.value
    tempThemeMode.value = themeMode.value
    tempLanguageMode.value = languageMode.value
    showAdvancedModal.value = false
  }

  // Save settings
  const saveAdvancedSettings = async () => {
    try {
      // Save concurrent downloads
      const downloadResult = await window.electronAPI.config.setMaxConcurrentDownloads(tempMaxConcurrentDownloads.value)
      maxConcurrentDownloads.value = downloadResult.maxConcurrentDownloads

      // Save video retry count
      const retryResult = await window.electronAPI.config.setVideoRetryCount(tempVideoRetryCount.value)
      videoRetryCount.value = retryResult.videoRetryCount

      // Save image processing parameters
      const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
        ssimThreshold: tempSsimThreshold.value,
        ssimPresetMode: ssimPreset.value,
        pHashThreshold: tempPHashThreshold.value,
        enableDownsampling: enableDownsampling.value,
        downsampleWidth: downsampleWidth.value,
        downsampleHeight: downsampleHeight.value,
        enablePngColorReduction: enablePngColorReduction.value
      })
      ssimThreshold.value = imageProcessingResult.ssimThreshold
      pHashThreshold.value = imageProcessingResult.pHashThreshold || tempPHashThreshold.value

      // Save theme mode
      if (tempThemeMode.value !== themeMode.value) {
        const themeResult = await window.electronAPI.config.setThemeMode(tempThemeMode.value)
        themeMode.value = themeResult.themeMode
      }

      // Save language mode
      if (tempLanguageMode.value !== languageMode.value) {
        const langResult = await window.electronAPI.config.setLanguageMode(tempLanguageMode.value)
        languageMode.value = langResult.languageMode
        await languageService.setLanguageMode(tempLanguageMode.value)
      }

      // Call additional save callback (for AI settings, etc.)
      if (onSaveSettings) {
        await onSaveSettings()
      }

      // Update download service
      DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)

      showAdvancedModal.value = false
    } catch (error) {
      console.error('Failed to save advanced settings:', error)
      alert('Failed to save settings')
    }
  }

  // Image processing methods
  const updateImageProcessingParams = () => {
    // Placeholder - actual save happens in saveAdvancedSettings
  }

  const updatePostProcessingPhases = async () => {
    try {
      await window.electronAPI.config?.setSlideExtractionConfig?.({
        enableDuplicateRemoval: enableDuplicateRemoval.value,
        enableExclusionList: enableExclusionList.value
      })
      console.log('Post-processing phases updated:', {
        enableDuplicateRemoval: enableDuplicateRemoval.value,
        enableExclusionList: enableExclusionList.value
      })
    } catch (error) {
      console.error('Failed to update post-processing phases:', error)
    }
  }

  const selectDownsamplingPreset = (preset: DownsamplingPreset) => {
    selectedDownsamplingPreset.value = preset.key
    downsampleWidth.value = preset.width
    downsampleHeight.value = preset.height
    updateImageProcessingParams()
  }

  // SSIM preset handling
  const onSsimPresetChange = () => {
    if (ssimPreset.value !== 'custom') {
      isUpdatingProgrammatically = true
      tempSsimThreshold.value = ssimThresholdService.getThresholdValue(ssimPreset.value)
      isUpdatingProgrammatically = false
      updateImageProcessingParams()
    }
  }

  const onSsimInputChange = () => {
    if (!isUpdatingProgrammatically) {
      const value = tempSsimThreshold.value
      const detectedPreset = ssimThresholdService.getPresetFromValue(value)

      if (ssimPreset.value === 'adaptive' && detectedPreset !== 'adaptive') {
        if (detectedPreset !== 'custom') {
          ssimPreset.value = detectedPreset
        } else {
          ssimPreset.value = 'custom'
        }
      } else {
        ssimPreset.value = detectedPreset
      }
    }
  }

  const updateThresholdProgrammatically = (newValue: number) => {
    isUpdatingProgrammatically = true
    tempSsimThreshold.value = newValue
    isUpdatingProgrammatically = false
  }

  const onAdaptiveThresholdChanged = async (event: CustomEvent) => {
    const { newThreshold, classrooms } = event.detail

    if (ssimPreset.value === 'adaptive') {
      console.log('Adaptive SSIM threshold updated due to classroom rules:', {
        newThreshold,
        classrooms: classrooms?.map((c: { name: string }) => c.name).join(', ') || 'none'
      })

      updateThresholdProgrammatically(newThreshold)
      ssimThreshold.value = newThreshold

      try {
        const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
          ssimThreshold: newThreshold,
          ssimPresetMode: ssimPreset.value
        })
        console.log('Classroom-based SSIM threshold saved to config:', imageProcessingResult.ssimThreshold)
      } catch (error) {
        console.error('Failed to save classroom-based SSIM threshold to config:', error)
      }
    }
  }

  // Intranet mapping methods
  const loadIntranetMappings = async () => {
    try {
      const mappings = await window.electronAPI.intranet.getMappings()
      intranetMappings.value = mappings
    } catch (error) {
      console.error('Failed to load intranet mappings:', error)
    }
  }

  const toggleMappingExpanded = (domain: string) => {
    expandedMappings.value[domain] = !expandedMappings.value[domain]
  }

  const getStrategyDisplayName = (strategy?: string) => {
    const translate = t || ((key: string) => key)
    switch (strategy) {
      case 'round_robin':
        return translate('advanced.roundRobin')
      case 'random':
        return translate('advanced.random')
      case 'first_available':
        return translate('advanced.firstAvailable')
      default:
        return strategy || translate('advanced.roundRobin')
    }
  }

  const updateMaxConcurrentDownloads = () => {
    // Placeholder - actual save happens in saveAdvancedSettings
  }

  const updateVideoRetryCount = () => {
    // Placeholder - actual save happens in saveAdvancedSettings
  }

  return {
    // Modal state
    showAdvancedModal,
    activeAdvancedTab,
    advancedSettingsTabs,

    // Temp values
    tempMaxConcurrentDownloads,
    tempVideoRetryCount,
    tempThemeMode,
    tempLanguageMode,

    // Image processing
    ssimThreshold,
    tempSsimThreshold,
    ssimPreset,
    pHashThreshold,
    tempPHashThreshold,

    // Post-processing phases
    enableDuplicateRemoval,
    enableExclusionList,

    // Downsampling
    enableDownsampling,
    downsampleWidth,
    downsampleHeight,
    selectedDownsamplingPreset,
    downsamplingPresets,

    // PNG color reduction
    enablePngColorReduction,

    // Intranet mappings
    intranetMappings,
    expandedMappings,

    // Methods
    openAdvancedSettings,
    closeAdvancedSettings,
    saveAdvancedSettings,
    loadImageProcessingConfig,
    updateImageProcessingParams,
    updatePostProcessingPhases,
    selectDownsamplingPreset,
    onSsimPresetChange,
    onSsimInputChange,
    updateThresholdProgrammatically,
    onAdaptiveThresholdChanged,
    loadIntranetMappings,
    toggleMappingExpanded,
    getStrategyDisplayName,
    updateMaxConcurrentDownloads,
    updateVideoRetryCount,

    // For programmatic updates
    get isUpdatingProgrammatically() {
      return isUpdatingProgrammatically
    },
    set isUpdatingProgrammatically(value: boolean) {
      isUpdatingProgrammatically = value
    }
  }
}
