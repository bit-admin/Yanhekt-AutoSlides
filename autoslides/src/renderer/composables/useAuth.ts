import { ref, type Ref } from 'vue'
import { AuthService, TokenManager } from '../services/authService'
import { ApiClient } from '../services/apiClient'

// Shared state (singleton pattern for cross-component access)
const isBrowserLoginActive = ref(false)
const isLoggedIn = ref(false)
const userNickname = ref('User')
const userId = ref('user123')
const isVerifyingToken = ref(false)
const isNicknameMasked = ref(false)
const isUserIdMasked = ref(false)

// Shared services (singleton)
const tokenManager = new TokenManager()
const authService = new AuthService(tokenManager)
const apiClient = new ApiClient()

// Shared masking timer
let maskingTimer: ReturnType<typeof setTimeout> | null = null

export interface UseAuthReturn {
  // State
  isLoggedIn: Ref<boolean>
  username: Ref<string>
  password: Ref<string>
  userNickname: Ref<string>
  userId: Ref<string>
  isLoading: Ref<boolean>
  isVerifyingToken: Ref<boolean>
  isNicknameMasked: Ref<boolean>
  isUserIdMasked: Ref<boolean>

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
  verifyExistingToken: () => Promise<void>
  toggleNicknameMask: () => void
  toggleUserIdMask: () => void
  startMaskingTimer: () => void
  clearMaskingTimer: () => void

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

  // Masking functions
  const startMaskingTimer = () => {
    if (maskingTimer) {
      clearTimeout(maskingTimer)
    }

    isNicknameMasked.value = false
    isUserIdMasked.value = false

    maskingTimer = setTimeout(() => {
      isNicknameMasked.value = true
      isUserIdMasked.value = true
    }, 5000)
  }

  const toggleNicknameMask = () => {
    isNicknameMasked.value = !isNicknameMasked.value
  }

  const toggleUserIdMask = () => {
    isUserIdMasked.value = !isUserIdMasked.value
  }

  const clearMaskingTimer = () => {
    if (maskingTimer) {
      clearTimeout(maskingTimer)
      maskingTimer = null
    }
    isNicknameMasked.value = false
    isUserIdMasked.value = false
  }

  // Auth functions
  const login = async () => {
    if (!username.value || !password.value) return

    isLoading.value = true
    try {
      const result = await authService.loginAndGetToken(username.value, password.value)

      if (result.success && result.token) {
        const verificationResult = await apiClient.verifyToken(result.token)

        if (verificationResult.valid && verificationResult.userData) {
          isLoggedIn.value = true
          userNickname.value = verificationResult.userData.nickname || username.value
          userId.value = verificationResult.userData.badge || 'unknown'
          startMaskingTimer()
          console.log('Login successful')
          onLoginSuccess?.()
        } else {
          console.error('Token verification failed after login')
          alert('Login failed: Token verification failed')
        }
      } else {
        console.error('Login failed:', result.error)
        alert(`Login failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('Login failed: Network error or server exception')
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    tokenManager.clearToken()
    clearMaskingTimer()
    isLoggedIn.value = false
    username.value = ''
    password.value = ''
    userNickname.value = 'User'
    userId.value = 'user123'
  }

  const verifyExistingToken = async () => {
    const token = tokenManager.getToken()
    if (!token) return

    isVerifyingToken.value = true
    try {
      const result = await apiClient.verifyToken(token)
      if (result.valid && result.userData) {
        isLoggedIn.value = true
        userNickname.value = result.userData.nickname || 'User'
        userId.value = result.userData.badge || 'unknown'
        startMaskingTimer()
        console.log('Existing token verified successfully')
      } else {
        if (!result.networkError) {
          tokenManager.clearToken()
          console.log('Existing token is invalid, cleared')
        } else {
          console.log('Network error during token verification, keeping token')
        }
      }
    } catch (error) {
      console.error('Token verification error:', error)
      tokenManager.clearToken()
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

        isLoggedIn.value = true
        userNickname.value = result.userData.nickname || 'User'
        userId.value = result.userData.badge || 'unknown'
        startMaskingTimer()

        tokenManager.saveToken(manualToken.value.trim())

        console.log('Manual token verification successful')
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
      console.error('Token verification error:', error)
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
        tokenManager.saveToken(token)
        isLoggedIn.value = true
        userNickname.value = result.userData.nickname || 'User'
        userId.value = result.userData.badge || 'unknown'
        startMaskingTimer()
        console.log('Browser login successful')
        onLoginSuccess?.()
        // Close browser login view after successful login
        closeBrowserLogin()
      } else {
        console.error('Browser token verification failed')
        alert('Token verification failed. Please try again.')
      }
    } catch (error) {
      console.error('Browser token verification error:', error)
      alert('Token verification failed: Network error or server exception')
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
    isNicknameMasked,
    isUserIdMasked,
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
    verifyExistingToken,
    toggleNicknameMask,
    toggleUserIdMask,
    startMaskingTimer,
    clearMaskingTimer,

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
