import { ref } from 'vue'
import type { NotionErrorCode } from '@common/notionNotesTypes'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('AddonsSettings')
import {
  DEFAULT_WATCH_NOTES_PROVIDER,
  normalizeWatchNotesProvider,
  type WatchNotesProviderId,
} from '@common/watchNotesProviders'

/**
 * Buffered settings for the Add-ons tab:
 * - Watch Notes (notes add-ons): whether watch notes are auto-created and
 *   synced, which provider they go to, the Obsidian provider's vault, notes
 *   folder and auto-create switch, and the Notion connection (applied at once,
 *   not on commit).
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
  const obsidianVaultPath = ref('')
  const tempObsidianVaultPath = ref('')
  const obsidianSubfolder = ref('AutoSlides')
  const tempObsidianSubfolder = ref('AutoSlides')
  const obsidianAutoCreateNote = ref(false)
  const tempObsidianAutoCreateNote = ref(false)
  /** Whether the buffered vault path holds `.obsidian/` (null = not checked / empty). */
  const tempObsidianVaultIsVault = ref<boolean | null>(null)
  const showToolsButton = ref(false)
  const tempShowToolsButton = ref(false)

  // Notion connection. Not buffered like the rest: a token is verified against
  // Notion and stored the moment Connect is clicked, and the connected state is
  // read from configStore.notionConnected.
  const notionTokenInput = ref('')
  /** The stored token, shown (masked by default) while connected. */
  const notionStoredToken = ref('')
  const showNotionToken = ref(false)

  const loadNotionToken = async () => {
    try {
      notionStoredToken.value = (await window.electronAPI.notionNotes.getToken()) ?? ''
    } catch (err) {
      log.warn('could not read the Notion token', err)
      notionStoredToken.value = ''
    }
  }
  const notionBusy = ref(false)
  const notionError = ref<NotionErrorCode | null>(null)

  const connectNotion = async () => {
    const token = notionTokenInput.value.trim()
    if (!token || notionBusy.value) return
    notionBusy.value = true
    notionError.value = null
    try {
      const res = await window.electronAPI.notionNotes.connect(token)
      if (res.ok) {
        notionStoredToken.value = token
        notionTokenInput.value = ''
      } else {
        notionError.value = res.error
      }
    } catch {
      notionError.value = 'network'
    } finally {
      notionBusy.value = false
    }
  }

  const disconnectNotion = async () => {
    if (notionBusy.value) return
    notionBusy.value = true
    notionError.value = null
    try {
      await window.electronAPI.notionNotes.disconnect()
      notionStoredToken.value = ''
    } finally {
      notionBusy.value = false
    }
  }

  const probeTempVault = async () => {
    const dir = tempObsidianVaultPath.value
    if (!dir) {
      tempObsidianVaultIsVault.value = null
      return
    }
    try {
      const probe = await window.electronAPI.obsidianNotes.probeVault(dir)
      if (tempObsidianVaultPath.value === dir) tempObsidianVaultIsVault.value = probe.isVault
    } catch {
      tempObsidianVaultIsVault.value = null
    }
  }

  /** Settings → Choose… for the vault (main-side folder dialog). */
  const selectObsidianVault = async () => {
    const picked = await window.electronAPI.obsidianNotes.selectVault()
    if (!picked) return
    tempObsidianVaultPath.value = picked.path
    tempObsidianVaultIsVault.value = picked.isVault
  }

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    watchNotesEnabled.value = cfg.watchNotesEnabled ?? false
    watchNotesProvider.value = normalizeWatchNotesProvider(cfg.watchNotesProvider)
    obsidianVaultPath.value = cfg.obsidianVaultPath ?? ''
    obsidianSubfolder.value = cfg.obsidianSubfolder ?? 'AutoSlides'
    obsidianAutoCreateNote.value = cfg.obsidianAutoCreateNote ?? false
    showToolsButton.value = cfg.showToolsButton ?? false
    resetTemp()
  }

  const resetTemp = () => {
    tempWatchNotesEnabled.value = watchNotesEnabled.value
    tempWatchNotesProvider.value = watchNotesProvider.value
    tempObsidianVaultPath.value = obsidianVaultPath.value
    tempObsidianSubfolder.value = obsidianSubfolder.value
    tempObsidianAutoCreateNote.value = obsidianAutoCreateNote.value
    tempShowToolsButton.value = showToolsButton.value
    notionTokenInput.value = ''
    notionError.value = null
    showNotionToken.value = false
    void loadNotionToken()
    void probeTempVault()
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
    const subfolder = tempObsidianSubfolder.value.trim()
    if (
      tempObsidianVaultPath.value !== obsidianVaultPath.value ||
      subfolder !== obsidianSubfolder.value ||
      tempObsidianAutoCreateNote.value !== obsidianAutoCreateNote.value
    ) {
      await window.electronAPI.config.setObsidian({
        vaultPath: tempObsidianVaultPath.value,
        subfolder,
        autoCreateNote: tempObsidianAutoCreateNote.value,
      })
      obsidianVaultPath.value = tempObsidianVaultPath.value
      obsidianSubfolder.value = subfolder
      tempObsidianSubfolder.value = subfolder
      obsidianAutoCreateNote.value = tempObsidianAutoCreateNote.value
    }
    if (tempShowToolsButton.value !== showToolsButton.value) {
      await window.electronAPI.config.setShowToolsButton(tempShowToolsButton.value)
      showToolsButton.value = tempShowToolsButton.value
    }
  }

  return {
    tempWatchNotesEnabled,
    tempWatchNotesProvider,
    tempObsidianVaultPath,
    tempObsidianSubfolder,
    tempObsidianAutoCreateNote,
    tempObsidianVaultIsVault,
    selectObsidianVault,
    notionTokenInput,
    notionStoredToken,
    showNotionToken,
    notionBusy,
    notionError,
    connectNotion,
    disconnectNotion,
    tempShowToolsButton,
    load,
    resetTemp,
    save,
  }
}

export type UseAddonsSettingsReturn = ReturnType<typeof useAddonsSettings>
