<template>
  <div class="left-panel">
    <div class="login-section">
      <div v-if="isVerifyingToken" class="verifying-state">
        <h3>{{ $t('auth.verifying') }}</h3>
        <p>{{ $t('auth.verifyingMessage') }}</p>
        <div class="loading-spinner"></div>
      </div>
      <div v-else-if="!isLoggedIn" class="login-form">
        <h3>{{ $t('auth.signIn') }}</h3>
        <p>{{ $t('auth.signInMessage') }}</p>
        <div class="input-group">
          <input
            v-model="username"
            type="text"
            :placeholder="$t('auth.username')"
            class="input-field"
          />
          <input
            v-model="password"
            type="password"
            :placeholder="$t('auth.password')"
            class="input-field"
          />
        </div>
        <div class="login-buttons">
          <button @click="login" :disabled="isLoading" class="login-btn">
            {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
          </button>
          <button @click="openBrowserLogin" class="browser-login-btn">
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>
      <div v-else ref="userInfoRef" class="user-info">
        <button type="button" class="user-banner" :class="{ open: showUserMenu }" @click="toggleUserMenu">
          <span class="user-avatar">{{ userInitial }}</span>
          <span class="user-banner-name">{{
            showUserMenu && isChineseName
              ? `${displayNickname} (${userNickname})`
              : displayNickname
          }}</span>
          <svg
            class="user-banner-chevron"
            :class="{ open: showUserMenu }"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div v-if="showUserMenu" class="user-menu">
          <p class="user-menu-username">{{ $t('auth.signInAs', { userId }) }}</p>
          <p class="user-menu-message">{{ $t('auth.accessMessage') }}</p>
          <button class="logout-btn user-menu-signout" @click="handleSignOut">{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>{{ $t('settings.settings') }}</h3>
        <button @click="openAdvancedSettings" class="advanced-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ $t('settings.advancedSettings') }}
        </button>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
            <button @click="openOutputDirectory" class="reset-btn" :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="directory-input-group">
            <input
              v-model="outputDirectory"
              type="text"
              readonly
              class="directory-input"
              :title="outputDirectory"
            />
            <button @click="selectOutputDirectory" class="browse-btn">{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.connectionMode') }}</label>
          <div class="mode-toggle">
            <button
              @click="setConnectionMode('internal')"
              :class="['mode-btn', { active: connectionMode === 'internal' }]"
            >
              {{ $t('settings.internalNetwork') }}
            </button>
            <button
              @click="setConnectionMode('external')"
              :class="['mode-btn', { active: connectionMode === 'external' }]"
            >
              {{ $t('settings.externalNetwork') }}
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.audioMode') }}</label>
          <div class="audio-mode-selector">
            <select v-model="muteMode" @change="setMuteMode" class="audio-mode-select">
              <option value="normal">{{ $t('settings.normal') }}</option>
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideDetectionInterval') }}</label>
            <button @click="resetSlideDetectionInterval" class="reset-btn" :title="$t('settings.resetToDefault')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="setting-description">{{ $t('settings.slideDetectionDescription') }}</div>
          <div class="slide-interval-group">
            <div class="slide-interval-input-wrapper">
              <input
                v-model.number="slideCheckInterval"
                type="number"
                min="500"
                max="10000"
                step="500"
                class="slide-interval-input"
                @change="setSlideCheckInterval"
                @blur="validateAndCorrectInterval"
              />
              <span class="interval-unit">{{ $t('settings.milliseconds') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideStabilityVerification') }}</label>
            <button @click="resetSlideStabilityVerification" class="reset-btn" :title="$t('settings.resetToDefault')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="setting-description">{{ $t('settings.slideStabilityDescription') }}</div>
          <div class="verification-unified-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="slideDoubleVerification"
                @change="setSlideDoubleVerification"
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="verification-count-control" v-if="slideDoubleVerification">
              <select
                v-model="slideVerificationCount"
                @change="setSlideDoubleVerification"
                class="verification-count-select"
              >
                <option v-for="i in 5" :key="i" :value="i">{{ i }}</option>
              </select>
              <span class="count-label">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.taskSpeed') }}</label>
          <div class="setting-description">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="task-speed-selector">
            <select v-model="taskSpeed" @change="setTaskSpeed" class="task-speed-select">
              <option :value="1">1x</option>
              <option :value="2">2x</option>
              <option :value="3">3x</option>
              <option :value="4">4x</option>
              <option :value="5">5x</option>
              <option :value="6">6x</option>
              <option :value="7">7x</option>
              <option :value="8">8x</option>
              <option :value="9">9x</option>
              <option :value="10">10x</option>
              <option :value="11">11x</option>
              <option :value="12">12x</option>
              <option :value="13">13x</option>
              <option :value="14">14x</option>
              <option :value="15">15x</option>
              <option :value="16">16x</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.autoPostProcessing') }}</label>
          <div class="setting-description">{{ $t('settings.autoPostProcessingDescription') }}</div>
          <div class="auto-post-processing-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="autoPostProcessingLive"
                @change="setAutoPostProcessingLive"
              />
              {{ $t('settings.enableAutoPostProcessingLive') }}
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="autoPostProcessing"
                @change="setAutoPostProcessing"
              />
              {{ $t('settings.enableAutoPostProcessingRecorded') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <!-- Action Buttons Row -->
      <!-- Tools Launcher -->
      <div class="tools-dropdown">
        <button class="tools-trigger" @click="openToolsWindow()">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
          </svg>
          <span>{{ $t('tools.openTools') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <!-- Add-ons Launcher -->
      <div class="tools-dropdown addons-dropdown">
        <button class="tools-trigger" @click="openAddonsWindow()">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
          </svg>
          <span>{{ $t('addons.openAddons') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="status-row">
        <span class="status-label">{{ $t('status.taskStatus') }}</span>
        <span class="status-value">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">{{ $t('status.downloadQueue') }}</span>
        <span class="status-value">{{ downloadQueueStatus }}</span>
      </div>
    </div>

    <AdvancedSettingsModal
      :visible="showAdvancedModal"
      :active-tab="activeAdvancedTab"
      :tabs="advancedSettingsTabs"
      @update:active-tab="activeAdvancedTab = $event"
      @cancel="closeAdvancedSettings"
      @save="saveAdvancedSettings"
    >
      <template #general>
        <GeneralSettingsTab />
      </template>

      <template #imageProcessing>
        <ImageProcessingSettingsTab />
      </template>

      <template #playback>
        <PlaybackSettingsTab />
      </template>

      <template #network>
        <NetworkSettingsTab />
      </template>

      <template #ai>
        <AISettingsTab />
      </template>
    </AdvancedSettingsModal>

    <!-- Custom Name Input Dialog -->
    <div v-if="showNameInputModal" class="modal-overlay" @click="cancelNameInput">
      <div class="modal-content name-input-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('advanced.enterExclusionName') }}</h3>
          <button @click="cancelNameInput" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="name-input-content">
            <label class="setting-label">{{ $t('advanced.exclusionItemName') }}</label>
            <input
              v-model="nameInputValue"
              type="text"
              class="name-input-field"
              :placeholder="$t('advanced.enterNamePlaceholder')"
              @keyup.enter="confirmNameInput"
              @keyup.escape="cancelNameInput"
              ref="nameInputField"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button @click="cancelNameInput" class="cancel-btn">{{ $t('advanced.cancel') }}</button>
          <button @click="confirmNameInput" :disabled="!nameInputValue.trim()" class="save-btn">{{ $t('advanced.confirm') }}</button>
        </div>
      </div>
    </div>

    <!-- Extractor Install Modal -->
    <ExtractorInstallModal
      :visible="showExtractorInstallModal"
      @close="closeExtractorInstallModal"
    />

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePinyinName } from '@features/platform/usePinyinName'
import { useAuth } from '@features/platform/useAuth'
import { useSettings } from '@features/settings/useSettings'
import { useAdvancedSettings } from '@features/settings/useAdvancedSettings'
import { useCacheManagement } from '@features/platform/useCacheManagement'
import { useAISettings } from '@features/ai/useAISettings'
import { usePHashExclusion } from '@features/ai/usePHashExclusion'
import { settingsContextKey } from '@features/settings/settingsContext'
import ExtractorInstallModal from './ExtractorInstallModal.vue'
import AdvancedSettingsModal from './AdvancedSettingsModal.vue'
import NetworkSettingsTab from './tabs/NetworkSettingsTab.vue'
import GeneralSettingsTab from './tabs/GeneralSettingsTab.vue'
import ImageProcessingSettingsTab from './tabs/ImageProcessingSettingsTab.vue'
import PlaybackSettingsTab from './tabs/PlaybackSettingsTab.vue'
import AISettingsTab from './tabs/AISettingsTab.vue'

const { t } = useI18n()

// Initialize composables
const auth = useAuth(() => {
  // On login success, refresh the built-in model
  aiSettings.refreshBuiltinModel()
})

const settings = useSettings()

const cacheManagement = useCacheManagement()

const pHashExclusion = usePHashExclusion()

const aiSettings = useAISettings({
  tokenManager: auth.tokenManager
})

const advancedSettings = useAdvancedSettings(
  {
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    downloadMaxWorkers: settings.downloadMaxWorkers,
    downloadNumRetries: settings.downloadNumRetries,
    videoRetryCount: settings.videoRetryCount,
    themeMode: settings.themeMode,
    languageMode: settings.languageMode,
    preventSystemSleep: settings.preventSystemSleep,
    enableAIFiltering: settings.enableAIFiltering,
    tempEnableAIFiltering: settings.tempEnableAIFiltering
  },
  // onOpenModal callback
  async () => {
    auth.loadManualToken()
    auth.tokenVerificationStatus.value = null
    auth.showToken.value = false
    cacheManagement.refreshCacheStats()
    cacheManagement.resetOperationStatus()
    await pHashExclusion.loadPHashExclusionList()
    await aiSettings.loadAISettings()
    aiSettings.refreshMlModelInfo()
    aiSettings.resetTempValues()
    settings.resetTempEnableAIFiltering()
  },
  // onSaveSettings callback
  async () => {
    await aiSettings.saveAISettings()
    await settings.saveEnableAIFiltering()
  },
  t
)

// Provide the six composables as one bundle for the extracted tab children.
// See features/settings/settingsContext.ts for the contract.
provide(settingsContextKey, {
  auth,
  settings,
  advanced: advancedSettings,
  cache: cacheManagement,
  ai: aiSettings,
  phash: pHashExclusion,
})

// Destructure for template usage
// Auth
const {
  isLoggedIn,
  username,
  password,
  userNickname,
  userId,
  isLoading,
  isVerifyingToken,
  login,
  logout,
  openBrowserLogin
} = auth

const showUserMenu = ref(false)
const userInfoRef = ref<HTMLElement | null>(null)

const { isChineseName, displayNickname, nameInitial: userInitial } = usePinyinName(userNickname)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleSignOut = () => {
  closeUserMenu()
  logout()
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!showUserMenu.value || !userInfoRef.value) {
    return
  }

  const target = event.target as Node | null
  if (target && !userInfoRef.value.contains(target)) {
    closeUserMenu()
  }
}

// Settings
const {
  outputDirectory,
  connectionMode,
  muteMode,
  slideCheckInterval,
  slideDoubleVerification,
  slideVerificationCount,
  taskSpeed,
  autoPostProcessing,
  autoPostProcessingLive,
  tempEnableAIFiltering,
  preventSystemSleep,
  taskStatus,
  downloadQueueStatus,
  selectOutputDirectory,
  setConnectionMode,
  setMuteMode,
  setSlideCheckInterval,
  validateAndCorrectInterval,
  setSlideDoubleVerification,
  resetSlideDetectionInterval,
  resetSlideStabilityVerification,
  setTaskSpeed,
  setAutoPostProcessing,
  setAutoPostProcessingLive
} = settings

// Advanced Settings
const {
  showAdvancedModal,
  activeAdvancedTab,
  advancedSettingsTabs,
  showExtractorInstallModal,
  closeExtractorInstallModal,
  openAdvancedSettings,
  closeAdvancedSettings,
  saveAdvancedSettings,
  updateThresholdProgrammatically,
  onAdaptiveThresholdChanged
} = advancedSettings

// Cache Management

// AI Settings

// pHash Exclusion
const {
  showNameInputModal,
  nameInputValue,
  confirmNameInput,
  cancelNameInput
} = pHashExclusion

// Tools Window
const openToolsWindow = async (tab?: string) => {
  try {
    await window.electronAPI.tools.openWindow(tab)
  } catch (error) {
    console.error('Failed to open tools window:', error)
  }
}

// Add-ons Window
const openAddonsWindow = async (tab?: string) => {
  try {
    await window.electronAPI.addons.openWindow(tab)
  } catch (error) {
    console.error('Failed to open addons window:', error)
  }
}

// Open Output Directory
const openOutputDirectory = async () => {
  try {
    if (outputDirectory.value) {
      await window.electronAPI.shell.openPath(outputDirectory.value)
    }
  } catch (error) {
    console.error('Failed to open output directory:', error)
  }
}

// Lifecycle hooks
onMounted(async () => {
  auth.verifyExistingToken()
  await settings.loadConfig()
  await advancedSettings.loadImageProcessingConfig()

  // Load built-in model name in background (non-blocking)
  aiSettings.refreshBuiltinModel()
  // Load session-exhausted model list for ModelScope chain UI (non-blocking)
  aiSettings.refreshExhaustedModels()

  // Add event listener for adaptive threshold changes
  window.addEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  // Remove event listener for adaptive threshold changes
  window.removeEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  document.removeEventListener('click', handleDocumentClick)
})

// Export for potential future use by other components
defineExpose({
  updateThresholdProgrammatically
})
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

.login-form {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.user-info {
  position: relative;
  min-height: 36px;
}

.login-form h3, .verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.login-form p, .verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.user-banner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 6px;
  padding: 3px 2px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.user-banner:hover {
  background-color: #eef1f4;
}

.user-banner.open {
  gap: 10px;
  padding: 5px 8px;
  border: 1px solid #d5d9de;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background-color: #ffffff;
}

.user-banner.open:hover {
  background-color: #ffffff;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-banner-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-banner-chevron {
  width: 14px;
  height: 14px;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.user-banner-chevron.open {
  transform: rotate(180deg);
}

.user-menu {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  z-index: 20;
  border: 1px solid #d5d9de;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background-color: #ffffff;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  padding: 8px;
}

.user-menu-username {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

.user-menu-message {
  margin: 4px 0 8px 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.35;
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

.logout-btn {
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
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

.login-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100%;
}

.login-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.browser-login-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: transparent;
  color: #007acc;
  white-space: nowrap;
}

.browser-login-btn:hover {
  background-color: #007acc;
  color: white;
}

.logout-btn {
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 10px;
  align-self: flex-start;
  margin: 0;
}

.user-menu-signout {
  width: 100%;
  margin: 0;
  text-align: center;
}

.logout-btn:hover {
  background-color: #dc3545;
  border-color: #dc3545;
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
  margin-top: 6px;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.setting-label-with-reset {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.setting-label-with-reset .reset-btn {
  margin-bottom: 6px;
}

.reset-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  color: #666;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.reset-btn:hover {
  background-color: #f0f0f0;
  color: #333;
  opacity: 1;
}

.reset-btn svg {
  width: 12px;
  height: 12px;
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

.two-col-item .setting-label {
  margin-bottom: 6px;
}

/* Slide extraction settings styles */

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

/* Auto post-processing control styles */
/* Post-processing phases list styles */

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

.advanced-setting-section .setting-item {
  margin-bottom: 20px;
}

.advanced-setting-section .setting-item:last-child {
  margin-bottom: 0;
}

.auto-crop-grid .setting-item {
  margin-bottom: 16px;
}

.auto-crop-grid .setting-item:last-child {
  margin-top: 0;
}

.auto-crop-grid .setting-item.full-width {
  grid-column: 1 / -1;
}

.auto-crop-grid .setting-item .slide-interval-input-wrapper {
  width: 100%;
  box-sizing: border-box;
}

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.3;
}

.setting-description .json-example {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10px;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 3px;
  color: #333;
  white-space: nowrap;
}

/* General setting description for main settings */
.setting-item .setting-description {
  margin-top: 2px;
  margin-bottom: 6px;
}

/* Setting description after controls needs more top margin */
.downsampling-controls + .setting-description {
  margin-top: 8px;
}

/* pHash threshold input styles */

/* Downsampling controls styles */

/* Classroom Rules Styles */

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

/* Tools Flyout */
.tools-dropdown {
  margin-bottom: 10px;
}

.tools-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #ffffff;
  color: #333;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tools-trigger:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.tools-trigger svg:first-child {
  flex-shrink: 0;
  opacity: 0.7;
}

.tools-chevron {
  margin-left: auto;
  opacity: 0.45;
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

  .login-form h3, .verifying-state h3 {
    color: #e0e0e0;
  }

  .login-form p, .verifying-state p {
    color: #b0b0b0;
  }

  .user-banner {
    background-color: transparent;
  }

  .user-banner:hover {
    background-color: #383838;
  }

  .user-banner.open {
    border-color: #4a4a4a;
    background-color: #2d2d2d;
  }

  .user-banner.open:hover {
    background-color: #2d2d2d;
  }

  .user-avatar {
    background-color: #3b82f6;
  }

  .user-banner-name {
    color: #e0e0e0;
  }

  .user-banner-chevron {
    color: #a0a0a0;
  }

  .user-menu {
    background-color: #2d2d2d;
    border-color: #4a4a4a;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  .user-menu-username {
    color: #e0e0e0;
  }

  .user-menu-message {
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
    background-color: #2563eb;
  }

  .login-btn:hover:not(:disabled) {
    background-color: #1d4ed8;
  }

  .login-btn:disabled {
    background-color: #555;
  }

  .browser-login-btn {
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .browser-login-btn:hover {
    background-color: #4a9eff;
    color: white;
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

  .reset-btn {
    color: #b0b0b0;
  }

  .reset-btn:hover {
    background-color: #3d3d3d;
    color: #e0e0e0;
  }

  .setting-description {
    color: #b0b0b0;
  }

  .setting-description .json-example {
    background-color: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .directory-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .browse-btn {
    background-color: #2563eb;
  }

  .browse-btn:hover {
    background-color: #1d4ed8;
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
    background-color: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  .audio-mode-select, .task-speed-select, .verification-count-select, .concurrent-select, .ssim-select, .ssim-preset-select, .ssim-input, .phash-threshold-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .audio-mode-select:focus, .task-speed-select:focus, .verification-count-select:focus, .concurrent-select:focus, .ssim-select:focus, .ssim-preset-select:focus, .ssim-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  /* pHash threshold input dark mode */
  

  

  

  

  /* Downsampling controls dark mode */
  

  

  

  

  

  /* Classroom Rules Dark Theme */
  

  

  

  

  

  

  

  

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

  

  

  

  .advanced-tabs .tab-btn.active {
    color: #4a9eff;
    border-bottom-color: #4a9eff;
    background-color: #2d2d2d;
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

/* Downsampling control styles - modified to accommodate presets */

.downsampling-control .checkbox-label {
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
  height: 35px;
}

.downsampling-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

/* Downsampling presets styles */

@media (prefers-color-scheme: dark) {
  /* Dark mode support for downsampling control */
  

  

  .downsampling-control .checkbox-label {
    color: #e0e0e0;
  }

  

  /* Dark mode support for post-processing phases list */
  

  

  
}

/* pHash exclusion list styles */

/* Dark mode support for pHash exclusion list */

/* Custom name input dialog styles */
.name-input-modal {
  width: 400px;
  max-width: 90vw;
}

.name-input-content {
  padding: 16px;
}

.name-input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  margin-top: 8px;
}

.name-input-field:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

/* Dark mode support for name input dialog */
@media (prefers-color-scheme: dark) {
  .name-input-field {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .name-input-field:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .name-input-field::placeholder {
    color: #888;
  }
}

/* AI Settings Tab Styles */

/* Copilot settings */

/* Built-in model display styles */

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Dark mode support for AI settings */
@media (prefers-color-scheme: dark) {
  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  /* ModelScope Model Chain dark mode */
  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  /* Copilot dark mode */
  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  /* Tools Dropdown Dark Mode */
  .tools-trigger {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .tools-trigger:hover {
    background-color: #404040;
    border-color: #666;
  }

}

</style>
