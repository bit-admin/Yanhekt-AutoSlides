import { ref } from 'vue'
import { resetMlClassifier } from './mlClassifierClient'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('MlClassifierSettings');

export type AIClassifierMode = 'llm' | 'ml'

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

const DEFAULT_ML_THRESHOLDS: MlThresholdValues = { trustLow: 0.75, trustHigh: 0.9, slideCheckLow: 0.25 }

export function useMlClassifierSettings() {
  const aiClassifierMode = ref<AIClassifierMode>('llm')
  const tempAiClassifierMode = ref<AIClassifierMode>('llm')
  const mlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const tempMlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const mlModelInfo = ref<MlModelInfo | null>(null)

  const applyLoadedConfig = (cfg: { classifierMode?: AIClassifierMode; mlThresholds?: Partial<MlThresholdValues> }) => {
    const mode: AIClassifierMode = cfg.classifierMode === 'ml' ? 'ml' : 'llm'
    aiClassifierMode.value = mode
    tempAiClassifierMode.value = mode
    if (cfg.mlThresholds) {
      const t = { ...DEFAULT_ML_THRESHOLDS, ...cfg.mlThresholds }
      mlThresholds.value = t
      tempMlThresholds.value = { ...t }
    }
  }

  const save = async () => {
    if (tempAiClassifierMode.value !== aiClassifierMode.value) {
      await window.electronAPI.config.setAIClassifierMode(tempAiClassifierMode.value)
      aiClassifierMode.value = tempAiClassifierMode.value
    }

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
  }

  const resetTemp = () => {
    tempAiClassifierMode.value = aiClassifierMode.value
    tempMlThresholds.value = { ...mlThresholds.value }
  }

  const refreshMlModelInfo = async () => {
    try {
      mlModelInfo.value = await window.electronAPI.mlClassifier.getModelInfo()
    } catch (error) {
      log.error('Failed to refresh ML model info:', error)
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
      log.error('Failed to import custom ML model:', error)
    }
  }

  const deleteCustomMlModel = async () => {
    try {
      await window.electronAPI.mlClassifier.deleteCustomModel()
      resetMlClassifier()
      await refreshMlModelInfo()
    } catch (error) {
      log.error('Failed to delete custom ML model:', error)
    }
  }

  return {
    aiClassifierMode,
    tempAiClassifierMode,
    mlThresholds,
    tempMlThresholds,
    mlModelInfo,

    applyLoadedConfig,
    save,
    resetTemp,

    refreshMlModelInfo,
    importCustomMlModel,
    deleteCustomMlModel
  }
}

export type UseMlClassifierSettingsReturn = ReturnType<typeof useMlClassifierSettings>
