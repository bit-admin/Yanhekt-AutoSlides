import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { TokenManager } from '../services/authService'
import { resetMlClassifier } from './useMlClassifier'

export type AIServiceType = 'builtin' | 'custom' | 'copilot'
export type AIClassifierMode = 'llm' | 'ml'
export type CustomProviderId = 'modelscope' | 'lm_studio' | 'other'

export const MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn/v1'

function detectCustomProvider(url: string): CustomProviderId {
  if (!url) return 'other'
  if (url.includes('api-inference.modelscope.cn')) return 'modelscope'
  if (/localhost:1234|127\.0\.0\.1:1234/.test(url)) return 'lm_studio'
  return 'other'
}

export interface MlThresholdValues {
  trustLow: number
  trustHigh: number
  slideCheckLow: number
}

export interface MlModelInfo {
  active: 'builtin' | 'custom'
  builtinVersion: string
  builtinExists: boolean
  builtinSizeBytes: number | null
  customName: string | null
  customExists: boolean
  customSizeBytes: number | null
}

export type CopilotOAuthStep = 'idle' | 'waiting' | 'polling' | 'success' | 'error'

export interface ApiUrlPreset {
  id: CustomProviderId
  label: string
  url: string
}

export interface ModelPreset {
  label: string
  name: string
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

  // Copilot settings
  copilotGhoToken: Ref<string>
  tempCopilotGhoToken: Ref<string>
  copilotModelName: Ref<string>
  tempCopilotModelName: Ref<string>
  copilotUsername: Ref<string>
  copilotAvatarUrl: Ref<string>
  showCopilotToken: Ref<boolean>
  copilotOAuthStep: Ref<CopilotOAuthStep>
  copilotUserCode: Ref<string>
  copilotVerificationUri: Ref<string>
  copilotOAuthError: Ref<string>
  isCopilotLoading: Ref<boolean>

  // Rate limit and batch size
  aiRateLimit: Ref<number>
  tempAiRateLimit: Ref<number>
  aiBatchSize: Ref<number>
  tempAiBatchSize: Ref<number>
  maxAiRateLimit: ComputedRef<number>

  // Concurrency control
  aiMaxConcurrent: Ref<number>
  tempAiMaxConcurrent: Ref<number>
  aiMinTime: Ref<number>
  tempAiMinTime: Ref<number>

  // Image resize settings
  aiImageResizeWidth: Ref<number>
  tempAiImageResizeWidth: Ref<number>
  aiImageResizeHeight: Ref<number>
  tempAiImageResizeHeight: Ref<number>
  selectedImageResizePreset: Ref<string>
  imageResizePresets: ImageResizePreset[]

  // AI prompts (simple variant — slide / not_slide)
  aiPromptLive: Ref<string>
  tempAiPromptLive: Ref<string>
  aiPromptRecorded: Ref<string>
  tempAiPromptRecorded: Ref<string>

  // AI prompts (distinguish variant — slide / not_slide / may_be_slide_edit)
  aiPromptLiveDistinguish: Ref<string>
  tempAiPromptLiveDistinguish: Ref<string>
  aiPromptRecordedDistinguish: Ref<string>
  tempAiPromptRecordedDistinguish: Ref<string>

  // Built-in model info
  builtinModelName: Ref<string>
  isLoadingBuiltinModel: Ref<boolean>
  builtinModelError: Ref<string>

  // Presets
  apiUrlPresets: ApiUrlPreset[]
  modelPresets: ComputedRef<ModelPreset[]>
  modelPresetsByProvider: Record<CustomProviderId, ModelPreset[]>
  selectedApiUrlPreset: Ref<string>
  selectedModelPreset: Ref<string>
  copilotModelPresets: ModelPreset[]
  selectedCopilotModelPreset: Ref<string>

  // ModelScope model chain (session-scoped fallback on 429 quota_exceeded)
  currentCustomProvider: ComputedRef<CustomProviderId>
  tempCustomModelChain: Ref<string[]>
  exhaustedModels: Ref<string[]>
  refreshExhaustedModels: () => Promise<void>
  moveModelUp: (index: number) => void
  moveModelDown: (index: number) => void
  updateModelAt: (index: number, name: string) => void
  removeModelAt: (index: number) => void

  // "Add model" row state — input is always visible, preset dropdown prefills it.
  newModelInput: Ref<string>
  selectedAddPreset: Ref<string>
  onAddPresetSelect: () => void
  addPendingModel: () => void

  // ML classifier
  aiClassifierMode: Ref<AIClassifierMode>
  tempAiClassifierMode: Ref<AIClassifierMode>
  mlThresholds: Ref<MlThresholdValues>
  tempMlThresholds: Ref<MlThresholdValues>
  mlModelInfo: Ref<MlModelInfo | null>

  // Methods
  loadAISettings: () => Promise<void>
  saveAISettings: () => Promise<void>
  refreshBuiltinModel: () => Promise<void>
  onApiUrlPresetChange: () => void
  onModelPresetChange: () => void
  onCopilotModelPresetChange: () => void
  onImageResizePresetChange: () => void
  resetAiPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => Promise<void>
  updateAiBatchSize: () => void
  openCustomServiceDocs: () => Promise<void>
  resetTempValues: () => void
  startCopilotOAuth: () => Promise<void>
  validateCopilotToken: (token: string) => Promise<boolean>
  cancelCopilotOAuth: () => void
  disconnectCopilot: () => Promise<void>
  refreshMlModelInfo: () => Promise<void>
  importCustomMlModel: () => Promise<void>
  deleteCustomMlModel: () => Promise<void>
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

  // Copilot settings
  const copilotGhoToken = ref('')
  const tempCopilotGhoToken = ref('')
  const copilotModelName = ref('gpt-4.1')
  const tempCopilotModelName = ref('gpt-4.1')
  const copilotUsername = ref('')
  const copilotAvatarUrl = ref('')
  const showCopilotToken = ref(false)
  const copilotOAuthStep = ref<CopilotOAuthStep>('idle')
  const copilotUserCode = ref('')
  const copilotVerificationUri = ref('')
  const copilotOAuthError = ref('')
  let copilotOAuthCancelled = false
  const isCopilotLoading = ref(false)

  // ML classifier
  const DEFAULT_ML_THRESHOLDS: MlThresholdValues = { trustLow: 0.75, trustHigh: 0.9, slideCheckLow: 0.25 }
  const aiClassifierMode = ref<AIClassifierMode>('llm')
  const tempAiClassifierMode = ref<AIClassifierMode>('llm')
  const mlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const tempMlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const mlModelInfo = ref<MlModelInfo | null>(null)

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

  // Max rate limit depends on service type
  const maxAiRateLimit = computed(() => {
    return tempAiServiceType.value === 'builtin' ? 10 : 60
  })

  // Image resize settings
  const aiImageResizeWidth = ref(768)
  const tempAiImageResizeWidth = ref(768)
  const aiImageResizeHeight = ref(432)
  const tempAiImageResizeHeight = ref(432)
  const selectedImageResizePreset = ref('768x432')

  // Image resize presets
  const imageResizePresets: ImageResizePreset[] = [
    { key: '512x288', label: '512x288', width: 512, height: 288 },
    { key: '768x432', label: '768x432', width: 768, height: 432 },
    { key: '1024x576', label: '1024x576', width: 1024, height: 576 },
    { key: '1920x1080', label: '1920x1080', width: 1920, height: 1080 }
  ]

  // AI prompts — simple variant (slide / not_slide)
  const aiPromptLive = ref('')
  const tempAiPromptLive = ref('')
  const aiPromptRecorded = ref('')
  const tempAiPromptRecorded = ref('')

  // AI prompts — distinguish variant (slide / not_slide / may_be_slide_edit)
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

  const copilotModelPresets: ModelPreset[] = [
    { label: 'GPT-4.1', name: 'gpt-4.1' },
    { label: 'GPT-5-mini', name: 'gpt-5-mini' }
  ]

  const selectedApiUrlPreset = ref('')
  const selectedModelPreset = ref('')
  const selectedCopilotModelPreset = ref('')

  // Custom-provider identity derived from the current (temp) URL.
  const currentCustomProvider = computed<CustomProviderId>(() =>
    detectCustomProvider(tempAiCustomApiBaseUrl.value)
  )

  // modelPresets exposed to the UI reflects the current provider — used by the
  // legacy single-model preset dropdown for LM Studio / 'other', and by the
  // ModelScope chain editor for 'modelscope'.
  const modelPresets = computed<ModelPreset[]>(
    () => modelPresetsByProvider[currentCustomProvider.value] ?? []
  )

  // Ordered chain of model names enabled for fallback. Primary = [0].
  // Empty for non-ModelScope providers (the single-input field is used instead).
  const tempCustomModelChain = ref<string[]>([])

  // Session-exhausted models (reported by the main process for the current provider)
  const exhaustedModels = ref<string[]>([])

  const refreshExhaustedModels = async () => {
    try {
      exhaustedModels.value = await window.electronAPI.ai.getExhaustedModels()
    } catch (error) {
      console.error('Failed to refresh exhausted models:', error)
      exhaustedModels.value = []
    }
  }

  const syncPrimary = (chain: string[]): void => {
    if (chain.length > 0) tempAiCustomModelName.value = chain[0]
  }

  const moveModelUp = (index: number): void => {
    const current = [...tempCustomModelChain.value]
    if (index > 0 && index < current.length) {
      ;[current[index - 1], current[index]] = [current[index], current[index - 1]]
      tempCustomModelChain.value = current
      syncPrimary(current)
    }
  }

  const moveModelDown = (index: number): void => {
    const current = [...tempCustomModelChain.value]
    if (index >= 0 && index < current.length - 1) {
      ;[current[index], current[index + 1]] = [current[index + 1], current[index]]
      tempCustomModelChain.value = current
      syncPrimary(current)
    }
  }

  const updateModelAt = (index: number, name: string): void => {
    const current = [...tempCustomModelChain.value]
    if (index >= 0 && index < current.length) {
      current[index] = name
      tempCustomModelChain.value = current
      syncPrimary(current)
    }
  }

  const removeModelAt = (index: number): void => {
    const current = [...tempCustomModelChain.value]
    if (index >= 0 && index < current.length) {
      current.splice(index, 1)
      tempCustomModelChain.value = current
      // Primary may have shifted; clear it if chain is now empty
      if (current.length > 0) tempAiCustomModelName.value = current[0]
      else tempAiCustomModelName.value = ''
    }
  }

  // Add-row state: the input is always displayed; selecting a preset prefills it.
  const newModelInput = ref('')
  const selectedAddPreset = ref('')

  const onAddPresetSelect = (): void => {
    if (selectedAddPreset.value) {
      newModelInput.value = selectedAddPreset.value
    }
  }

  const addPendingModel = (): void => {
    const name = newModelInput.value.trim()
    if (!name) return
    const current = [...tempCustomModelChain.value]
    // Skip silent duplicates — keeps chain semantics clean.
    if (!current.includes(name)) {
      current.push(name)
      tempCustomModelChain.value = current
      syncPrimary(current)
    }
    newModelInput.value = ''
    selectedAddPreset.value = ''
  }

  // When the user switches to 'custom' service type and no URL is configured yet,
  // pre-fill with ModelScope defaults — only the API key remains empty.
  watch(tempAiServiceType, (next, prev) => {
    if (next === 'custom' && prev !== 'custom' && !tempAiCustomApiBaseUrl.value) {
      tempAiCustomApiBaseUrl.value = MODELSCOPE_API_BASE_URL
      tempCustomModelChain.value = modelPresetsByProvider.modelscope.map(p => p.name)
      if (tempCustomModelChain.value.length > 0) {
        tempAiCustomModelName.value = tempCustomModelChain.value[0]
      }
    }
  })

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
        // Load ModelScope model chain (session-scoped fallback ordering)
        const loadedChain = Array.isArray(aiConfig.customModelChain)
          ? [...aiConfig.customModelChain]
          : []
        tempCustomModelChain.value = loadedChain
        aiRateLimit.value = aiConfig.rateLimit || 10
        tempAiRateLimit.value = aiConfig.rateLimit || 10
        aiBatchSize.value = aiConfig.batchSize || 5
        tempAiBatchSize.value = aiConfig.batchSize || 5

        // Load concurrency control settings
        aiMaxConcurrent.value = aiConfig.maxConcurrent || 1
        tempAiMaxConcurrent.value = aiConfig.maxConcurrent || 1
        aiMinTime.value = aiConfig.minTime || 6000
        tempAiMinTime.value = aiConfig.minTime || 6000

        // Load image resize settings
        aiImageResizeWidth.value = aiConfig.imageResizeWidth || 768
        tempAiImageResizeWidth.value = aiConfig.imageResizeWidth || 768
        aiImageResizeHeight.value = aiConfig.imageResizeHeight || 432
        tempAiImageResizeHeight.value = aiConfig.imageResizeHeight || 432

        // Find matching preset
        const matchingPreset = imageResizePresets.find(
          p => p.width === aiImageResizeWidth.value && p.height === aiImageResizeHeight.value
        )
        selectedImageResizePreset.value = matchingPreset?.key || '768x432'

        // Load Copilot settings
        copilotGhoToken.value = aiConfig.copilotGhoToken || ''
        tempCopilotGhoToken.value = aiConfig.copilotGhoToken || ''
        copilotModelName.value = aiConfig.copilotModelName || 'gpt-4.1'
        tempCopilotModelName.value = aiConfig.copilotModelName || 'gpt-4.1'
        copilotUsername.value = aiConfig.copilotUsername || ''
        copilotAvatarUrl.value = aiConfig.copilotAvatarUrl || ''

        // Load ML classifier settings
        const mode = aiConfig.classifierMode === 'ml' ? 'ml' : 'llm'
        aiClassifierMode.value = mode
        tempAiClassifierMode.value = mode
        if (aiConfig.mlThresholds) {
          const t = { ...DEFAULT_ML_THRESHOLDS, ...aiConfig.mlThresholds }
          mlThresholds.value = t
          tempMlThresholds.value = { ...t }
        }

        // If copilot token exists, mark as authenticated and fetch user info
        if (copilotGhoToken.value) {
          copilotOAuthStep.value = 'success'
          // Refresh user info in background if not already loaded
          if (!copilotUsername.value) {
            try {
              const userInfo = await window.electronAPI.copilot.getUserInfo(copilotGhoToken.value)
              copilotUsername.value = userInfo.login
              copilotAvatarUrl.value = userInfo.avatar_url
            } catch {
              // Token may be expired
              console.warn('[Copilot] Failed to fetch user info on load')
            }
          }
        }
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

  // Save AI settings
  const saveAISettings = async () => {
    try {
      // Ensure rate limit respects max based on service type
      const effectiveRateLimit = tempAiServiceType.value === 'builtin'
        ? Math.min(tempAiRateLimit.value, 10)
        : tempAiRateLimit.value

      // Ensure batch size is within valid range
      const effectiveBatchSize = Math.max(1, Math.min(10, tempAiBatchSize.value))

      // Ensure concurrency control values are within valid range
      const effectiveMaxConcurrent = Math.max(1, Math.min(10, tempAiMaxConcurrent.value))
      const effectiveMinTime = Math.max(0, Math.min(60000, tempAiMinTime.value))

      // Save classifier mode
      if (tempAiClassifierMode.value !== aiClassifierMode.value) {
        await window.electronAPI.config.setAIClassifierMode(tempAiClassifierMode.value)
        aiClassifierMode.value = tempAiClassifierMode.value
      }

      // Save ML thresholds
      const t = tempMlThresholds.value
      const effectiveThresholds = {
        trustLow: Math.max(0, Math.min(1, t.trustLow)),
        trustHigh: Math.max(0, Math.min(1, t.trustHigh)),
        slideCheckLow: Math.max(0, Math.min(1, t.slideCheckLow))
      }
      if (effectiveThresholds.trustLow > effectiveThresholds.trustHigh) {
        effectiveThresholds.trustLow = effectiveThresholds.trustHigh
      }
      await window.electronAPI.config.setMlThresholds(effectiveThresholds)
      mlThresholds.value = { ...effectiveThresholds }
      tempMlThresholds.value = { ...effectiveThresholds }

      // Resolve primary model from the chain for providers that use it (ModelScope);
      // non-chain providers keep writing tempAiCustomModelName directly.
      const chainProvider = detectCustomProvider(tempAiCustomApiBaseUrl.value)
      const chainToSave = chainProvider === 'modelscope' ? [...tempCustomModelChain.value] : []
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
        copilotGhoToken: copilotGhoToken.value,
        copilotModelName: tempCopilotModelName.value,
        copilotUsername: copilotUsername.value,
        copilotAvatarUrl: copilotAvatarUrl.value,
        rateLimit: effectiveRateLimit,
        batchSize: effectiveBatchSize,
        imageResizeWidth: tempAiImageResizeWidth.value,
        imageResizeHeight: tempAiImageResizeHeight.value,
        maxConcurrent: effectiveMaxConcurrent,
        minTime: effectiveMinTime
      })

      // Sync tempAiCustomModelName with the resolved primary so subsequent UI reads match
      tempAiCustomModelName.value = effectiveModelName

      // Update actual values
      aiServiceType.value = tempAiServiceType.value
      aiCustomApiBaseUrl.value = tempAiCustomApiBaseUrl.value
      aiCustomApiKey.value = tempAiCustomApiKey.value
      aiCustomModelName.value = tempAiCustomModelName.value
      copilotModelName.value = tempCopilotModelName.value
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

      // Save AI prompts — simple variant
      if (tempAiPromptLive.value !== aiPromptLive.value) {
        await window.electronAPI.config.setAIPrompt('live', tempAiPromptLive.value, 'simple')
        aiPromptLive.value = tempAiPromptLive.value
      }
      if (tempAiPromptRecorded.value !== aiPromptRecorded.value) {
        await window.electronAPI.config.setAIPrompt('recorded', tempAiPromptRecorded.value, 'simple')
        aiPromptRecorded.value = tempAiPromptRecorded.value
      }

      // Save AI prompts — distinguish variant
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

  // Copilot OAuth device flow
  const startCopilotOAuth = async () => {
    copilotOAuthError.value = ''
    copilotOAuthStep.value = 'waiting'
    isCopilotLoading.value = true
    copilotOAuthCancelled = false

    try {
      const deviceCode = await window.electronAPI.copilot.requestDeviceCode()

      if (copilotOAuthCancelled) return

      copilotUserCode.value = deviceCode.user_code
      copilotVerificationUri.value = deviceCode.verification_uri

      // Auto-copy the user code to clipboard
      try {
        await navigator.clipboard.writeText(deviceCode.user_code)
      } catch {
        // Clipboard API may not be available, ignore
      }

      // Open the verification URL in the browser
      await window.electronAPI.shell.openExternal(deviceCode.verification_uri)

      if (copilotOAuthCancelled) return

      copilotOAuthStep.value = 'polling'

      // Poll for access token
      const accessToken = await window.electronAPI.copilot.pollForAccessToken(
        deviceCode.device_code,
        deviceCode.interval
      )

      if (copilotOAuthCancelled) return

      // Got the token — save it and fetch user info
      copilotGhoToken.value = accessToken
      tempCopilotGhoToken.value = accessToken

      const userInfo = await window.electronAPI.copilot.getUserInfo(accessToken)
      copilotUsername.value = userInfo.login
      copilotAvatarUrl.value = userInfo.avatar_url

      copilotOAuthStep.value = 'success'

      // Persist immediately
      await window.electronAPI.config.setAIFilteringConfig({
        copilotGhoToken: accessToken,
        copilotUsername: userInfo.login,
        copilotAvatarUrl: userInfo.avatar_url
      })
    } catch (error) {
      if (copilotOAuthCancelled) return
      const msg = error instanceof Error ? error.message : String(error)
      copilotOAuthStep.value = 'error'
      if (msg.includes('expired_token')) {
        copilotOAuthError.value = 'expired_token'
      } else if (msg.includes('access_denied')) {
        copilotOAuthError.value = 'access_denied'
      } else {
        copilotOAuthError.value = msg
      }
    } finally {
      if (!copilotOAuthCancelled) {
        isCopilotLoading.value = false
      }
    }
  }

  // Validate a manually entered gho_ token
  const validateCopilotToken = async (token: string): Promise<boolean> => {
    isCopilotLoading.value = true
    copilotOAuthError.value = ''

    try {
      const isValid = await window.electronAPI.copilot.validateToken(token)
      if (!isValid) {
        copilotOAuthError.value = 'invalid_token'
        return false
      }

      copilotGhoToken.value = token
      tempCopilotGhoToken.value = token

      const userInfo = await window.electronAPI.copilot.getUserInfo(token)
      copilotUsername.value = userInfo.login
      copilotAvatarUrl.value = userInfo.avatar_url

      copilotOAuthStep.value = 'success'

      // Persist immediately
      await window.electronAPI.config.setAIFilteringConfig({
        copilotGhoToken: token,
        copilotUsername: userInfo.login,
        copilotAvatarUrl: userInfo.avatar_url
      })

      return true
    } catch {
      copilotOAuthError.value = 'invalid_token'
      return false
    } finally {
      isCopilotLoading.value = false
    }
  }

  // Disconnect Copilot (clear token and user info)
  const disconnectCopilot = async () => {
    copilotGhoToken.value = ''
    tempCopilotGhoToken.value = ''
    copilotUsername.value = ''
    copilotAvatarUrl.value = ''
    copilotOAuthStep.value = 'idle'
    copilotOAuthError.value = ''
    copilotUserCode.value = ''

    await window.electronAPI.copilot.clearCache()
    await window.electronAPI.config.setAIFilteringConfig({
      copilotGhoToken: '',
      copilotUsername: '',
      copilotAvatarUrl: ''
    })
  }

  // Cancel Copilot OAuth (user pressed cancel during waiting/polling)
  const cancelCopilotOAuth = () => {
    copilotOAuthCancelled = true
    copilotOAuthStep.value = 'idle'
    copilotUserCode.value = ''
    copilotVerificationUri.value = ''
    copilotOAuthError.value = ''
    isCopilotLoading.value = false
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

  const onCopilotModelPresetChange = () => {
    if (selectedCopilotModelPreset.value) {
      tempCopilotModelName.value = selectedCopilotModelPreset.value
    }
  }

  // Image resize preset handler
  const onImageResizePresetChange = () => {
    const preset = imageResizePresets.find(p => p.key === selectedImageResizePreset.value)
    if (preset) {
      tempAiImageResizeWidth.value = preset.width
      tempAiImageResizeHeight.value = preset.height
    }
  }

  // Reset AI prompt
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
    // Reset the chain to what's currently persisted. Load path writes it; here we
    // just rebuild from current aiCustomModelName for providers that don't use a chain.
    if (tempCustomModelChain.value.length === 0 && aiCustomModelName.value) {
      tempCustomModelChain.value = [aiCustomModelName.value]
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
    tempCopilotModelName.value = copilotModelName.value
    tempCopilotGhoToken.value = copilotGhoToken.value
    selectedApiUrlPreset.value = ''
    selectedModelPreset.value = ''
    selectedCopilotModelPreset.value = ''
    // Find matching preset for image resize
    const matchingPreset = imageResizePresets.find(
      p => p.width === aiImageResizeWidth.value && p.height === aiImageResizeHeight.value
    )
    selectedImageResizePreset.value = matchingPreset?.key || '768x432'
    showApiKey.value = false
    showCopilotToken.value = false
    tempAiClassifierMode.value = aiClassifierMode.value
    tempMlThresholds.value = { ...mlThresholds.value }
  }

  const refreshMlModelInfo = async () => {
    try {
      mlModelInfo.value = await window.electronAPI.mlClassifier.getModelInfo()
    } catch (error) {
      console.error('Failed to refresh ML model info:', error)
    }
  }

  const importCustomMlModel = async () => {
    try {
      const result = await window.electronAPI.mlClassifier.selectAndImportModel()
      if (result) {
        resetMlClassifier()
        await refreshMlModelInfo()
      }
    } catch (error) {
      console.error('Failed to import custom ML model:', error)
    }
  }

  const deleteCustomMlModel = async () => {
    try {
      await window.electronAPI.mlClassifier.deleteCustomModel()
      resetMlClassifier()
      await refreshMlModelInfo()
    } catch (error) {
      console.error('Failed to delete custom ML model:', error)
    }
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

    // Copilot settings
    copilotGhoToken,
    tempCopilotGhoToken,
    copilotModelName,
    tempCopilotModelName,
    copilotUsername,
    copilotAvatarUrl,
    showCopilotToken,
    copilotOAuthStep,
    copilotUserCode,
    copilotVerificationUri,
    copilotOAuthError,
    isCopilotLoading,

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
    copilotModelPresets,
    selectedCopilotModelPreset,

    // ModelScope chain
    currentCustomProvider,
    tempCustomModelChain,
    exhaustedModels,
    refreshExhaustedModels,
    moveModelUp,
    moveModelDown,
    updateModelAt,
    removeModelAt,
    newModelInput,
    selectedAddPreset,
    onAddPresetSelect,
    addPendingModel,

    // ML classifier
    aiClassifierMode,
    tempAiClassifierMode,
    mlThresholds,
    tempMlThresholds,
    mlModelInfo,

    // Methods
    loadAISettings,
    saveAISettings,
    refreshBuiltinModel,
    onApiUrlPresetChange,
    onModelPresetChange,
    onCopilotModelPresetChange,
    onImageResizePresetChange,
    resetAiPrompt,
    updateAiBatchSize,
    openCustomServiceDocs,
    resetTempValues,
    startCopilotOAuth,
    validateCopilotToken,
    cancelCopilotOAuth,
    disconnectCopilot,
    refreshMlModelInfo,
    importCustomMlModel,
    deleteCustomMlModel
  }
}
