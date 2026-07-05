import { computed, reactive, ref, toRaw, toRef, watch } from 'vue'
import type { TokenManager } from '@shared/services/authService'
import { useCopilotOAuth, type CopilotOAuthStep } from './useCopilotOAuth'
import { useMlClassifierSettings, type AIClassifierMode, type MlThresholdValues, type MlModelInfo } from './useMlClassifierSettings'
import { useModelChain, type ModelPreset } from './useModelChain'
import { detectCustomProvider, MODELSCOPE_API_BASE_URL, type CustomProviderId } from './providerDetect'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('AISettings');

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

// Every committed/temp value pair, with its initial default. One record per
// side replaces the former 28 individual refs; resetTempPairs() replaces the
// field-by-field copy in resetTempValues. NOTE the load-time fallback for
// batchSize is `|| 5` (see loadAISettings) while the initial default is 4 —
// a long-standing quirk kept as-is.
const AI_PAIR_DEFAULTS = {
  serviceType: 'builtin' as AIServiceType,
  customApiBaseUrl: '',
  customApiKey: '',
  customModelName: '',
  rateLimit: 10,
  batchSize: 4,
  maxConcurrent: 1,
  minTime: 6000,
  imageResizeWidth: 768,
  imageResizeHeight: 432,
  promptLive: '',
  promptRecorded: '',
  promptLiveDistinguish: '',
  promptRecordedDistinguish: '',
}
type AiPairs = typeof AI_PAIR_DEFAULTS

export function useAISettings(options: UseAISettingsOptions) {
  const { tokenManager } = options

  const committed = reactive<AiPairs>({ ...AI_PAIR_DEFAULTS })
  const temp = reactive<AiPairs>({ ...AI_PAIR_DEFAULTS })
  const resetTempPairs = () => Object.assign(temp, toRaw(committed))

  // Named refs into the records — the exact public names AISettingsTab
  // destructures and v-models; toRef keeps them writable and reactive.
  const aiServiceType = toRef(committed, 'serviceType')
  const tempAiServiceType = toRef(temp, 'serviceType')
  const aiCustomApiBaseUrl = toRef(committed, 'customApiBaseUrl')
  const tempAiCustomApiBaseUrl = toRef(temp, 'customApiBaseUrl')
  const aiCustomApiKey = toRef(committed, 'customApiKey')
  const tempAiCustomApiKey = toRef(temp, 'customApiKey')
  const aiCustomModelName = toRef(committed, 'customModelName')
  const tempAiCustomModelName = toRef(temp, 'customModelName')
  const showApiKey = ref(false)

  const aiRateLimit = toRef(committed, 'rateLimit')
  const tempAiRateLimit = toRef(temp, 'rateLimit')
  const aiBatchSize = toRef(committed, 'batchSize')
  const tempAiBatchSize = toRef(temp, 'batchSize')
  const aiMaxConcurrent = toRef(committed, 'maxConcurrent')
  const tempAiMaxConcurrent = toRef(temp, 'maxConcurrent')
  const aiMinTime = toRef(committed, 'minTime')
  const tempAiMinTime = toRef(temp, 'minTime')

  const maxAiRateLimit = computed(() => {
    return tempAiServiceType.value === 'builtin' ? 10 : 60
  })

  const aiImageResizeWidth = toRef(committed, 'imageResizeWidth')
  const tempAiImageResizeWidth = toRef(temp, 'imageResizeWidth')
  const aiImageResizeHeight = toRef(committed, 'imageResizeHeight')
  const tempAiImageResizeHeight = toRef(temp, 'imageResizeHeight')
  const selectedImageResizePreset = ref('768x432')

  const imageResizePresets: ImageResizePreset[] = [
    { key: '512x288', label: '512x288', width: 512, height: 288 },
    { key: '768x432', label: '768x432', width: 768, height: 432 },
    { key: '1024x576', label: '1024x576', width: 1024, height: 576 },
    { key: '1920x1080', label: '1920x1080', width: 1920, height: 1080 }
  ]

  // AI prompts — simple variant
  const aiPromptLive = toRef(committed, 'promptLive')
  const tempAiPromptLive = toRef(temp, 'promptLive')
  const aiPromptRecorded = toRef(committed, 'promptRecorded')
  const tempAiPromptRecorded = toRef(temp, 'promptRecorded')

  // AI prompts — distinguish variant
  const aiPromptLiveDistinguish = toRef(committed, 'promptLiveDistinguish')
  const tempAiPromptLiveDistinguish = toRef(temp, 'promptLiveDistinguish')
  const aiPromptRecordedDistinguish = toRef(committed, 'promptRecordedDistinguish')
  const tempAiPromptRecordedDistinguish = toRef(temp, 'promptRecordedDistinguish')

  // Built-in model info
  const builtinModelName = ref('')
  const isLoadingBuiltinModel = ref(false)
  const builtinModelError = ref('')

  // Presets
  const apiUrlPresets: ApiUrlPreset[] = [
    { id: 'modelscope', label: 'ModelScope', url: MODELSCOPE_API_BASE_URL },
    { id: 'lm_studio', label: 'LM Studio', url: 'http://localhost:1234/v1' },
    { id: 'nvidia', label: 'NVIDIA NIM', url: 'https://integrate.api.nvidia.com/v1' },
    { id: 'agnes', label: 'Agnes AI', url: 'https://apihub.agnes-ai.com/v1' }
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
    nvidia: [
      { label: 'Qwen3.5-397B-A17B', name: 'qwen/qwen3.5-397b-a17b' },
      { label: 'Qwen3.5-122B-A10B', name: 'qwen/qwen3.5-122b-a10b' },
      { label: 'Kimi-K2.6', name: 'moonshotai/kimi-k2.6' },
      { label: 'Kimi-K2.5', name: 'moonshotai/kimi-k2.5' },
      { label: 'Gemma 4 31B IT', name: 'google/gemma-4-31b-it' }
    ],
    agnes: [
      { label: 'Agnes 2.0 Flash', name: 'agnes-2.0-flash' }
    ],
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
        // Per-key falsy fallbacks preserved exactly (incl. the batchSize || 5
        // quirk). Written to BOTH records so committed === temp after a load.
        const loaded: Omit<AiPairs, 'promptLive' | 'promptRecorded' | 'promptLiveDistinguish' | 'promptRecordedDistinguish'> = {
          serviceType: aiConfig.serviceType || 'builtin',
          customApiBaseUrl: aiConfig.customApiBaseUrl || '',
          customApiKey: aiConfig.customApiKey || '',
          customModelName: aiConfig.customModelName || '',
          rateLimit: aiConfig.rateLimit || 10,
          batchSize: aiConfig.batchSize || 5,
          maxConcurrent: aiConfig.maxConcurrent || 1,
          minTime: aiConfig.minTime || 6000,
          imageResizeWidth: aiConfig.imageResizeWidth || 768,
          imageResizeHeight: aiConfig.imageResizeHeight || 432,
        }
        Object.assign(committed, loaded)
        Object.assign(temp, loaded)

        modelChain.tempCustomModelChain.value = Array.isArray(aiConfig.customModelChain)
          ? [...aiConfig.customModelChain]
          : []

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
        committed.promptLive = temp.promptLive = simplePrompts.live || ''
        committed.promptRecorded = temp.promptRecorded = simplePrompts.recorded || ''
      }
      if (distinguishPrompts) {
        committed.promptLiveDistinguish = temp.promptLiveDistinguish = distinguishPrompts.live || ''
        committed.promptRecordedDistinguish = temp.promptRecordedDistinguish = distinguishPrompts.recorded || ''
      }
    } catch (error) {
      log.error('Failed to load AI settings:', error)
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
      log.error('Failed to save AI settings:', error)
      throw error
    }
  }

  const refreshBuiltinModel = async () => {
    const token = tokenManager.getToken()
    if (!token) {
      log.debug('[AI] refreshBuiltinModel: No token available')
      builtinModelError.value = 'notLoggedIn'
      return
    }

    log.debug('[AI] refreshBuiltinModel: Fetching model name...')
    isLoadingBuiltinModel.value = true
    builtinModelError.value = ''

    try {
      const modelName = await window.electronAPI.ai.getBuiltinModelName(token)
      log.debug('[AI] refreshBuiltinModel: API response:', modelName)
      builtinModelName.value = modelName
    } catch (error) {
      log.error('[AI] refreshBuiltinModel: Failed to fetch built-in model name:', error)
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
      log.error(`Failed to reset AI prompt for ${type} (${variant}):`, error)
    }
  }

  const updateAiBatchSize = () => {
    tempAiBatchSize.value = Math.max(1, Math.min(10, Math.round(tempAiBatchSize.value)))
  }

  const openCustomServiceDocs = async () => {
    try {
      await window.electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/docs')
    } catch (error) {
      log.error('Failed to open custom service docs:', error)
    }
  }

  const resetTempValues = () => {
    resetTempPairs()
    if (modelChain.tempCustomModelChain.value.length === 0 && aiCustomModelName.value) {
      modelChain.tempCustomModelChain.value = [aiCustomModelName.value]
    }
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
