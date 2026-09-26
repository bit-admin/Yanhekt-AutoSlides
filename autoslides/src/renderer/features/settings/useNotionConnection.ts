import { ref } from 'vue'
import type { NotionErrorCode } from '@common/notionNotesTypes'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('NotionConnection')

/**
 * The Notion watch-notes connection: a personal internal-connection token that
 * is verified against Notion and stored the moment Connect is clicked (never
 * buffered with the rest of Settings). The connected state itself is read from
 * configStore.notionConnected / notionWorkspaceName.
 *
 * Each caller owns its own instance — Settings → Add-ons resets it on
 * prepare/discard, the onboarding Notion step just creates one.
 */
export function useNotionConnection() {
  const tokenInput = ref('')
  /** The stored token, shown (masked by default) while connected. */
  const storedToken = ref('')
  const showToken = ref(false)
  const busy = ref(false)
  const error = ref<NotionErrorCode | null>(null)

  const loadStoredToken = async () => {
    try {
      storedToken.value = (await window.electronAPI.notionNotes.getToken()) ?? ''
    } catch (err) {
      log.warn('could not read the Notion token', err)
      storedToken.value = ''
    }
  }

  const connect = async () => {
    const token = tokenInput.value.trim()
    if (!token || busy.value) return
    busy.value = true
    error.value = null
    try {
      const res = await window.electronAPI.notionNotes.connect(token)
      if (res.ok) {
        storedToken.value = token
        tokenInput.value = ''
      } else {
        error.value = res.error
      }
    } catch {
      error.value = 'network'
    } finally {
      busy.value = false
    }
  }

  const disconnect = async () => {
    if (busy.value) return
    busy.value = true
    error.value = null
    try {
      await window.electronAPI.notionNotes.disconnect()
      storedToken.value = ''
    } finally {
      busy.value = false
    }
  }

  /** Clear the form and re-read the stored token. */
  const reset = () => {
    tokenInput.value = ''
    error.value = null
    showToken.value = false
    void loadStoredToken()
  }

  return { tokenInput, storedToken, showToken, busy, error, loadStoredToken, connect, disconnect, reset }
}

export type NotionConnection = ReturnType<typeof useNotionConnection>
