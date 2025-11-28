import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { TokenManager } from '../services/authService'

export type AIServiceType = 'builtin' | 'custom'

export interface ApiUrlPreset {
  label: string
  url: string
}

export interface ModelPreset {
  label: string
  name: string
}

export interface UseAISettingsOptions {
  tokenManager: TokenManager
}

export interface UseAISettingsReturn {
  // Service type
  aiServiceType: Ref<AIServiceType>
  tempAiServiceType: Ref<AIServiceType>

  // Custom API settings
  aiCustomApiBaseUrl: Ref<string>
  tempAiCustomApiBaseUrl: Ref<string>
  aiCustomApiKey: Ref<string>
  tempAiCustomApiKey: Ref<string>
  aiCustomModelName: Ref<string>
  tempAiCustomModelName: Ref<string>
  showApiKey: Ref<boolean>

  // Rate limit and batch size
  aiRateLimit: Ref<number>
  tempAiRateLimit: Ref<number>
  aiBatchSize: Ref<number>
  tempAiBatchSize: Ref<number>
  maxAiRateLimit: ComputedRef<number>

  // AI prompts
  aiPromptLive: Ref<string>
  tempAiPromptLive: Ref<string>
  aiPromptRecorded: Ref<string>
  tempAiPromptRecorded: Ref<string>

  // Built-in model info
  builtinModelName: Ref<string>
  isLoadingBuiltinModel: Ref<boolean>
  builtinModelError: Ref<string>

  // Presets
  apiUrlPresets: ApiUrlPreset[]
  modelPresets: ModelPreset[]
  selectedApiUrlPreset: Ref<string>
  selectedModelPreset: Ref<string>

  // Methods
  loadAISettings: () => Promise<void>
  saveAISettings: () => Promise<void>
  refreshBuiltinModel: () => Promise<void>
  onApiUrlPresetChange: () => void
  onModelPresetChange: () => void
  resetAiPrompt: (type: 'live' | 'recorded') => Promise<void>
  updateAiBatchSize: () => void
  openCustomServiceDocs: () => Promise<void>
  resetTempValues: () => void
}

export function useAISettings(options: UseAISettingsOptions): UseAISettingsReturn {
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

  // Max rate limit depends on service type
  const maxAiRateLimit = computed(() => {
    return tempAiServiceType.value === 'builtin' ? 10 : 60
  })

  // AI prompts
  const aiPromptLive = ref('')
  const tempAiPromptLive = ref('')
  const aiPromptRecorded = ref('')
  const tempAiPromptRecorded = ref('')

  // Built-in model info
  const builtinModelName = ref('')
  const isLoadingBuiltinModel = ref(false)
  const builtinModelError = ref('')

  // Presets
  const apiUrlPresets: ApiUrlPreset[] = [
    { label: 'ModelScope', url: 'https://api-inference.modelscope.cn/v1' },
    { label: 'GitHub Copilot', url: 'https://api.githubcopilot.com' },
    { label: 'LM Studio (Local)', url: 'http://localhost:1234/v1' }
  ]

  const modelPresets: ModelPreset[] = [
    { label: 'Qwen3-VL-235B', name: 'Qwen/Qwen3-VL-235B-A22B-Instruct' },
    { label: 'Qwen3-VL-30B', name: 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
    { label: 'Qwen3-VL-8B', name: 'Qwen/Qwen3-VL-8B-Instruct' },
    { label: 'GPT-4.1', name: 'gpt-4.1' }
  ]

  const selectedApiUrlPreset = ref('')
  const selectedModelPreset = ref('')

  // Load AI settings
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
        aiRateLimit.value = aiConfig.rateLimit || 10
        tempAiRateLimit.value = aiConfig.rateLimit || 10
        aiBatchSize.value = aiConfig.batchSize || 4
        tempAiBatchSize.value = aiConfig.batchSize || 4
      }

      const prompts = await window.electronAPI.config.getAIPrompts()
      if (prompts) {
        aiPromptLive.value = prompts.live || ''
        tempAiPromptLive.value = prompts.live || ''
        aiPromptRecorded.value = prompts.recorded || ''
        tempAiPromptRecorded.value = prompts.recorded || ''
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    }
  }

  // Save AI settings
  const saveAISettings = async () => {
    try {
      // Ensure rate limit respects max based on service type
      const effectiveRateLimit = tempAiServiceType.value === 'builtin'
        ? Math.min(tempAiRateLimit.value, 10)
        : tempAiRateLimit.value

      // Ensure batch size is within valid range
      const effectiveBatchSize = Math.max(1, Math.min(10, tempAiBatchSize.value))

      await window.electronAPI.config.setAIFilteringConfig({
        serviceType: tempAiServiceType.value,
        customApiBaseUrl: tempAiCustomApiBaseUrl.value,
        customApiKey: tempAiCustomApiKey.value,
        customModelName: tempAiCustomModelName.value,
        rateLimit: effectiveRateLimit,
        batchSize: effectiveBatchSize
      })

      // Update actual values
      aiServiceType.value = tempAiServiceType.value
      aiCustomApiBaseUrl.value = tempAiCustomApiBaseUrl.value
      aiCustomApiKey.value = tempAiCustomApiKey.value
      aiCustomModelName.value = tempAiCustomModelName.value
      aiRateLimit.value = effectiveRateLimit
      tempAiRateLimit.value = effectiveRateLimit
      aiBatchSize.value = effectiveBatchSize
      tempAiBatchSize.value = effectiveBatchSize

      // Save AI prompts
      if (tempAiPromptLive.value !== aiPromptLive.value) {
        await window.electronAPI.config.setAIPrompt('live', tempAiPromptLive.value)
        aiPromptLive.value = tempAiPromptLive.value
      }
      if (tempAiPromptRecorded.value !== aiPromptRecorded.value) {
        await window.electronAPI.config.setAIPrompt('recorded', tempAiPromptRecorded.value)
        aiPromptRecorded.value = tempAiPromptRecorded.value
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error)
      throw error
    }
  }

  // Refresh built-in model
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

  // Reset AI prompt
  const resetAiPrompt = async (type: 'live' | 'recorded') => {
    try {
      const defaultPrompt = await window.electronAPI.config.resetAIPrompt(type)
      if (type === 'live') {
        tempAiPromptLive.value = defaultPrompt
        aiPromptLive.value = defaultPrompt
      } else {
        tempAiPromptRecorded.value = defaultPrompt
        aiPromptRecorded.value = defaultPrompt
      }
    } catch (error) {
      console.error(`Failed to reset AI prompt for ${type}:`, error)
    }
  }

  // Update batch size with validation
  const updateAiBatchSize = () => {
    tempAiBatchSize.value = Math.max(1, Math.min(10, Math.round(tempAiBatchSize.value)))
  }

  // Open custom service docs
  const openCustomServiceDocs = async () => {
    try {
      await (window as any).electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/docs')
    } catch (error) {
      console.error('Failed to open custom service docs:', error)
    }
  }

  // Reset temp values to actual values
  const resetTempValues = () => {
    tempAiServiceType.value = aiServiceType.value
    tempAiCustomApiBaseUrl.value = aiCustomApiBaseUrl.value
    tempAiCustomApiKey.value = aiCustomApiKey.value
    tempAiCustomModelName.value = aiCustomModelName.value
    tempAiRateLimit.value = aiRateLimit.value
    tempAiBatchSize.value = aiBatchSize.value
    tempAiPromptLive.value = aiPromptLive.value
    tempAiPromptRecorded.value = aiPromptRecorded.value
    selectedApiUrlPreset.value = ''
    selectedModelPreset.value = ''
    showApiKey.value = false
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

    // Rate limit and batch size
    aiRateLimit,
    tempAiRateLimit,
    aiBatchSize,
    tempAiBatchSize,
    maxAiRateLimit,

    // AI prompts
    aiPromptLive,
    tempAiPromptLive,
    aiPromptRecorded,
    tempAiPromptRecorded,

    // Built-in model info
    builtinModelName,
    isLoadingBuiltinModel,
    builtinModelError,

    // Presets
    apiUrlPresets,
    modelPresets,
    selectedApiUrlPreset,
    selectedModelPreset,

    // Methods
    loadAISettings,
    saveAISettings,
    refreshBuiltinModel,
    onApiUrlPresetChange,
    onModelPresetChange,
    resetAiPrompt,
    updateAiBatchSize,
    openCustomServiceDocs,
    resetTempValues
  }
}
