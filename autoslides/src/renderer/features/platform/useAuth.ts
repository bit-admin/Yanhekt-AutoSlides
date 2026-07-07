import { ref, type Ref } from 'vue'
import { AuthService, TokenManager, tokenManager } from '@shared/services/authService'
import { ApiClient, type UserData } from '@shared/services/apiClient'
import { toDisplayName } from './usePinyinName'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('PlatformAuth');

// Shared state (singleton pattern for cross-component access)
const isBrowserLoginActive = ref(false)
const isLoggedIn = ref(false)
const userNickname = ref('User')
const userId = ref('user123')
const isVerifyingToken = ref(false)

// Shared services (singleton)
const authService = new AuthService(tokenManager)
const apiClient = new ApiClient()

function persistUserNames(nickname: string): void {
  const display = toDisplayName(nickname)
  window.electronAPI.config.setUserNames(nickname, display)
}

// Apply a freshly-verified user to the shared auth state and record it as the
// active account. Used by every verify path (login, existing-token, manual token,
// browser login, account switch) so identity + token capture stays in one place.
function applyVerifiedUser(userData: UserData, token: string, fallbackNickname = 'User'): void {
  const nickname = userData.nickname || fallbackNickname
  const badge = userData.badge || 'unknown'
  isLoggedIn.value = true
  userNickname.value = nickname
  userId.value = badge
  persistUserNames(nickname)
  tokenManager.saveToken(token)
  const now = Date.now()
  const existing = (configStore.accounts ?? []).find((a) => a.badge === badge)
  window.electronAPI.config.upsertAccount({
    badge,
    nickname,
    displayName: toDisplayName(nickname),
    token,
    addedAt: existing?.addedAt ?? now,
    lastUsedAt: now,
  })
}

export interface UseAuthReturn {
  // State
  isLoggedIn: Ref<boolean>
  username: Ref<string>
  password: Ref<string>
  userNickname: Ref<string>
  userId: Ref<string>
  isLoading: Ref<boolean>
  isVerifyingToken: Ref<boolean>

  // Manual token auth state
  manualToken: Ref<string>
  showToken: Ref<boolean>
  isVerifyingManualToken: Ref<boolean>
  tokenVerificationStatus: Ref<{ type: 'success' | 'error'; message: string } | null>

  // Browser login state (shared across all instances)
  isBrowserLoginActive: Ref<boolean>

  // Methods
  login: () => Promise<void>
  logout: () => void
  deactivate: () => void
  switchAccount: (badge: string) => Promise<void>
  verifyExistingToken: () => Promise<void>

  // Manual token methods
  toggleTokenVisibility: () => void
  onTokenInput: () => void
  verifyManualToken: () => Promise<void>
  loadManualToken: () => void

  // Browser login methods
  openBrowserLogin: () => void
  closeBrowserLogin: () => void
  handleBrowserToken: (token: string) => Promise<void>

  // Token manager instance for other composables
  tokenManager: TokenManager
}

export function useAuth(onLoginSuccess?: () => void): UseAuthReturn {
  // Local state (per-instance)
  const username = ref('')
  const password = ref('')
  const isLoading = ref(false)

  // Manual token auth state (per-instance)
  const manualToken = ref('')
  const showToken = ref(false)
  const isVerifyingManualToken = ref(false)
  const tokenVerificationStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auth functions
  const login = async () => {
    if (!username.value || !password.value) return

    isLoading.value = true
    try {
      const result = await authService.loginAndGetToken(username.value, password.value)

      if (result.success && result.token) {
        const verificationResult = await apiClient.verifyToken(result.token)

        if (verificationResult.valid && verificationResult.userData) {
          applyVerifiedUser(verificationResult.userData, result.token, username.value)
          log.debug('Login successful')
          onLoginSuccess?.()
        } else {
          log.error('Token verification failed after login')
          void window.electronAPI.dialog?.showErrorBox?.('Login Failed', 'Token verification failed')
        }
      } else {
        log.error('Login failed:', result.error)
        void window.electronAPI.dialog?.showErrorBox?.('Login Failed', `${result.error}`)
      }
    } catch (error) {
      log.error('Login error:', error)
      void window.electronAPI.dialog?.showErrorBox?.('Login Failed', 'Network error or server exception')
    } finally {
      isLoading.value = false
    }
  }

  // Clear the active session (token + shared/local auth state) back to the
  // signed-out state. Does NOT touch the saved accounts list.
  const clearActiveSession = () => {
    tokenManager.clearToken()
    isLoggedIn.value = false
    username.value = ''
    password.value = ''
    userNickname.value = 'User'
    userId.value = 'user123'
    window.electronAPI.config.setUserNames('', '')
  }

  // Fully sign out of the active account AND forget it (remove from the saved
  // switch list). Also the invalid-token path (verifyExistingToken) and the
  // switch-failure path, where dropping the dead account is the right behavior.
  const logout = () => {
    const badge = userId.value
    if (badge && badge !== 'user123') {
      void window.electronAPI.config.removeAccount(badge)
    }
    clearActiveSession()
  }

  // Deactivate the active session WITHOUT forgetting the account (it stays in the
  // switch list). Backs the "Add account" flow: returns the UI to the signed-out
  // chooser so the user can sign in as another account, then switch back.
  const deactivate = () => {
    clearActiveSession()
  }

  const switchAccount = async (badge: string) => {
    const account = (configStore.accounts ?? []).find((a) => a.badge === badge)
    if (!account) return

    isVerifyingToken.value = true
    try {
      const result = await apiClient.verifyToken(account.token)
      if (result.valid && result.userData) {
        applyVerifiedUser(result.userData, account.token)
        log.debug('Account switch successful')
        onLoginSuccess?.()
      } else if (result.networkError) {
        // Keep the account and the previous active session on transient failure.
        void window.electronAPI.dialog?.showErrorBox?.('Switch Account', 'Network error while switching account. Please try again.')
      } else {
        // Token revoked/invalid: forget this account.
        void window.electronAPI.config.removeAccount(badge)
        void window.electronAPI.dialog?.showErrorBox?.('Switch Account', `The saved session for ${account.nickname || 'this account'} has expired. Please sign in again.`)
      }
    } catch (error) {
      log.error('Account switch error:', error)
      void window.electronAPI.dialog?.showErrorBox?.('Switch Account', 'Network error or server exception')
    } finally {
      isVerifyingToken.value = false
    }
  }

  const verifyExistingToken = async () => {
    const token = tokenManager.getToken()
    if (!token) return

    // Pre-populate the display name from stored names while waiting for the
    // API. Do NOT flip isLoggedIn here: the server is the authority, and the
    // LeftPanel shows the isVerifyingToken spinner during this window. Setting
    // it true optimistically would race HomePage's data load against a token
    // that may already be revoked.
    const stored = configStore
    if (stored.userOriginalNickname) {
      userNickname.value = stored.userOriginalNickname
    }

    isVerifyingToken.value = true
    try {
      const result = await apiClient.verifyToken(token)
      if (result.valid && result.userData) {
        applyVerifiedUser(result.userData, token)
        log.debug('Existing token verified successfully')
      } else {
        if (!result.networkError) {
          // Token revoked/invalid: fully reset auth state (token + UI) so the
          // user menu doesn't keep showing the logged-in banner.
          logout()
          log.debug('Existing token is invalid, signed out')
        } else {
          log.debug('Network error during token verification, keeping token')
        }
      }
    } catch (error) {
      log.error('Token verification error:', error)
      logout()
    } finally {
      isVerifyingToken.value = false
    }
  }

  // Manual token functions
  const toggleTokenVisibility = () => {
    showToken.value = !showToken.value
    const tokenInput = document.querySelector('.token-input') as HTMLInputElement
    if (tokenInput) {
      tokenInput.type = showToken.value ? 'text' : 'password'
    }
  }

  const onTokenInput = () => {
    tokenVerificationStatus.value = null
    if (manualToken.value.trim()) {
      tokenManager.saveToken(manualToken.value.trim())
    } else {
      tokenManager.clearToken()
    }
  }

  const verifyManualToken = async () => {
    if (!manualToken.value.trim()) return

    isVerifyingManualToken.value = true
    tokenVerificationStatus.value = null

    try {
      const result = await apiClient.verifyToken(manualToken.value.trim())

      if (result.valid && result.userData) {
        tokenVerificationStatus.value = {
          type: 'success',
          message: `Token verified successfully for ${result.userData.nickname || 'user'}`
        }

        applyVerifiedUser(result.userData, manualToken.value.trim())

        log.debug('Manual token verification successful')
      } else {
        tokenVerificationStatus.value = {
          type: 'error',
          message: result.networkError ? 'Network error during verification' : 'Invalid token'
        }

        if (!result.networkError) {
          tokenManager.clearToken()
          manualToken.value = ''
        }
      }
    } catch (error) {
      log.error('Token verification error:', error)
      tokenVerificationStatus.value = {
        type: 'error',
        message: 'Verification failed: Network error or server exception'
      }
    } finally {
      isVerifyingManualToken.value = false
    }
  }

  const loadManualToken = () => {
    const existingToken = tokenManager.getToken()
    if (existingToken) {
      manualToken.value = existingToken
    }
  }

  // Browser login methods
  const openBrowserLogin = () => {
    isBrowserLoginActive.value = true
  }

  const closeBrowserLogin = () => {
    isBrowserLoginActive.value = false
  }

  const handleBrowserToken = async (token: string) => {
    if (!token) return

    isVerifyingToken.value = true
    try {
      const result = await apiClient.verifyToken(token)

      if (result.valid && result.userData) {
        applyVerifiedUser(result.userData, token)
        log.debug('Browser login successful')
        onLoginSuccess?.()
        // Close browser login view after successful login
        closeBrowserLogin()
      } else {
        log.error('Browser token verification failed')
        void window.electronAPI.dialog?.showErrorBox?.('Login Failed', 'Token verification failed. Please try again.')
      }
    } catch (error) {
      log.error('Browser token verification error:', error)
      void window.electronAPI.dialog?.showErrorBox?.('Login Failed', 'Token verification failed: Network error or server exception')
    } finally {
      isVerifyingToken.value = false
    }
  }

  return {
    // Shared state
    isLoggedIn,
    userNickname,
    userId,
    isVerifyingToken,
    isBrowserLoginActive,

    // Local state
    username,
    password,
    isLoading,

    // Manual token state
    manualToken,
    showToken,
    isVerifyingManualToken,
    tokenVerificationStatus,

    // Methods
    login,
    logout,
    deactivate,
    switchAccount,
    verifyExistingToken,

    // Manual token methods
    toggleTokenVisibility,
    onTokenInput,
    verifyManualToken,
    loadManualToken,

    // Browser login methods
    openBrowserLogin,
    closeBrowserLogin,
    handleBrowserToken,

    // Token manager
    tokenManager
  }
}
