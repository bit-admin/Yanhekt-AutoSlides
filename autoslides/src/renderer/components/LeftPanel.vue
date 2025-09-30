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
        <p>Please sign in to Yanhekt access your account resourses.</p>
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
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>Settings</h3>
        <button @click="openAdvancedSettings" class="advanced-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          Advanced Settings
        </button>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <label class="setting-label">Output Directory:</label>
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
          <label class="setting-label">Connection Mode:</label>
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
          <label class="setting-label">Audio Mode:</label>
          <div class="audio-mode-selector">
            <select v-model="muteMode" @change="setMuteMode" class="audio-mode-select">
              <option value="normal">Normal</option>
              <option value="mute_all">Mute All</option>
              <option value="mute_live">Mute Live</option>
              <option value="mute_recorded">Mute Recorded</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <div class="status-row">
        <span class="status-label">Connection:</span>
        <span :class="['status-value', connectionMode]">
          {{ connectionMode === 'internal' ? 'Internal Network' : 'External Network' }}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Task Status:</span>
        <span class="status-value">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Download Queue:</span>
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
              <h4>Download</h4>
              <div class="setting-item">
                <label class="setting-label">Concurrent Download Limit:</label>
                <div class="setting-description">Maximum number of simultaneous downloads and processing</div>
                <select
                  v-model="tempMaxConcurrentDownloads"
                  class="concurrent-select"
                  @change="updateMaxConcurrentDownloads"
                >
                  <option v-for="i in 10" :key="i" :value="i">{{ i }}</option>
                </select>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>Video Playback</h4>
              <div class="setting-item">
                <label class="setting-label">Video Error Retry Count:</label>
                <div class="setting-description">Number of retry attempts when video playback errors occur (5-10)</div>
                <select
                  v-model="tempVideoRetryCount"
                  class="concurrent-select"
                  @change="updateVideoRetryCount"
                >
                  <option v-for="i in 6" :key="i" :value="i + 4">{{ i + 4 }}</option>
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

const isLoggedIn = ref(false)
const username = ref('')
const password = ref('')
const userNickname = ref('User')
const userId = ref('user123')
const connectionMode = ref<'internal' | 'external'>('external')
const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
const taskStatus = ref('Ready')
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

onMounted(() => {
  verifyExistingToken()
  loadConfig()
})

const openAdvancedSettings = () => {
  // Reset temp values to current values when opening modal
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  showAdvancedModal.value = true
}

const closeAdvancedSettings = () => {
  // Reset temp values when canceling
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  showAdvancedModal.value = false
}

const updateMaxConcurrentDownloads = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const updateVideoRetryCount = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const saveAdvancedSettings = async () => {
  try {
    // Save concurrent downloads setting
    const downloadResult = await window.electronAPI.config.setMaxConcurrentDownloads(tempMaxConcurrentDownloads.value)
    maxConcurrentDownloads.value = downloadResult.maxConcurrentDownloads

    // Save video retry count setting
    const retryResult = await window.electronAPI.config.setVideoRetryCount(tempVideoRetryCount.value)
    videoRetryCount.value = retryResult.videoRetryCount

    // Also update the download service
    const { DownloadService } = await import('../services/downloadService')
    DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)

    showAdvancedModal.value = false
  } catch (error) {
    console.error('Failed to save advanced settings:', error)
    alert('Failed to save settings')
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

.login-form h3, .user-info h3, .verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.login-form p, .user-info p, .verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.verifying-state {
  text-align: center;
  padding: 20px 0;
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

.login-btn, .logout-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
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
  background-color: #dc3545;
  color: white;
}

.logout-btn:hover {
  background-color: #c82333;
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
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
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
  padding: 16px;
  color: #333;
}

.advanced-settings-content {
  margin-bottom: 24px;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
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
</style>