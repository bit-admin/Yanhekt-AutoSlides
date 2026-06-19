import { ref, type Ref } from 'vue'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ModelChain');

export interface ModelPreset {
  label: string
  name: string
}

export interface UseModelChainOptions {
  // The chain edits also update the primary model name ref (kept in sync with chain[0]).
  tempPrimaryModelName: Ref<string>
}

export function useModelChain(options: UseModelChainOptions) {
  const { tempPrimaryModelName } = options

  // Ordered chain of model names enabled for fallback. Primary = [0].
  const tempCustomModelChain = ref<string[]>([])

  // Session-exhausted models (reported by the main process for the current provider)
  const exhaustedModels = ref<string[]>([])

  // "Add model" row state
  const newModelInput = ref('')
  const selectedAddPreset = ref('')

  const refreshExhaustedModels = async () => {
    try {
      exhaustedModels.value = await window.electronAPI.ai.getExhaustedModels()
    } catch (error) {
      log.error('Failed to refresh exhausted models:', error)
      exhaustedModels.value = []
    }
  }

  const syncPrimary = (chain: string[]): void => {
    if (chain.length > 0) tempPrimaryModelName.value = chain[0]
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
      if (current.length > 0) tempPrimaryModelName.value = current[0]
      else tempPrimaryModelName.value = ''
    }
  }

  const onAddPresetSelect = (): void => {
    if (selectedAddPreset.value) {
      newModelInput.value = selectedAddPreset.value
    }
  }

  const addPendingModel = (): void => {
    const name = newModelInput.value.trim()
    if (!name) return
    const current = [...tempCustomModelChain.value]
    if (!current.includes(name)) {
      current.push(name)
      tempCustomModelChain.value = current
      syncPrimary(current)
    }
    newModelInput.value = ''
    selectedAddPreset.value = ''
  }

  return {
    tempCustomModelChain,
    exhaustedModels,
    newModelInput,
    selectedAddPreset,

    refreshExhaustedModels,
    moveModelUp,
    moveModelDown,
    updateModelAt,
    removeModelAt,
    onAddPresetSelect,
    addPendingModel
  }
}

export type UseModelChainReturn = ReturnType<typeof useModelChain>
