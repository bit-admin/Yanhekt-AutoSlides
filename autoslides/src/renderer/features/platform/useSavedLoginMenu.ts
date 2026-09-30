import { computed, ref, watch, type Ref } from 'vue'
import { configStore } from '@shared/services/configStore'

export interface SavedLoginRow {
  badge: string
  username: string
}

/**
 * State for the saved-logins menu shared by the SSO form
 * (`SsoCredentialFields`) and the browser sign-in view, where the menu is drawn
 * over a <webview>. The row list carries usernames only; a password is
 * decrypted by `reveal()` once the user has picked a row.
 *
 * `query` is the username typed so far. It filters rows by prefix.
 */
export function useSavedLoginMenu(query: Ref<string>) {
  const logins = ref<SavedLoginRow[]>([])
  const open = ref(false)
  // -1 = no row chosen. Only the arrow keys or the mouse pick a row, so Enter
  // signs in with what was typed unless the user actually moved into the menu.
  const highlight = ref(-1)

  const enabled = computed(() => configStore.rememberPassword !== false)
  const hasLogins = computed(() => enabled.value && logins.value.length > 0)

  const matches = computed(() => {
    const prefix = query.value.trim().toLowerCase()
    if (!prefix) return logins.value
    return logins.value.filter((row) => row.username.toLowerCase().startsWith(prefix))
  })

  const visible = computed(() => open.value && matches.value.length > 0)
  const current = computed(() => (visible.value ? matches.value[highlight.value] ?? null : null))

  // The filter changed, so a stale highlight could point at another account.
  watch(query, () => {
    highlight.value = -1
  })

  watch(enabled, (on) => {
    if (!on) close()
  })

  async function refresh(): Promise<void> {
    if (!enabled.value) {
      logins.value = []
      return
    }
    try {
      logins.value = await window.electronAPI.auth.listSavedLogins()
    } catch {
      logins.value = []
    }
  }

  async function show(): Promise<void> {
    if (!enabled.value) return
    if (logins.value.length === 0) await refresh()
    if (matches.value.length === 0) return
    highlight.value = -1
    open.value = true
  }

  function close(): void {
    open.value = false
    highlight.value = -1
  }

  function toggle(): void {
    if (open.value) close()
    else void show()
  }

  function move(delta: 1 | -1): void {
    const count = matches.value.length
    if (!visible.value || count === 0) return
    if (delta > 0) highlight.value = (highlight.value + 1) % count
    else highlight.value = highlight.value <= 0 ? count - 1 : highlight.value - 1
  }

  async function reveal(row: SavedLoginRow): Promise<{ username: string; password: string } | null> {
    try {
      return await window.electronAPI.auth.getSavedLogin(row.badge)
    } catch {
      return null
    }
  }

  return {
    enabled,
    hasLogins,
    matches,
    open,
    visible,
    highlight,
    current,
    refresh,
    show,
    close,
    toggle,
    move,
    reveal,
  }
}
