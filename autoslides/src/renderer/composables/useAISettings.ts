import { ref, computed, watch } from 'vue'
import type { TokenManager } from '../services/authService'
import { useCopilotOAuth, type CopilotOAuthStep } from './ai/useCopilotOAuth'
import { useMlClassifierSettings, type AIClassifierMode, type MlThresholdValues, type MlModelInfo } from './ai/useMlClassifierSettings'
import { useModelChain, type ModelPreset } from './ai/useModelChain'
import { detectCustomProvider, MODELSCOPE_API_BASE_URL, type CustomProviderId } from './ai/providerDetect'

export type AIServiceType = 'builtin' | 'custom' | 'copilot'
export type { AIClassifierMode, CustomProviderId, CopilotOAuthStep, MlThresholdValues, MlModelInfo, ModelPreset }
export { MODELSCOPE_API_BASE_URL }

export interface ApiUrlPreset {
  id: CustomProviderId
  label: string
  url: string
}

export interface ImageResizePreset {
  key: string
  label: string
  width: number
  height: number
}

export interface UseAISettingsOptions {
  tokenManager: TokenManager
}

export function useAISettings(options: UseAISettingsOptions) {
  const { tokenManager } = options

  // Service type
  const aiServiceType = ref<AIServiceType>('builtin')
  const tempAiServiceType = ref<AIServiceType>('builtin')

  // Custom API settings
  const aiCustomApiBaseUrl = ref('')
  const tempAiCustomApiBaseUrl = ref('')
  const aiCustomApiKey = ref('')
  const tempAiCustomApiKey = ref('')
  const aiCustomModelName = ref('')
  const tempAiCustomModelName = ref('')
  const showApiKey = ref(false)

  // Rate limit and batch size
  const aiRateLimit = ref(10)
  const tempAiRateLimit = ref(10)
  const aiBatchSize = ref(4)
  const tempAiBatchSize = ref(4)

  // Concurrency control
  const aiMaxConcurrent = ref(1)
  const tempAiMaxConcurrent = ref(1)
  const aiMinTime = ref(6000)
  const tempAiMinTime = ref(6000)

  const maxAiRateLimit = computed(() => {
    return tempAiServiceType.value === 'builtin' ? 10 : 60
  })

  // Image resize settings
  const aiImageResizeWidth = ref(768)
  const tempAiImageResizeWidth = ref(768)
  const aiImageResizeHeight = ref(432)
  const tempAiImageResizeHeight = ref(432)
  const selectedImageResizePreset = ref('768x432')

  const imageResizePresets: ImageResizePreset[] = [
    { key: '512x288', label: '512x288', width: 512, height: 288 },
    { key: '768x432', label: '768x432', width: 768, height: 432 },
    { key: '1024x576', label: '1024x576', width: 1024, height: 576 },
    { key: '1920x1080', label: '1920x1080', width: 1920, height: 1080 }
  ]

  // AI prompts — simple variant
  const aiPromptLive = ref('')
  const tempAiPromptLive = ref('')
  const aiPromptRecorded = ref('')
  const tempAiPromptRecorded = ref('')

  // AI prompts — distinguish variant
  const aiPromptLiveDistinguish = ref('')
  const tempAiPromptLiveDistinguish = ref('')
  const aiPromptRecordedDistinguish = ref('')
  const tempAiPromptRecordedDistinguish = ref('')

  // Built-in model info
  const builtinModelName = ref('')
  const isLoadingBuiltinModel = ref(false)
  const builtinModelError = ref('')

  // Presets
  const apiUrlPresets: ApiUrlPreset[] = [
    { id: 'modelscope', label: 'ModelScope', url: MODELSCOPE_API_BASE_URL },
    { id: 'lm_studio', label: 'LM Studio', url: 'http://localhost:1234/v1' }
  ]

  const modelPresetsByProvider: Record<CustomProviderId, ModelPreset[]> = {
    modelscope: [
      { label: 'Qwen3.5-397B-A17B', name: 'Qwen/Qwen3.5-397B-A17B' },
      { label: 'Qwen3.5-122B-A10B', name: 'Qwen/Qwen3.5-122B-A10B' },
      { label: 'Qwen3.5-35B-A3B', name: 'Qwen/Qwen3.5-35B-A3B' },
      { label: 'Qwen3.5-27B', name: 'Qwen/Qwen3.5-27B' },
      { label: 'Kimi-K2.5', name: 'moonshotai/Kimi-K2.5' }
    ],
    lm_studio: [],
    other: []
  }

  const selectedApiUrlPreset = ref('')
  const selectedModelPreset = ref('')

  // Custom-provider identity derived from the current (temp) URL.
  const currentCustomProvider = computed<CustomProviderId>(() =>
    detectCustomProvider(tempAiCustomApiBaseUrl.value)
  )

  const modelPresets = computed<ModelPreset[]>(
    () => modelPresetsByProvider[currentCustomProvider.value] ?? []
  )

  // Compose sub-composables
  const copilot = useCopilotOAuth()
  const mlClassifier = useMlClassifierSettings()
  const modelChain = useModelChain({ tempPrimaryModelName: tempAiCustomModelName })

  // When the user switches to 'custom' service type and no URL is configured yet,
  // pre-fill with ModelScope defaults.
  watch(tempAiServiceType, (next, prev) => {
    if (next === 'custom' && prev !== 'custom' && !tempAiCustomApiBaseUrl.value) {
      tempAiCustomApiBaseUrl.value = MODELSCOPE_API_BASE_URL
      modelChain.tempCustomModelChain.value = modelPresetsByProvider.modelscope.map(p => p.name)
      if (modelChain.tempCustomModelChain.value.length > 0) {
        tempAiCustomModelName.value = modelChain.tempCustomModelChain.value[0]
      }
    }
  })

  const loadAISettings = async () => {
    try {
      const aiConfig = await window.electronAPI.config.getAIFilteringConfig()
      if (aiConfig) {
        aiServiceType.value = aiConfig.serviceType || 'builtin'
        tempAiServiceType.value = aiConfig.serviceType || 'builtin'
        aiCustomApiBaseUrl.value = aiConfig.customApiBaseUrl || ''
        tempAiCustomApiBaseUrl.value = aiConfig.customApiBaseUrl || ''
        aiCustomApiKey.value = aiConfig.customApiKey || ''
        tempAiCustomApiKey.value = aiConfig.customApiKey || ''
        aiCustomModelName.value = aiConfig.customModelName || ''
        tempAiCustomModelName.value = aiConfig.customModelName || ''
        modelChain.tempCustomModelChain.value = Array.isArray(aiConfig.customModelChain)
          ? [...aiConfig.customModelChain]
          : []
        aiRateLimit.value = aiConfig.rateLimit || 10
        tempAiRateLimit.value = aiConfig.rateLimit || 10
        aiBatchSize.value = aiConfig.batchSize || 5
        tempAiBatchSize.value = aiConfig.batchSize || 5
        aiMaxConcurrent.value = aiConfig.maxConcurrent || 1
        tempAiMaxConcurrent.value = aiConfig.maxConcurrent || 1
        aiMinTime.value = aiConfig.minTime || 6000
        tempAiMinTime.value = aiConfig.minTime || 6000
        aiImageResizeWidth.value = aiConfig.imageResizeWidth || 768
        tempAiImageResizeWidth.value = aiConfig.imageResizeWidth || 768
        aiImageResizeHeight.value = aiConfig.imageResizeHeight || 432
        tempAiImageResizeHeight.value = aiConfig.imageResizeHeight || 432

        const matchingPreset = imageResizePresets.find(
          p => p.width === aiImageResizeWidth.value && p.height === aiImageResizeHeight.value
        )
        selectedImageResizePreset.value = matchingPreset?.key || '768x432'

        await copilot.applyLoadedConfig(aiConfig)
        mlClassifier.applyLoadedConfig(aiConfig)
      }

      const [simplePrompts, distinguishPrompts] = await Promise.all([
        window.electronAPI.config.getAIPrompts('simple'),
        window.electronAPI.config.getAIPrompts('distinguish')
      ])
      if (simplePrompts) {
        aiPromptLive.value = simplePrompts.live || ''
        tempAiPromptLive.value = simplePrompts.live || ''
        aiPromptRecorded.value = simplePrompts.recorded || ''
        tempAiPromptRecorded.value = simplePrompts.recorded || ''
      }
      if (distinguishPrompts) {
        aiPromptLiveDistinguish.value = distinguishPrompts.live || ''
        tempAiPromptLiveDistinguish.value = distinguishPrompts.live || ''
        aiPromptRecordedDistinguish.value = distinguishPrompts.recorded || ''
        tempAiPromptRecordedDistinguish.value = distinguishPrompts.recorded || ''
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    }
  }

  const saveAISettings = async () => {
    try {
      // Ensure rate limit respects max based on service type
      const effectiveRateLimit = tempAiServiceType.value === 'builtin'
        ? Math.min(tempAiRateLimit.value, 10)
        : tempAiRateLimit.value

      const effectiveBatchSize = Math.max(1, Math.min(10, tempAiBatchSize.value))
      const effectiveMaxConcurrent = Math.max(1, Math.min(10, tempAiMaxConcurrent.value))
      const effectiveMinTime = Math.max(0, Math.min(60000, tempAiMinTime.value))

      // Save ML classifier mode + thresholds (independent IPC calls)
      await mlClassifier.save()

      // Resolve primary model from the chain for ModelScope; others use temp name directly.
      const chainProvider = detectCustomProvider(tempAiCustomApiBaseUrl.value)
      const chainToSave = chainProvider === 'modelscope' ? [...modelChain.tempCustomModelChain.value] : []
      const effectiveModelName = chainProvider === 'modelscope' && chainToSave.length > 0
        ? chainToSave[0]
        : tempAiCustomModelName.value

      await window.electronAPI.config.setAIFilteringConfig({
        serviceType: tempAiServiceType.value,
        customApiBaseUrl: tempAiCustomApiBaseUrl.value,
        customApiKey: tempAiCustomApiKey.value,
        customModelName: effectiveModelName,
        customModelChain: chainToSave,
        customProviderId: chainProvider,
        copilotGhoToken: copilot.copilotGhoToken.value,
        copilotModelName: copilot.tempCopilotModelName.value,
        copilotUsername: copilot.copilotUsername.value,
        copilotAvatarUrl: copilot.copilotAvatarUrl.value,
        rateLimit: effectiveRateLimit,
        batchSize: effectiveBatchSize,
        imageResizeWidth: tempAiImageResizeWidth.value,
        imageResizeHeight: tempAiImageResizeHeight.value,
        maxConcurrent: effectiveMaxConcurrent,
        minTime: effectiveMinTime
      })

      tempAiCustomModelName.value = effectiveModelName

      aiServiceType.value = tempAiServiceType.value
      aiCustomApiBaseUrl.value = tempAiCustomApiBaseUrl.value
      aiCustomApiKey.value = tempAiCustomApiKey.value
      aiCustomModelName.value = tempAiCustomModelName.value
      copilot.copilotModelName.value = copilot.tempCopilotModelName.value
      aiRateLimit.value = effectiveRateLimit
      tempAiRateLimit.value = effectiveRateLimit
      aiBatchSize.value = effectiveBatchSize
      tempAiBatchSize.value = effectiveBatchSize
      aiMaxConcurrent.value = effectiveMaxConcurrent
      tempAiMaxConcurrent.value = effectiveMaxConcurrent
      aiMinTime.value = effectiveMinTime
      tempAiMinTime.value = effectiveMinTime
      aiImageResizeWidth.value = tempAiImageResizeWidth.value
      aiImageResizeHeight.value = tempAiImageResizeHeight.value

      if (tempAiPromptLive.value !== aiPromptLive.value) {
        await window.electronAPI.config.setAIPrompt('live', tempAiPromptLive.value, 'simple')
        aiPromptLive.value = tempAiPromptLive.value
      }
      if (tempAiPromptRecorded.value !== aiPromptRecorded.value) {
        await window.electronAPI.config.setAIPrompt('recorded', tempAiPromptRecorded.value, 'simple')
        aiPromptRecorded.value = tempAiPromptRecorded.value
      }
      if (tempAiPromptLiveDistinguish.value !== aiPromptLiveDistinguish.value) {
        await window.electronAPI.config.setAIPrompt('live', tempAiPromptLiveDistinguish.value, 'distinguish')
        aiPromptLiveDistinguish.value = tempAiPromptLiveDistinguish.value
      }
      if (tempAiPromptRecordedDistinguish.value !== aiPromptRecordedDistinguish.value) {
        await window.electronAPI.config.setAIPrompt('recorded', tempAiPromptRecordedDistinguish.value, 'distinguish')
        aiPromptRecordedDistinguish.value = tempAiPromptRecordedDistinguish.value
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error)
      throw error
    }
  }

  const refreshBuiltinModel = async () => {
    const token = tokenManager.getToken()
    if (!token) {
      console.log('[AI] refreshBuiltinModel: No token available')
      builtinModelError.value = 'notLoggedIn'
      return
    }

    console.log('[AI] refreshBuiltinModel: Fetching model name...')
    isLoadingBuiltinModel.value = true
    builtinModelError.value = ''

    try {
      const modelName = await window.electronAPI.ai.getBuiltinModelName(token)
      console.log('[AI] refreshBuiltinModel: API response:', modelName)
      builtinModelName.value = modelName
    } catch (error) {
      console.error('[AI] refreshBuiltinModel: Failed to fetch built-in model name:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('cloudflareBlocked')) {
        builtinModelError.value = 'cloudflareBlocked'
      } else if (errorMessage.includes('temporarilyUnavailable')) {
        builtinModelError.value = 'temporarilyUnavailable'
      } else {
        builtinModelError.value = 'fetchFailed'
      }
      builtinModelName.value = ''
    } finally {
      isLoadingBuiltinModel.value = false
    }
  }

  // Preset handlers
  const onApiUrlPresetChange = () => {
    if (selectedApiUrlPreset.value) {
      tempAiCustomApiBaseUrl.value = selectedApiUrlPreset.value
    }
  }

  const onModelPresetChange = () => {
    if (selectedModelPreset.value) {
      tempAiCustomModelName.value = selectedModelPreset.value
    }
  }

  const onImageResizePresetChange = () => {
    const preset = imageResizePresets.find(p => p.key === selectedImageResizePreset.value)
    if (preset) {
      tempAiImageResizeWidth.value = preset.width
      tempAiImageResizeHeight.value = preset.height
    }
  }

  const resetAiPrompt = async (type: 'live' | 'recorded', variant: 'simple' | 'distinguish' = 'simple') => {
    try {
      const defaultPrompt = await window.electronAPI.config.resetAIPrompt(type, variant)
      if (variant === 'distinguish') {
        if (type === 'live') {
          tempAiPromptLiveDistinguish.value = defaultPrompt
          aiPromptLiveDistinguish.value = defaultPrompt
        } else {
          tempAiPromptRecordedDistinguish.value = defaultPrompt
          aiPromptRecordedDistinguish.value = defaultPrompt
        }
      } else {
        if (type === 'live') {
          tempAiPromptLive.value = defaultPrompt
          aiPromptLive.value = defaultPrompt
        } else {
          tempAiPromptRecorded.value = defaultPrompt
          aiPromptRecorded.value = defaultPrompt
        }
      }
    } catch (error) {
      console.error(`Failed to reset AI prompt for ${type} (${variant}):`, error)
    }
  }

  const updateAiBatchSize = () => {
    tempAiBatchSize.value = Math.max(1, Math.min(10, Math.round(tempAiBatchSize.value)))
  }

  const openCustomServiceDocs = async () => {
    try {
      await window.electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/docs')
    } catch (error) {
      console.error('Failed to open custom service docs:', error)
    }
  }

  const resetTempValues = () => {
    tempAiServiceType.value = aiServiceType.value
    tempAiCustomApiBaseUrl.value = aiCustomApiBaseUrl.value
    tempAiCustomApiKey.value = aiCustomApiKey.value
    tempAiCustomModelName.value = aiCustomModelName.value
    if (modelChain.tempCustomModelChain.value.length === 0 && aiCustomModelName.value) {
      modelChain.tempCustomModelChain.value = [aiCustomModelName.value]
    }
    tempAiRateLimit.value = aiRateLimit.value
    tempAiBatchSize.value = aiBatchSize.value
    tempAiMaxConcurrent.value = aiMaxConcurrent.value
    tempAiMinTime.value = aiMinTime.value
    tempAiImageResizeWidth.value = aiImageResizeWidth.value
    tempAiImageResizeHeight.value = aiImageResizeHeight.value
    tempAiPromptLive.value = aiPromptLive.value
    tempAiPromptRecorded.value = aiPromptRecorded.value
    tempAiPromptLiveDistinguish.value = aiPromptLiveDistinguish.value
    tempAiPromptRecordedDistinguish.value = aiPromptRecordedDistinguish.value
    selectedApiUrlPreset.value = ''
    selectedModelPreset.value = ''
    const matchingPreset = imageResizePresets.find(
      p => p.width === aiImageResizeWidth.value && p.height === aiImageResizeHeight.value
    )
    selectedImageResizePreset.value = matchingPreset?.key || '768x432'
    showApiKey.value = false

    copilot.resetTemp()
    mlClassifier.resetTemp()
  }

  return {
    // Service type
    aiServiceType,
    tempAiServiceType,

    // Custom API settings
    aiCustomApiBaseUrl,
    tempAiCustomApiBaseUrl,
    aiCustomApiKey,
    tempAiCustomApiKey,
    aiCustomModelName,
    tempAiCustomModelName,
    showApiKey,

    // Copilot (delegated)
    copilotGhoToken: copilot.copilotGhoToken,
    tempCopilotGhoToken: copilot.tempCopilotGhoToken,
    copilotModelName: copilot.copilotModelName,
    tempCopilotModelName: copilot.tempCopilotModelName,
    copilotUsername: copilot.copilotUsername,
    copilotAvatarUrl: copilot.copilotAvatarUrl,
    showCopilotToken: copilot.showCopilotToken,
    copilotOAuthStep: copilot.copilotOAuthStep,
    copilotUserCode: copilot.copilotUserCode,
    copilotVerificationUri: copilot.copilotVerificationUri,
    copilotOAuthError: copilot.copilotOAuthError,
    isCopilotLoading: copilot.isCopilotLoading,
    copilotModelPresets: copilot.copilotModelPresets,
    selectedCopilotModelPreset: copilot.selectedCopilotModelPreset,
    onCopilotModelPresetChange: copilot.onCopilotModelPresetChange,
    startCopilotOAuth: copilot.startCopilotOAuth,
    validateCopilotToken: copilot.validateCopilotToken,
    cancelCopilotOAuth: copilot.cancelCopilotOAuth,
    disconnectCopilot: copilot.disconnectCopilot,

    // Rate limit and batch size
    aiRateLimit,
    tempAiRateLimit,
    aiBatchSize,
    tempAiBatchSize,
    maxAiRateLimit,

    // Concurrency control
    aiMaxConcurrent,
    tempAiMaxConcurrent,
    aiMinTime,
    tempAiMinTime,

    // Image resize settings
    aiImageResizeWidth,
    tempAiImageResizeWidth,
    aiImageResizeHeight,
    tempAiImageResizeHeight,
    selectedImageResizePreset,
    imageResizePresets,

    // AI prompts — simple variant
    aiPromptLive,
    tempAiPromptLive,
    aiPromptRecorded,
    tempAiPromptRecorded,

    // AI prompts — distinguish variant
    aiPromptLiveDistinguish,
    tempAiPromptLiveDistinguish,
    aiPromptRecordedDistinguish,
    tempAiPromptRecordedDistinguish,

    // Built-in model info
    builtinModelName,
    isLoadingBuiltinModel,
    builtinModelError,

    // Presets
    apiUrlPresets,
    modelPresets,
    modelPresetsByProvider,
    selectedApiUrlPreset,
    selectedModelPreset,

    // Model chain (delegated)
    currentCustomProvider,
    tempCustomModelChain: modelChain.tempCustomModelChain,
    exhaustedModels: modelChain.exhaustedModels,
    refreshExhaustedModels: modelChain.refreshExhaustedModels,
    moveModelUp: modelChain.moveModelUp,
    moveModelDown: modelChain.moveModelDown,
    updateModelAt: modelChain.updateModelAt,
    removeModelAt: modelChain.removeModelAt,
    newModelInput: modelChain.newModelInput,
    selectedAddPreset: modelChain.selectedAddPreset,
    onAddPresetSelect: modelChain.onAddPresetSelect,
    addPendingModel: modelChain.addPendingModel,

    // ML classifier (delegated)
    aiClassifierMode: mlClassifier.aiClassifierMode,
    tempAiClassifierMode: mlClassifier.tempAiClassifierMode,
    mlThresholds: mlClassifier.mlThresholds,
    tempMlThresholds: mlClassifier.tempMlThresholds,
    mlModelInfo: mlClassifier.mlModelInfo,
    refreshMlModelInfo: mlClassifier.refreshMlModelInfo,
    importCustomMlModel: mlClassifier.importCustomMlModel,
    deleteCustomMlModel: mlClassifier.deleteCustomMlModel,

    // Methods
    loadAISettings,
    saveAISettings,
    refreshBuiltinModel,
    onApiUrlPresetChange,
    onModelPresetChange,
    onImageResizePresetChange,
    resetAiPrompt,
    updateAiBatchSize,
    openCustomServiceDocs,
    resetTempValues
  }
}

export type UseAISettingsReturn = ReturnType<typeof useAISettings>
