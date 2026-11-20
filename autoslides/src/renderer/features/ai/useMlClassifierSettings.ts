import { ref } from 'vue'
import type { MlClassifierModelInfo } from '@common/onnxModelInfo'
import { resetMlClassifier } from '@shared/mlClassifier'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('MlClassifierSettings');

export type AIClassifierMode = 'llm' | 'ml'

export interface MlThresholdValues {
  trustLow: number
  trustHigh: number
  slideCheckLow: number
}

export type MlModelInfo = MlClassifierModelInfo

const DEFAULT_ML_THRESHOLDS: MlThresholdValues = { trustLow: 0.75, trustHigh: 0.9, slideCheckLow: 0.25 }

export function useMlClassifierSettings() {
  const aiClassifierMode = ref<AIClassifierMode>('llm')
  const tempAiClassifierMode = ref<AIClassifierMode>('llm')
  const mlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const tempMlThresholds = ref<MlThresholdValues>({ ...DEFAULT_ML_THRESHOLDS })
  const mlModelInfo = ref<MlModelInfo | null>(null)
  const mlModelActionBusy = ref(false)
  const mlModelActionFailed = ref(false)

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

  const watchMlModelInfo = () => {
    const unsubscribe = window.electronAPI.mlClassifier.onModelInfo(info => {
      mlModelInfo.value = info
    })
    void refreshMlModelInfo()
    return unsubscribe
  }

  const runModelAction = async (action: () => Promise<MlModelInfo | null>, resetWorker = false) => {
    mlModelActionBusy.value = true
    mlModelActionFailed.value = false
    try {
      const info = await action()
      if (info) {
        if (resetWorker) resetMlClassifier()
        mlModelInfo.value = info
      }
    } catch (error) {
      mlModelActionFailed.value = true
      log.error('Classifier model action failed:', error)
    } finally {
      mlModelActionBusy.value = false
    }
  }

  const importCustomMlModel = () => runModelAction(() => window.electronAPI.mlClassifier.selectAndImportModel(), true)
  const deleteCustomMlModel = () => runModelAction(() => window.electronAPI.mlClassifier.deleteCustomModel(), true)
  const downloadDefaultMlModel = () => runModelAction(() => window.electronAPI.mlClassifier.downloadDefaultModel())
  const deleteDownloadedMlModel = () => runModelAction(
    () => window.electronAPI.mlClassifier.deleteDownloadedModel(),
    mlModelInfo.value?.active !== 'custom' && mlModelInfo.value?.builtinSource === 'downloaded',
  )

  return {
    aiClassifierMode,
    tempAiClassifierMode,
    mlThresholds,
    tempMlThresholds,
    mlModelInfo,

    applyLoadedConfig,
    save,
    resetTemp,

    watchMlModelInfo,
    mlModelActionBusy,
    mlModelActionFailed,
    importCustomMlModel,
    deleteCustomMlModel,
    downloadDefaultMlModel,
    deleteDownloadedMlModel
  }
}

export type UseMlClassifierSettingsReturn = ReturnType<typeof useMlClassifierSettings>
