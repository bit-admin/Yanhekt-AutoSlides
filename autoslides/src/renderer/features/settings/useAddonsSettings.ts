import { ref } from 'vue'

/**
 * Buffered settings for the Add-ons tab. Today that is only the "Tools" section:
 * whether the Tools window icon button rides beside Settings at the foot of the
 * navigator. Self-contained like useCloudSettings — reads/writes config directly
 * and joins the Settings page's prepare/discard/commit lifecycle.
 */
export function useAddonsSettings() {
  const showToolsButton = ref(false)
  const tempShowToolsButton = ref(false)

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    showToolsButton.value = cfg.showToolsButton ?? false
    resetTemp()
  }

  const resetTemp = () => {
    tempShowToolsButton.value = showToolsButton.value
  }

  const save = async () => {
    if (tempShowToolsButton.value !== showToolsButton.value) {
      await window.electronAPI.config.setShowToolsButton(tempShowToolsButton.value)
      showToolsButton.value = tempShowToolsButton.value
    }
  }

  return {
    tempShowToolsButton,
    load,
    resetTemp,
    save,
  }
}

export type UseAddonsSettingsReturn = ReturnType<typeof useAddonsSettings>
