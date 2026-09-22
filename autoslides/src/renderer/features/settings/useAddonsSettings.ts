import { ref } from 'vue'
import {
  DEFAULT_WATCH_NOTES_PROVIDER,
  normalizeWatchNotesProvider,
  type WatchNotesProviderId,
} from '@common/watchNotesProviders'

/**
 * Buffered settings for the Add-ons tab:
 * - Watch Notes (notes add-ons): whether watch notes are auto-created and
 *   synced, and which provider they go to.
 * - Tools: whether the Tools window icon button rides beside Settings at the
 *   foot of the navigator.
 * Self-contained like useCloudSettings — reads/writes config directly and joins
 * the Settings page's prepare/discard/commit lifecycle.
 */
export function useAddonsSettings() {
  const watchNotesEnabled = ref(false)
  const tempWatchNotesEnabled = ref(false)
  const watchNotesProvider = ref<WatchNotesProviderId>(DEFAULT_WATCH_NOTES_PROVIDER)
  const tempWatchNotesProvider = ref<WatchNotesProviderId>(DEFAULT_WATCH_NOTES_PROVIDER)
  const showToolsButton = ref(false)
  const tempShowToolsButton = ref(false)

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    watchNotesEnabled.value = cfg.watchNotesEnabled ?? false
    watchNotesProvider.value = normalizeWatchNotesProvider(cfg.watchNotesProvider)
    showToolsButton.value = cfg.showToolsButton ?? false
    resetTemp()
  }

  const resetTemp = () => {
    tempWatchNotesEnabled.value = watchNotesEnabled.value
    tempWatchNotesProvider.value = watchNotesProvider.value
    tempShowToolsButton.value = showToolsButton.value
  }

  const save = async () => {
    if (
      tempWatchNotesEnabled.value !== watchNotesEnabled.value ||
      tempWatchNotesProvider.value !== watchNotesProvider.value
    ) {
      await window.electronAPI.config.setWatchNotes({
        enabled: tempWatchNotesEnabled.value,
        provider: tempWatchNotesProvider.value,
      })
      watchNotesEnabled.value = tempWatchNotesEnabled.value
      watchNotesProvider.value = tempWatchNotesProvider.value
    }
    if (tempShowToolsButton.value !== showToolsButton.value) {
      await window.electronAPI.config.setShowToolsButton(tempShowToolsButton.value)
      showToolsButton.value = tempShowToolsButton.value
    }
  }

  return {
    tempWatchNotesEnabled,
    tempWatchNotesProvider,
    tempShowToolsButton,
    load,
    resetTemp,
    save,
  }
}

export type UseAddonsSettingsReturn = ReturnType<typeof useAddonsSettings>
