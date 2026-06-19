import { ref } from 'vue'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('CopilotOAuth');

export type CopilotOAuthStep = 'idle' | 'waiting' | 'polling' | 'success' | 'error'

export interface ModelPreset {
  label: string
  name: string
}

export function useCopilotOAuth() {
  const copilotGhoToken = ref('')
  const tempCopilotGhoToken = ref('')
  const copilotModelName = ref('gpt-4.1')
  const tempCopilotModelName = ref('gpt-4.1')
  const copilotUsername = ref('')
  const copilotAvatarUrl = ref('')
  const showCopilotToken = ref(false)
  const copilotOAuthStep = ref<CopilotOAuthStep>('idle')
  const copilotUserCode = ref('')
  const copilotVerificationUri = ref('')
  const copilotOAuthError = ref('')
  const isCopilotLoading = ref(false)
  let copilotOAuthCancelled = false

  const copilotModelPresets: ModelPreset[] = [
    { label: 'GPT 5 mini', name: 'gpt-5-mini' },
    { label: 'GPT 4.1', name: 'gpt-4.1' }
  ]
  const selectedCopilotModelPreset = ref('')

  // Apply loaded copilot fields from an AIFilteringConfig payload.
  const applyLoadedConfig = async (cfg: {
    copilotGhoToken?: string
    copilotModelName?: string
    copilotUsername?: string
    copilotAvatarUrl?: string
  }) => {
    copilotGhoToken.value = cfg.copilotGhoToken || ''
    tempCopilotGhoToken.value = cfg.copilotGhoToken || ''
    copilotModelName.value = cfg.copilotModelName || 'gpt-4.1'
    tempCopilotModelName.value = cfg.copilotModelName || 'gpt-4.1'
    copilotUsername.value = cfg.copilotUsername || ''
    copilotAvatarUrl.value = cfg.copilotAvatarUrl || ''

    if (copilotGhoToken.value) {
      copilotOAuthStep.value = 'success'
      if (!copilotUsername.value) {
        try {
          const userInfo = await window.electronAPI.copilot.getUserInfo(copilotGhoToken.value)
          copilotUsername.value = userInfo.login
          copilotAvatarUrl.value = userInfo.avatar_url
        } catch {
          log.warn('[Copilot] Failed to fetch user info on load')
        }
      }
    }
  }

  const startCopilotOAuth = async () => {
    copilotOAuthError.value = ''
    copilotOAuthStep.value = 'waiting'
    isCopilotLoading.value = true
    copilotOAuthCancelled = false

    try {
      const deviceCode = await window.electronAPI.copilot.requestDeviceCode()

      if (copilotOAuthCancelled) return

      copilotUserCode.value = deviceCode.user_code
      copilotVerificationUri.value = deviceCode.verification_uri

      try {
        await navigator.clipboard.writeText(deviceCode.user_code)
      } catch {
        // Clipboard API may not be available, ignore
      }

      await window.electronAPI.shell.openExternal(deviceCode.verification_uri)

      if (copilotOAuthCancelled) return

      copilotOAuthStep.value = 'polling'

      const accessToken = await window.electronAPI.copilot.pollForAccessToken(
        deviceCode.device_code,
        deviceCode.interval
      )

      if (copilotOAuthCancelled) return

      copilotGhoToken.value = accessToken
      tempCopilotGhoToken.value = accessToken

      const userInfo = await window.electronAPI.copilot.getUserInfo(accessToken)
      copilotUsername.value = userInfo.login
      copilotAvatarUrl.value = userInfo.avatar_url

      copilotOAuthStep.value = 'success'

      await window.electronAPI.config.setAIFilteringConfig({
        copilotGhoToken: accessToken,
        copilotUsername: userInfo.login,
        copilotAvatarUrl: userInfo.avatar_url
      })
    } catch (error) {
      if (copilotOAuthCancelled) return
      const msg = error instanceof Error ? error.message : String(error)
      copilotOAuthStep.value = 'error'
      if (msg.includes('expired_token')) {
        copilotOAuthError.value = 'expired_token'
      } else if (msg.includes('access_denied')) {
        copilotOAuthError.value = 'access_denied'
      } else {
        copilotOAuthError.value = msg
      }
    } finally {
      if (!copilotOAuthCancelled) {
        isCopilotLoading.value = false
      }
    }
  }

  const validateCopilotToken = async (token: string): Promise<boolean> => {
    isCopilotLoading.value = true
    copilotOAuthError.value = ''

    try {
      const isValid = await window.electronAPI.copilot.validateToken(token)
      if (!isValid) {
        copilotOAuthError.value = 'invalid_token'
        return false
      }

      copilotGhoToken.value = token
      tempCopilotGhoToken.value = token

      const userInfo = await window.electronAPI.copilot.getUserInfo(token)
      copilotUsername.value = userInfo.login
      copilotAvatarUrl.value = userInfo.avatar_url

      copilotOAuthStep.value = 'success'

      await window.electronAPI.config.setAIFilteringConfig({
        copilotGhoToken: token,
        copilotUsername: userInfo.login,
        copilotAvatarUrl: userInfo.avatar_url
      })

      return true
    } catch {
      copilotOAuthError.value = 'invalid_token'
      return false
    } finally {
      isCopilotLoading.value = false
    }
  }

  const disconnectCopilot = async () => {
    copilotGhoToken.value = ''
    tempCopilotGhoToken.value = ''
    copilotUsername.value = ''
    copilotAvatarUrl.value = ''
    copilotOAuthStep.value = 'idle'
    copilotOAuthError.value = ''
    copilotUserCode.value = ''

    await window.electronAPI.copilot.clearCache()
    await window.electronAPI.config.setAIFilteringConfig({
      copilotGhoToken: '',
      copilotUsername: '',
      copilotAvatarUrl: ''
    })
  }

  const cancelCopilotOAuth = () => {
    copilotOAuthCancelled = true
    copilotOAuthStep.value = 'idle'
    copilotUserCode.value = ''
    copilotVerificationUri.value = ''
    copilotOAuthError.value = ''
    isCopilotLoading.value = false
  }

  const onCopilotModelPresetChange = () => {
    if (selectedCopilotModelPreset.value) {
      tempCopilotModelName.value = selectedCopilotModelPreset.value
    }
  }

  const resetTemp = () => {
    tempCopilotModelName.value = copilotModelName.value
    tempCopilotGhoToken.value = copilotGhoToken.value
    selectedCopilotModelPreset.value = ''
    showCopilotToken.value = false
  }

  return {
    copilotGhoToken,
    tempCopilotGhoToken,
    copilotModelName,
    tempCopilotModelName,
    copilotUsername,
    copilotAvatarUrl,
    showCopilotToken,
    copilotOAuthStep,
    copilotUserCode,
    copilotVerificationUri,
    copilotOAuthError,
    isCopilotLoading,
    copilotModelPresets,
    selectedCopilotModelPreset,

    applyLoadedConfig,
    startCopilotOAuth,
    validateCopilotToken,
    disconnectCopilot,
    cancelCopilotOAuth,
    onCopilotModelPresetChange,
    resetTemp
  }
}

export type UseCopilotOAuthReturn = ReturnType<typeof useCopilotOAuth>
