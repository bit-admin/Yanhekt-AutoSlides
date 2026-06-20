import { ref } from 'vue'
import { ssimThresholdService, type SsimPresetType } from '@shared/services/ssimThresholdService'
import type { AutoCropDetectorMode, AutoCropModelInfoView, DownsamplingPreset } from './settingsTypes'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ImageProcessingSettings');

const AUTO_CROP_DEFAULTS = {
  aspectTolerance: 0.05,
  blackThreshold: 20,
  maxBorderFrac: 0.10,
  cannyLowThreshold: 20,
  cannyHighThreshold: 60,
  areaRatioMin: 0.08,
  areaRatioMax: 0.95,
  marginFrac: 0.02,
  fillRatioMin: 0.85
}

const AUTO_CROP_YOLO_DEFAULTS = {
  mode: 'canny_then_yolo' as AutoCropDetectorMode,
  confidenceThreshold: 0.25,
  iouThreshold: 0.45,
  inputSize: 640
}

export function useImageProcessingSettings() {
  // SSIM / pHash
  const ssimThreshold = ref(0.9987)
  const tempSsimThreshold = ref(0.9987)
  const ssimPreset = ref<SsimPresetType>('adaptive')
  const pHashThreshold = ref(10)
  const tempPHashThreshold = ref(10)

  // Slide detection (lives in slideExtraction config)
  const slideCheckInterval = ref(2000)
  const tempSlideCheckInterval = ref(2000)
  const slideDoubleVerification = ref(true)
  const tempSlideDoubleVerification = ref(true)
  const slideVerificationCount = ref(2)
  const tempSlideVerificationCount = ref(2)

  // Auto post-processing
  const autoPostProcessing = ref(true)
  const tempAutoPostProcessing = ref(true)
  const autoPostProcessingLive = ref(true)
  const tempAutoPostProcessingLive = ref(true)

  // Post-processing phases
  const enableDuplicateRemoval = ref(true)
  const tempEnableDuplicateRemoval = ref(true)
  const enableExclusionList = ref(true)
  const tempEnableExclusionList = ref(true)

  // Downsampling
  const enableDownsampling = ref(true)
  const tempEnableDownsampling = ref(true)
  const downsampleWidth = ref(480)
  const tempDownsampleWidth = ref(480)
  const downsampleHeight = ref(270)
  const tempDownsampleHeight = ref(270)
  const selectedDownsamplingPreset = ref('480x270')
  const tempSelectedDownsamplingPreset = ref('480x270')
  const downsamplingPresets: DownsamplingPreset[] = [
    { key: '320x180', label: '320x180', width: 320, height: 180 },
    { key: '480x270', label: '480x270', width: 480, height: 270 },
    { key: '640x360', label: '640x360', width: 640, height: 360 },
    { key: '800x450', label: '800x450', width: 800, height: 450 }
  ]

  // PNG color reduction
  const enablePngColorReduction = ref(true)
  const tempEnablePngColorReduction = ref(true)

  // Auto Crop params
  const tempAutoCropAspectTolerance = ref(AUTO_CROP_DEFAULTS.aspectTolerance)
  const tempAutoCropBlackThreshold = ref(AUTO_CROP_DEFAULTS.blackThreshold)
  const tempAutoCropMaxBorderFrac = ref(AUTO_CROP_DEFAULTS.maxBorderFrac)
  const tempAutoCropCannyLowThreshold = ref(AUTO_CROP_DEFAULTS.cannyLowThreshold)
  const tempAutoCropCannyHighThreshold = ref(AUTO_CROP_DEFAULTS.cannyHighThreshold)
  const tempAutoCropAreaRatioMin = ref(AUTO_CROP_DEFAULTS.areaRatioMin)
  const tempAutoCropAreaRatioMax = ref(AUTO_CROP_DEFAULTS.areaRatioMax)
  const tempAutoCropMarginFrac = ref(AUTO_CROP_DEFAULTS.marginFrac)
  const tempAutoCropFillRatioMin = ref(AUTO_CROP_DEFAULTS.fillRatioMin)

  // Auto Crop detector mode + YOLO
  const autoCropYoloInputSizes = [320, 480, 640, 960, 1280]
  const tempAutoCropDetectorMode = ref<AutoCropDetectorMode>(AUTO_CROP_YOLO_DEFAULTS.mode)
  const tempAutoCropYoloConfidenceThreshold = ref(AUTO_CROP_YOLO_DEFAULTS.confidenceThreshold)
  const tempAutoCropYoloIouThreshold = ref(AUTO_CROP_YOLO_DEFAULTS.iouThreshold)
  const tempAutoCropYoloInputSize = ref(AUTO_CROP_YOLO_DEFAULTS.inputSize)

  // Auto Crop model info
  const autoCropModelInfo = ref<AutoCropModelInfoView | null>(null)

  // AI behaviour (lives in slideExtraction config)
  const distinguishMaybeSlide = ref(true)
  const tempDistinguishMaybeSlide = ref(true)

  // Programmatic update flag (shared so SSIM input change doesn't fire feedback)
  let isUpdatingProgrammatically = false

  const refreshAutoCropModelInfo = async (): Promise<void> => {
    try {
      const info = await window.electronAPI.autoCrop.getModelInfo()
      autoCropModelInfo.value = info as AutoCropModelInfoView
    } catch (error) {
      log.error('Failed to load auto-crop model info:', error)
    }
  }

  const selectAutoCropCustomModel = async (): Promise<void> => {
    try {
      const info = await window.electronAPI.autoCrop.selectAndImportModel()
      if (info) {
        autoCropModelInfo.value = info as AutoCropModelInfoView
      }
    } catch (error) {
      log.error('Failed to import custom auto-crop model:', error)
    }
  }

  const deleteAutoCropCustomModel = async (): Promise<void> => {
    try {
      const info = await window.electronAPI.autoCrop.deleteCustomModel()
      autoCropModelInfo.value = info as AutoCropModelInfoView
    } catch (error) {
      log.error('Failed to delete custom auto-crop model:', error)
    }
  }

  // Clamp the edited interval to [500, 10000] on the nearest 500ms step.
  const validateAndCorrectInterval = () => {
    if (isNaN(tempSlideCheckInterval.value) || tempSlideCheckInterval.value === null || tempSlideCheckInterval.value === undefined) {
      tempSlideCheckInterval.value = 2000
      return
    }
    let value = Math.round(tempSlideCheckInterval.value)
    if (value < 500) value = 500
    else if (value > 10000) value = 10000
    const remainder = value % 500
    if (remainder !== 0) {
      value = remainder <= 250 ? value - remainder : value + (500 - remainder)
    }
    if (value < 500) value = 500
    tempSlideCheckInterval.value = value
  }

  const load = async () => {
    try {
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
      const appConfig = await window.electronAPI.config.get()

      slideCheckInterval.value = slideConfig.checkInterval || 2000
      tempSlideCheckInterval.value = slideCheckInterval.value
      slideDoubleVerification.value = slideConfig.enableDoubleVerification !== false
      tempSlideDoubleVerification.value = slideDoubleVerification.value
      slideVerificationCount.value = slideConfig.verificationCount || 2
      tempSlideVerificationCount.value = slideVerificationCount.value

      autoPostProcessing.value = appConfig.autoPostProcessing !== undefined ? appConfig.autoPostProcessing : true
      tempAutoPostProcessing.value = autoPostProcessing.value
      autoPostProcessingLive.value = appConfig.autoPostProcessingLive !== undefined ? appConfig.autoPostProcessingLive : true
      tempAutoPostProcessingLive.value = autoPostProcessingLive.value

      isUpdatingProgrammatically = true
      ssimThreshold.value = slideConfig.ssimThreshold || ssimThresholdService.getThresholdValue('adaptive')
      tempSsimThreshold.value = ssimThreshold.value
      isUpdatingProgrammatically = false

      const savedPresetMode = slideConfig.ssimPresetMode || 'adaptive'
      ssimPreset.value = savedPresetMode

      pHashThreshold.value = slideConfig.pHashThreshold || 10
      tempPHashThreshold.value = pHashThreshold.value

      enableDuplicateRemoval.value = slideConfig.enableDuplicateRemoval !== undefined ? slideConfig.enableDuplicateRemoval : true
      tempEnableDuplicateRemoval.value = enableDuplicateRemoval.value
      enableExclusionList.value = slideConfig.enableExclusionList !== undefined ? slideConfig.enableExclusionList : true
      tempEnableExclusionList.value = enableExclusionList.value

      enableDownsampling.value = slideConfig.enableDownsampling !== undefined ? slideConfig.enableDownsampling : true
      tempEnableDownsampling.value = enableDownsampling.value
      downsampleWidth.value = slideConfig.downsampleWidth || 480
      tempDownsampleWidth.value = downsampleWidth.value
      downsampleHeight.value = slideConfig.downsampleHeight || 270
      tempDownsampleHeight.value = downsampleHeight.value

      enablePngColorReduction.value = slideConfig.enablePngColorReduction !== undefined ? slideConfig.enablePngColorReduction : true
      tempEnablePngColorReduction.value = enablePngColorReduction.value

      const autoCrop = { ...AUTO_CROP_DEFAULTS, ...(slideConfig.autoCrop || {}) }
      tempAutoCropAspectTolerance.value = autoCrop.aspectTolerance
      tempAutoCropBlackThreshold.value = autoCrop.blackThreshold
      tempAutoCropMaxBorderFrac.value = autoCrop.maxBorderFrac
      tempAutoCropCannyLowThreshold.value = autoCrop.cannyLowThreshold
      tempAutoCropCannyHighThreshold.value = autoCrop.cannyHighThreshold
      tempAutoCropAreaRatioMin.value = autoCrop.areaRatioMin
      tempAutoCropAreaRatioMax.value = autoCrop.areaRatioMax
      tempAutoCropMarginFrac.value = autoCrop.marginFrac
      tempAutoCropFillRatioMin.value = autoCrop.fillRatioMin

      tempAutoCropDetectorMode.value =
        (slideConfig.autoCropDetectorMode as AutoCropDetectorMode) ?? AUTO_CROP_YOLO_DEFAULTS.mode
      const yolo = { ...AUTO_CROP_YOLO_DEFAULTS, ...(slideConfig.autoCropYolo || {}) }
      tempAutoCropYoloConfidenceThreshold.value = yolo.confidenceThreshold
      tempAutoCropYoloIouThreshold.value = yolo.iouThreshold
      tempAutoCropYoloInputSize.value = yolo.inputSize

      await refreshAutoCropModelInfo()

      const distinguishValue = await window.electronAPI.config.getDistinguishMaybeSlide()
      distinguishMaybeSlide.value = distinguishValue !== false
      tempDistinguishMaybeSlide.value = distinguishMaybeSlide.value

      const currentPreset = downsamplingPresets.find(preset =>
        preset.width === downsampleWidth.value && preset.height === downsampleHeight.value
      )
      selectedDownsamplingPreset.value = currentPreset ? currentPreset.key : '480x270'
      tempSelectedDownsamplingPreset.value = selectedDownsamplingPreset.value
    } catch (error) {
      log.error('Failed to load image processing config:', error)
    }
  }

  const save = async () => {
    const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
      ssimThreshold: tempSsimThreshold.value,
      ssimPresetMode: ssimPreset.value,
      pHashThreshold: tempPHashThreshold.value,
      enableDownsampling: tempEnableDownsampling.value,
      downsampleWidth: tempDownsampleWidth.value,
      downsampleHeight: tempDownsampleHeight.value,
      enablePngColorReduction: tempEnablePngColorReduction.value
    })
    ssimThreshold.value = imageProcessingResult.ssimThreshold
    pHashThreshold.value = imageProcessingResult.pHashThreshold || tempPHashThreshold.value
    enableDownsampling.value = tempEnableDownsampling.value
    downsampleWidth.value = tempDownsampleWidth.value
    downsampleHeight.value = tempDownsampleHeight.value
    selectedDownsamplingPreset.value = tempSelectedDownsamplingPreset.value
    enablePngColorReduction.value = tempEnablePngColorReduction.value

    await window.electronAPI.config?.setSlideExtractionConfig?.({
      enableDuplicateRemoval: tempEnableDuplicateRemoval.value,
      enableExclusionList: tempEnableExclusionList.value
    })
    enableDuplicateRemoval.value = tempEnableDuplicateRemoval.value
    enableExclusionList.value = tempEnableExclusionList.value

    await window.electronAPI.config.setAutoCropParams({
      aspectTolerance: tempAutoCropAspectTolerance.value,
      blackThreshold: tempAutoCropBlackThreshold.value,
      maxBorderFrac: tempAutoCropMaxBorderFrac.value,
      cannyLowThreshold: tempAutoCropCannyLowThreshold.value,
      cannyHighThreshold: tempAutoCropCannyHighThreshold.value,
      areaRatioMin: tempAutoCropAreaRatioMin.value,
      areaRatioMax: tempAutoCropAreaRatioMax.value,
      marginFrac: tempAutoCropMarginFrac.value,
      fillRatioMin: tempAutoCropFillRatioMin.value
    })

    await window.electronAPI.config.setAutoCropDetectorMode(tempAutoCropDetectorMode.value)
    await window.electronAPI.config.setAutoCropYoloParams({
      confidenceThreshold: tempAutoCropYoloConfidenceThreshold.value,
      iouThreshold: tempAutoCropYoloIouThreshold.value,
      inputSize: tempAutoCropYoloInputSize.value
    })

    await window.electronAPI.config.setDistinguishMaybeSlide(tempDistinguishMaybeSlide.value)
    distinguishMaybeSlide.value = tempDistinguishMaybeSlide.value

    validateAndCorrectInterval()
    const intervalResult = await window.electronAPI.config.setSlideCheckInterval(tempSlideCheckInterval.value)
    slideCheckInterval.value = intervalResult.checkInterval

    const verificationResult = await window.electronAPI.config.setSlideDoubleVerification(
      tempSlideDoubleVerification.value,
      tempSlideVerificationCount.value
    )
    slideDoubleVerification.value = verificationResult.enableDoubleVerification
    slideVerificationCount.value = verificationResult.verificationCount

    const autoPostResult = await window.electronAPI.config.setAutoPostProcessing(tempAutoPostProcessing.value)
    autoPostProcessing.value = autoPostResult.autoPostProcessing
    const autoPostLiveResult = await window.electronAPI.config.setAutoPostProcessingLive(tempAutoPostProcessingLive.value)
    autoPostProcessingLive.value = autoPostLiveResult.autoPostProcessingLive
  }

  const resetTemp = () => {
    isUpdatingProgrammatically = true
    tempSsimThreshold.value = ssimThreshold.value
    tempPHashThreshold.value = pHashThreshold.value
    tempEnableDuplicateRemoval.value = enableDuplicateRemoval.value
    tempEnableExclusionList.value = enableExclusionList.value
    tempEnableDownsampling.value = enableDownsampling.value
    tempDownsampleWidth.value = downsampleWidth.value
    tempDownsampleHeight.value = downsampleHeight.value
    tempSelectedDownsamplingPreset.value = selectedDownsamplingPreset.value
    tempEnablePngColorReduction.value = enablePngColorReduction.value
    tempDistinguishMaybeSlide.value = distinguishMaybeSlide.value
    tempSlideCheckInterval.value = slideCheckInterval.value
    tempSlideDoubleVerification.value = slideDoubleVerification.value
    tempSlideVerificationCount.value = slideVerificationCount.value
    tempAutoPostProcessing.value = autoPostProcessing.value
    tempAutoPostProcessingLive.value = autoPostProcessingLive.value
    isUpdatingProgrammatically = false
  }

  // SSIM preset handling
  const selectDownsamplingPreset = (preset: DownsamplingPreset) => {
    tempSelectedDownsamplingPreset.value = preset.key
    tempDownsampleWidth.value = preset.width
    tempDownsampleHeight.value = preset.height
  }

  const updateImageProcessingParams = () => { /* placeholder — actual save in save() */ }
  const updatePostProcessingPhases = () => { /* placeholder — actual save in save() */ }

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
      log.debug('Adaptive SSIM threshold updated due to classroom rules:', {
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
        log.debug('Classroom-based SSIM threshold saved to config:', imageProcessingResult.ssimThreshold)
      } catch (error) {
        log.error('Failed to save classroom-based SSIM threshold to config:', error)
      }
    }
  }

  return {
    // SSIM / pHash
    ssimThreshold,
    tempSsimThreshold,
    ssimPreset,
    pHashThreshold,
    tempPHashThreshold,

    // Post-processing phases
    enableDuplicateRemoval,
    tempEnableDuplicateRemoval,
    enableExclusionList,
    tempEnableExclusionList,

    // Downsampling
    enableDownsampling,
    tempEnableDownsampling,
    downsampleWidth,
    tempDownsampleWidth,
    downsampleHeight,
    tempDownsampleHeight,
    selectedDownsamplingPreset,
    tempSelectedDownsamplingPreset,
    downsamplingPresets,

    // PNG color reduction
    enablePngColorReduction,
    tempEnablePngColorReduction,

    // Auto Crop
    tempAutoCropAspectTolerance,
    tempAutoCropBlackThreshold,
    tempAutoCropMaxBorderFrac,
    tempAutoCropCannyLowThreshold,
    tempAutoCropCannyHighThreshold,
    tempAutoCropAreaRatioMin,
    tempAutoCropAreaRatioMax,
    tempAutoCropMarginFrac,
    tempAutoCropFillRatioMin,

    // Auto Crop detector mode + YOLO
    tempAutoCropDetectorMode,
    tempAutoCropYoloConfidenceThreshold,
    tempAutoCropYoloIouThreshold,
    tempAutoCropYoloInputSize,
    autoCropYoloInputSizes,

    // Auto Crop custom model
    autoCropModelInfo,
    refreshAutoCropModelInfo,
    selectAutoCropCustomModel,
    deleteAutoCropCustomModel,

    // AI behaviour
    distinguishMaybeSlide,
    tempDistinguishMaybeSlide,

    // Slide detection
    slideCheckInterval,
    tempSlideCheckInterval,
    slideDoubleVerification,
    tempSlideDoubleVerification,
    slideVerificationCount,
    tempSlideVerificationCount,
    validateAndCorrectInterval,

    // Auto post-processing
    autoPostProcessing,
    tempAutoPostProcessing,
    autoPostProcessingLive,
    tempAutoPostProcessingLive,

    // Lifecycle
    load,
    save,
    resetTemp,

    // Methods
    selectDownsamplingPreset,
    updateImageProcessingParams,
    updatePostProcessingPhases,
    onSsimPresetChange,
    onSsimInputChange,
    updateThresholdProgrammatically,
    onAdaptiveThresholdChanged,

    // Programmatic update flag accessor
    get isUpdatingProgrammatically() { return isUpdatingProgrammatically },
    set isUpdatingProgrammatically(value: boolean) { isUpdatingProgrammatically = value }
  }
}

export type UseImageProcessingSettingsReturn = ReturnType<typeof useImageProcessingSettings>
