<template>
  <div class="left-panel">
    <div class="login-section">
      <div v-if="isVerifyingToken" class="verifying-state">
        <h3>Verifying...</h3>
        <p>Verifying login status, please wait...</p>
        <div class="loading-spinner"></div>
      </div>
      <div v-else-if="!isLoggedIn" class="login-form">
        <h3>Sign In</h3>
        <p>Please sign in to Yanhekt to access all resources.</p>
        <div class="input-group">
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            class="input-field"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            class="input-field"
          />
        </div>
        <button @click="login" :disabled="isLoading" class="login-btn">
          {{ isLoading ? 'Signing In...' : 'Sign In' }}
        </button>
      </div>
      <div v-else class="user-info">
        <h3>Hi there, {{ userNickname }}</h3>
        <p>Sign in as {{ userId }}</p>
        <p>You can now access all resources from Yanhekt.</p>
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>Settings</h3>
        <button @click="openAdvancedSettings" class="advanced-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Advanced Settings
        </button>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <label class="setting-label">Output Directory</label>
          <div class="directory-input-group">
            <input
              v-model="outputDirectory"
              type="text"
              readonly
              class="directory-input"
              :title="outputDirectory"
            />
            <button @click="selectOutputDirectory" class="browse-btn">Browse</button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Connection Mode</label>
          <div class="mode-toggle">
            <button
              @click="setConnectionMode('internal')"
              :class="['mode-btn', { active: connectionMode === 'internal' }]"
            >
              Internal Network
            </button>
            <button
              @click="setConnectionMode('external')"
              :class="['mode-btn', { active: connectionMode === 'external' }]"
            >
              External Network
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Audio Mode</label>
          <div class="audio-mode-selector">
            <select v-model="muteMode" @change="setMuteMode" class="audio-mode-select">
              <option value="normal">Normal</option>
              <option value="mute_all">Mute All</option>
              <option value="mute_live">Mute Live</option>
              <option value="mute_recorded">Mute Recorded</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Theme</label>
          <div class="theme-selector">
            <select v-model="themeMode" @change="setThemeMode" class="theme-select">
              <option value="system">Follow System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Slide Detection Interval</label>
          <div class="setting-description">The interval will be automatically adjusted based on playback speed (default: 2000ms).</div>
          <div class="slide-interval-group">
            <div class="slide-interval-input-wrapper">
              <input
                v-model.number="slideCheckInterval"
                type="number"
                min="1000"
                max="10000"
                step="500"
                class="slide-interval-input"
                @change="setSlideCheckInterval"
                @blur="validateAndCorrectInterval"
              />
              <span class="interval-unit">milliseconds</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Slide Stability Verification</label>
          <div class="setting-description">Prevents false detection from animations by confirming a new slide after it remains unchanged for several consecutive checks (default: 2 checks).</div>
          <div class="verification-unified-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="slideDoubleVerification"
                @change="setSlideDoubleVerification"
              />
              Enable Checks
            </label>
            <div class="verification-count-control" v-if="slideDoubleVerification">
              <span class="count-label">Count:</span>
              <select
                v-model="slideVerificationCount"
                @change="setSlideDoubleVerification"
                class="verification-count-select"
              >
                <option v-for="i in 5" :key="i" :value="i">{{ i }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Task Speed</label>
          <div class="setting-description">Playback speed for automated task processing.</div>
          <div class="task-speed-selector">
            <select v-model="taskSpeed" @change="setTaskSpeed" class="task-speed-select">
              <option v-for="i in 10" :key="i" :value="i">{{ i }}x</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <div class="status-row">
        <span class="status-label">Connection</span>
        <span :class="['status-value', connectionMode]">
          {{ connectionMode === 'internal' ? 'Internal Network' : 'External Network' }}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Task Status</span>
        <span class="status-value">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Download Queue</span>
        <span class="status-value">{{ downloadQueueStatus }}</span>
      </div>
    </div>

    <div v-if="showAdvancedModal" class="modal-overlay" @click="closeAdvancedSettings">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Advanced Settings</h3>
          <button @click="closeAdvancedSettings" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="advanced-settings-content">
            <div class="advanced-setting-section">
              <h4>Authentication</h4>
              <div class="setting-item">
                <label class="setting-label">Token</label>
                <div class="setting-description">Manually input your authentication token for direct access.</div>
                <div class="token-input-group">
                  <input
                    v-model="manualToken"
                    type="password"
                    placeholder="Enter your token here..."
                    class="token-input"
                    @input="onTokenInput"
                  />
                  <button @click="toggleTokenVisibility" class="token-toggle-btn" :title="showToken ? 'Hide token' : 'Show token'">
                    <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <button @click="verifyManualToken" :disabled="!manualToken || isVerifyingManualToken" class="verify-token-btn">
                    {{ isVerifyingManualToken ? 'Verifying...' : 'Verify' }}
                  </button>
                </div>
                <div v-if="tokenVerificationStatus" :class="['token-status', tokenVerificationStatus.type]">
                  {{ tokenVerificationStatus.message }}
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>Image Processing</h4>
              <div class="setting-item">
                <label class="setting-label">SSIM Threshold</label>
                <div class="setting-description">Higher global structural similarity threshold indicate stricter matching. You can test the detection accuracy in <strong>Menu > Help > SSIM Test.</strong></div>
                <input
                  v-model.number="tempSsimThreshold"
                  type="number"
                  min="0.9"
                  max="1.0"
                  step="0.0001"
                  class="ssim-select"
                  @change="updateImageProcessingParams"
                />
                <div class="setting-description">Adjust <strong>ONLY IF NECESSARY</strong>, as a minor change of 0.001 can significantly impact performance (default: 0.999; alternative: 0.998 for a looser threshold).</div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>Video Playback</h4>
              <div class="setting-item">
                <label class="setting-label">Video Error Retry Count</label>
                <div class="setting-description">Number of retry attempts when video playback errors occur.</div>
                <select
                  v-model="tempVideoRetryCount"
                  class="concurrent-select"
                  @change="updateVideoRetryCount"
                >
                  <option v-for="i in 6" :key="i" :value="i + 4">{{ i + 4 }}</option>
                </select>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>Download</h4>
              <div class="setting-item">
                <label class="setting-label">Concurrent Download Limit</label>
                <div class="setting-description">Maximum number of simultaneous downloads and processing.</div>
                <select
                  v-model="tempMaxConcurrentDownloads"
                  class="concurrent-select"
                  @change="updateMaxConcurrentDownloads"
                >
                  <option v-for="i in 10" :key="i" :value="i">{{ i }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="closeAdvancedSettings" class="cancel-btn">Cancel</button>
            <button @click="saveAdvancedSettings" class="save-btn">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { AuthService, TokenManager } from '../services/authService'
import { ApiClient } from '../services/apiClient'
import { DownloadService } from '../services/downloadService'
import { TaskQueue, taskQueueState } from '../services/taskQueueService'

const isLoggedIn = ref(false)
const username = ref('')
const password = ref('')
const userNickname = ref('User')
const userId = ref('user123')
const connectionMode = ref<'internal' | 'external'>('external')
const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
const themeMode = ref<'system' | 'light' | 'dark'>('system')

const taskStatus = computed(() => {
  const stats = taskQueueState.value
  const queued = stats.queuedCount
  const inProgress = stats.inProgressCount
  const completed = stats.completedCount
  const errors = stats.errorCount

  // Show most relevant status (similar to download status logic)
  if (stats.isProcessing && inProgress > 0) {
    const currentTask = stats.currentTask
    if (currentTask && currentTask.progress > 0) {
      return `Processing ${currentTask.progress}%, ${queued} queued`
    } else {
      return `${inProgress} processing, ${queued} queued`
    }
  } else if (queued > 0) {
    if (stats.isProcessing) {
      return `Starting tasks... ${queued} queued`
    } else {
      return `${queued} queued (paused)`
    }
  } else if (completed > 0 || errors > 0) {
    return `${completed} completed, ${errors} failed`
  } else {
    return 'No tasks'
  }
})

const downloadQueueStatus = computed(() => {
  const queued = DownloadService.queuedCount
  const active = DownloadService.activeCount
  const completed = DownloadService.completedCount
  const errors = DownloadService.errorCount

  // Show most relevant status
  if (active > 0) {
    return `${active} downloading, ${queued} queued`
  } else if (queued > 0) {
    return `${queued} queued`
  } else if (completed > 0 || errors > 0) {
    return `${completed} done, ${errors} failed`
  } else {
    return 'No downloads'
  }
})
const showAdvancedModal = ref(false)
const isLoading = ref(false)
const isVerifyingToken = ref(false)
const outputDirectory = ref('')
const maxConcurrentDownloads = ref(5)
const tempMaxConcurrentDownloads = ref(5)
const videoRetryCount = ref(5)
const tempVideoRetryCount = ref(5)

// Slide extraction configuration
const slideCheckInterval = ref(2000)
const slideDoubleVerification = ref(true)
const slideVerificationCount = ref(2)

// Task configuration
const taskSpeed = ref(10)

// Advanced image processing parameters
const ssimThreshold = ref(0.999)
const tempSsimThreshold = ref(0.999)

// Manual token authentication
const manualToken = ref('')
const showToken = ref(false)
const isVerifyingManualToken = ref(false)
const tokenVerificationStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const tokenManager = new TokenManager()
const authService = new AuthService(tokenManager)
const apiClient = new ApiClient()

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
        console.log('Login successful')
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

const loadConfig = async () => {
  try {
    const config = await window.electronAPI.config.get()
    outputDirectory.value = config.outputDirectory
    connectionMode.value = config.connectionMode
    muteMode.value = config.muteMode || 'normal'
    maxConcurrentDownloads.value = config.maxConcurrentDownloads || 5
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    videoRetryCount.value = config.videoRetryCount || 5
    tempVideoRetryCount.value = videoRetryCount.value

    // Load slide extraction configuration
    const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
    slideCheckInterval.value = slideConfig.checkInterval || 2000
    // Validate loaded value to ensure it meets new requirements
    validateAndCorrectInterval()
    slideDoubleVerification.value = slideConfig.enableDoubleVerification !== false
    slideVerificationCount.value = slideConfig.verificationCount || 2

    // Load task configuration
    taskSpeed.value = config.taskSpeed || 10

    // Load theme configuration
    themeMode.value = config.themeMode || 'system'

    // Load advanced image processing parameters
    ssimThreshold.value = slideConfig.ssimThreshold || 0.999
    tempSsimThreshold.value = ssimThreshold.value
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

const selectOutputDirectory = async () => {
  try {
    const result = await window.electronAPI.config.selectOutputDirectory()
    if (result) {
      outputDirectory.value = result.outputDirectory
    }
  } catch (error) {
    console.error('Failed to select output directory:', error)
  }
}

const setConnectionMode = async (mode: 'internal' | 'external') => {
  try {
    const result = await window.electronAPI.config.setConnectionMode(mode)
    connectionMode.value = result.connectionMode
  } catch (error) {
    console.error('Failed to set connection mode:', error)
  }
}

const setMuteMode = async () => {
  try {
    const result = await window.electronAPI.config.setMuteMode(muteMode.value)
    muteMode.value = result.muteMode
  } catch (error) {
    console.error('Failed to set mute mode:', error)
  }
}

// Slide extraction configuration methods
const validateAndCorrectInterval = () => {
  // Ensure the value is a valid number
  if (isNaN(slideCheckInterval.value) || slideCheckInterval.value === null || slideCheckInterval.value === undefined) {
    slideCheckInterval.value = 2000 // Default value
    return
  }

  // Convert to integer to avoid floating point issues
  let value = Math.round(slideCheckInterval.value)

  // Enforce minimum and maximum bounds
  if (value < 1000) {
    value = 1000
  } else if (value > 10000) {
    value = 10000
  }

  // Round to nearest 500 multiple
  const remainder = value % 500
  if (remainder !== 0) {
    // Round to nearest 500 multiple
    if (remainder <= 250) {
      value = value - remainder // Round down (including exactly 250)
    } else {
      value = value + (500 - remainder) // Round up
    }
  }

  // Ensure we don't go below minimum after rounding
  if (value < 1000) {
    value = 1000
  }

  // Update the value if it was corrected
  if (value !== slideCheckInterval.value) {
    slideCheckInterval.value = value
    console.log(`Slide check interval corrected to: ${value}ms`)
  }
}

const setSlideCheckInterval = async () => {
  try {
    // Validate and correct the value before saving
    validateAndCorrectInterval()

    const result = await window.electronAPI.config.setSlideCheckInterval(slideCheckInterval.value)
    slideCheckInterval.value = result.checkInterval
  } catch (error) {
    console.error('Failed to set slide check interval:', error)
  }
}

const setSlideDoubleVerification = async () => {
  try {
    const result = await window.electronAPI.config.setSlideDoubleVerification(
      slideDoubleVerification.value,
      slideVerificationCount.value
    )
    slideDoubleVerification.value = result.enableDoubleVerification
    slideVerificationCount.value = result.verificationCount
  } catch (error) {
    console.error('Failed to set slide double verification:', error)
  }
}

const setTaskSpeed = async () => {
  try {
    const result = await window.electronAPI.config.setTaskSpeed(taskSpeed.value)
    taskSpeed.value = result.taskSpeed
  } catch (error) {
    console.error('Failed to set task speed:', error)
  }
}

const setThemeMode = async () => {
  try {
    const result = await window.electronAPI.config.setThemeMode(themeMode.value)
    themeMode.value = result.themeMode
  } catch (error) {
    console.error('Failed to set theme mode:', error)
  }
}

onMounted(() => {
  verifyExistingToken()
  loadConfig()
})

const openAdvancedSettings = () => {
  // Reset temp values to current values when opening modal
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  tempSsimThreshold.value = ssimThreshold.value

  // Load manual token from localStorage
  loadManualToken()
  tokenVerificationStatus.value = null
  showToken.value = false

  showAdvancedModal.value = true
}

const closeAdvancedSettings = () => {
  // Reset temp values when canceling
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  tempSsimThreshold.value = ssimThreshold.value
  showAdvancedModal.value = false
}

const updateMaxConcurrentDownloads = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const updateVideoRetryCount = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const updateImageProcessingParams = () => {
  // This is called when the inputs change, but we don't save until "Save" is clicked
}

const saveAdvancedSettings = async () => {
  try {
    // Save concurrent downloads setting
    const downloadResult = await window.electronAPI.config.setMaxConcurrentDownloads(tempMaxConcurrentDownloads.value)
    maxConcurrentDownloads.value = downloadResult.maxConcurrentDownloads

    // Save video retry count setting
    const retryResult = await window.electronAPI.config.setVideoRetryCount(tempVideoRetryCount.value)
    videoRetryCount.value = retryResult.videoRetryCount

    // Save image processing parameters
    const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
      ssimThreshold: tempSsimThreshold.value
    })
    ssimThreshold.value = imageProcessingResult.ssimThreshold

    // Also update the download service
    const { DownloadService } = await import('../services/downloadService')
    DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)

    showAdvancedModal.value = false
  } catch (error) {
    console.error('Failed to save advanced settings:', error)
    alert('Failed to save settings')
  }
}

// Manual token authentication methods
const toggleTokenVisibility = () => {
  showToken.value = !showToken.value
  // Update input type dynamically
  const tokenInput = document.querySelector('.token-input') as HTMLInputElement
  if (tokenInput) {
    tokenInput.type = showToken.value ? 'text' : 'password'
  }
}

const onTokenInput = () => {
  // Clear previous verification status when user types
  tokenVerificationStatus.value = null
  // Save token to localStorage as user types
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

      // Update login state
      isLoggedIn.value = true
      userNickname.value = result.userData.nickname || 'User'
      userId.value = result.userData.badge || 'unknown'

      // Save the verified token
      tokenManager.saveToken(manualToken.value.trim())

      console.log('Manual token verification successful')
    } else {
      tokenVerificationStatus.value = {
        type: 'error',
        message: result.networkError ? 'Network error during verification' : 'Invalid token'
      }

      if (!result.networkError) {
        // Clear invalid token
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
  // Load existing token from localStorage when opening advanced settings
  const existingToken = tokenManager.getToken()
  if (existingToken) {
    manualToken.value = existingToken
  }
}
</script>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.login-section {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.login-form, .user-info {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.user-info {
  padding: 8px 0;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.login-form h3, .verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.user-info h3 {
  margin: 0 0 16px 20px;
  font-size: 24px;
  font-weight: 600;
}

.login-form p, .verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.user-info p {
  margin: 0 20px 12px 20px;
  font-size: 15px;
  color: #666;
}

.verifying-state {
  text-align: center;
  padding: 20px 0;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.input-field {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn {
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.login-btn {
  background-color: #007acc;
  color: white;
}

.login-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.login-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.logout-btn {
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 16px;
  align-self: flex-start;
  margin: 4px 0 4px 20px;
}

.logout-btn:hover {
  background-color: #dc3545;
  color: white;
}

.control-section {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.control-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.advanced-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #333;
}

.advanced-btn:hover {
  background-color: #e9ecef;
}

.settings-content {
  padding: 0;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.directory-input-group {
  display: flex;
  gap: 8px;
}

.directory-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: #f8f9fa;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browse-btn {
  padding: 6px 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.browse-btn:hover {
  background-color: #0056b3;
}

.mode-toggle {
  display: flex;
  gap: 4px;
}

.mode-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  background-color: #f8f9fa;
  color: #666;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background-color: #e9ecef;
}

.mode-btn.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.audio-mode-selector {
  width: 100%;
}

.audio-mode-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.audio-mode-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.theme-selector {
  width: 100%;
}

.theme-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.theme-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

/* Slide extraction settings styles */
.slide-interval-group {
  display: flex;
  align-items: center;
}

.slide-interval-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.slide-interval-input-wrapper:focus-within {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.slide-interval-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
}

.interval-unit {
  padding: 6px 8px;
  font-size: 11px;
  color: #666;
  background-color: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  white-space: nowrap;
}

.verification-unified-control {
  display: flex;
  align-items: stretch;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
  height: 35px;
}

.verification-unified-control:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: none;
  user-select: none;
  flex: 1;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

.verification-count-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.7);
  border-left: 1px solid #ddd;
}

.count-label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.verification-count-select {
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 50px;
}

.verification-count-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.task-speed-selector {
  width: 100%;
}

.task-speed-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.task-speed-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.status-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.status-row:last-child {
  margin-bottom: 0;
}

.status-label {
  font-weight: 500;
  color: #333;
}

.status-value {
  color: #666;
}

.status-value.internal {
  color: #28a745;
}

.status-value.external {
  color: #ffc107;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #333;
}

.advanced-settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  margin-bottom: 0;
}

.advanced-setting-section {
  margin-bottom: 24px;
}

.advanced-setting-section h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.advanced-setting-section .setting-item {
  margin-bottom: 0;
}

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.3;
}

/* General setting description for main settings */
.setting-item .setting-description {
  margin-top: 2px;
  margin-bottom: 6px;
}

.concurrent-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.concurrent-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.ssim-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  margin-bottom: 4px;
}

.ssim-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #f8f9fa;
  color: #666;
}

.cancel-btn:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.save-btn {
  background-color: #007acc;
  color: white;
  border-color: #007acc;
}

.save-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

/* Authentication section styles */
.token-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.token-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  font-family: 'Courier New', monospace;
}

.token-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.token-toggle-btn {
  padding: 6px 8px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.token-toggle-btn:hover {
  background-color: #e9ecef;
}

.verify-token-btn {
  padding: 6px 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.verify-token-btn:hover:not(:disabled) {
  background-color: #218838;
}

.verify-token-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.token-status {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.token-status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.token-status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.control-section,
.advanced-settings-content {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.control-section:hover,
.advanced-settings-content:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.control-section::-webkit-scrollbar,
.advanced-settings-content::-webkit-scrollbar {
  width: 6px;
}

.control-section::-webkit-scrollbar-track,
.advanced-settings-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.control-section::-webkit-scrollbar-thumb,
.advanced-settings-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.control-section:hover::-webkit-scrollbar-thumb,
.advanced-settings-content:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.control-section::-webkit-scrollbar-thumb:hover,
.advanced-settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .left-panel {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .login-section {
    border-bottom-color: #404040;
    background-color: #2d2d2d;
  }

  .user-info {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .login-form h3, .verifying-state h3, .user-info h3 {
    color: #e0e0e0;
  }

  .login-form p, .verifying-state p, .user-info p {
    color: #b0b0b0;
  }

  .loading-spinner {
    border-color: #404040;
    border-top-color: #4a9eff;
  }

  .input-field {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .input-field::placeholder {
    color: #888;
  }

  .login-btn {
    background-color: #4a9eff;
  }

  .login-btn:hover:not(:disabled) {
    background-color: #3a8eef;
  }

  .login-btn:disabled {
    background-color: #555;
  }

  .logout-btn {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }

  .logout-btn:hover {
    background-color: #ff6b6b;
    color: white;
  }

  .control-section {
    background-color: #2d2d2d;
  }

  .control-header h3 {
    color: #e0e0e0;
  }

  .advanced-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .advanced-btn:hover {
    background-color: #3d3d3d;
  }

  .setting-label {
    color: #e0e0e0;
  }

  .setting-description {
    color: #b0b0b0;
  }

  .directory-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .browse-btn {
    background-color: #4a9eff;
  }

  .browse-btn:hover {
    background-color: #3a8eef;
  }

  .mode-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .mode-btn:hover {
    background-color: #3d3d3d;
  }

  .mode-btn.active {
    background-color: #4a9eff;
    color: white;
    border-color: #4a9eff;
  }

  .audio-mode-select, .theme-select, .task-speed-select, .verification-count-select, .concurrent-select, .ssim-select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .audio-mode-select:focus, .theme-select:focus, .task-speed-select:focus, .verification-count-select:focus, .concurrent-select:focus, .ssim-select:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .slide-interval-input-wrapper {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .slide-interval-input-wrapper:focus-within {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .slide-interval-input {
    color: #e0e0e0;
  }

  .interval-unit {
    background-color: #2d2d2d;
    border-left-color: #404040;
    color: #b0b0b0;
  }

  .verification-unified-control {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .verification-unified-control:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }

  .checkbox-label {
    color: #e0e0e0;
  }

  .verification-count-control {
    background-color: rgba(45, 45, 45, 0.7);
    border-left-color: #404040;
  }

  .count-label {
    color: #b0b0b0;
  }

  .status-section {
    background-color: #2d2d2d;
    border-top-color: #404040;
  }

  .status-label {
    color: #e0e0e0;
  }

  .status-value {
    color: #b0b0b0;
  }

  .status-value.internal {
    color: #4caf50;
  }

  .status-value.external {
    color: #ffc107;
  }

  .modal-overlay {
    background-color: rgba(0, 0, 0, 0.7);
  }

  .modal-content {
    background-color: #2d2d2d;
  }

  .modal-header {
    border-bottom-color: #404040;
  }

  .modal-header h3 {
    color: #e0e0e0;
  }

  .close-btn {
    color: #e0e0e0;
  }

  .close-btn:hover {
    background-color: #3d3d3d;
  }

  .modal-body {
    color: #e0e0e0;
  }

  .advanced-settings-content {
    background-color: #2d2d2d;
  }

  .advanced-setting-section h4 {
    color: #e0e0e0;
    border-bottom-color: #404040;
  }

  .modal-actions {
    background-color: #2d2d2d;
    border-top-color: #404040;
  }

  .cancel-btn {
    background-color: #2d2d2d;
    color: #b0b0b0;
    border-color: #404040;
  }

  .cancel-btn:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  .save-btn {
    background-color: #4a9eff;
    border-color: #4a9eff;
  }

  .save-btn:hover {
    background-color: #3a8eef;
    border-color: #3a8eef;
  }

  .token-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .token-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .token-toggle-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .token-toggle-btn:hover {
    background-color: #3d3d3d;
  }

  .verify-token-btn {
    background-color: #4caf50;
  }

  .verify-token-btn:hover:not(:disabled) {
    background-color: #45a049;
  }

  .verify-token-btn:disabled {
    background-color: #555;
  }

  .token-status.success {
    background-color: #1b4332;
    color: #4caf50;
    border-color: #2d5a3d;
  }

  .token-status.error {
    background-color: #4a1e1e;
    color: #ff6b6b;
    border-color: #5d2a2a;
  }

  .control-section,
  .advanced-settings-content {
    scrollbar-color: transparent transparent;
  }

  .control-section:hover,
  .advanced-settings-content:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .control-section::-webkit-scrollbar-track,
  .advanced-settings-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .control-section::-webkit-scrollbar-thumb,
  .advanced-settings-content::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .control-section:hover::-webkit-scrollbar-thumb,
  .advanced-settings-content:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .control-section::-webkit-scrollbar-thumb:hover,
  .advanced-settings-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }
}
</style>