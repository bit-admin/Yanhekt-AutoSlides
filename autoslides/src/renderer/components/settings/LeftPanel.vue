<template>
  <div class="flex h-full flex-col">
    <!-- 'login-section' retained as a Driver.js tour hook -->
    <div class="login-section border-b border-border bg-elevated p-4">
      <div v-if="isVerifyingToken" class="flex min-h-[140px] flex-col justify-center py-5 text-center">
        <h3 class="m-0 mb-2 text-base font-semibold text-text">{{ $t('auth.verifying') }}</h3>
        <p class="m-0 mb-3 text-xs text-text-secondary">{{ $t('auth.verifyingMessage') }}</p>
        <div class="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent"></div>
      </div>
      <div v-else-if="!isLoggedIn" class="flex min-h-[140px] flex-col justify-between">
        <h3 class="m-0 mb-2 text-base font-semibold text-text">{{ $t('auth.signIn') }}</h3>
        <p class="m-0 mb-3 text-xs text-text-secondary">{{ $t('auth.signInMessage') }}</p>
        <div class="mb-3 flex flex-col gap-2">
          <input
            v-model="username"
            type="text"
            :placeholder="$t('auth.username')"
            class="rounded border border-border-input px-3 py-2 text-sm"
          />
          <input
            v-model="password"
            type="password"
            :placeholder="$t('auth.password')"
            class="rounded border border-border-input px-3 py-2 text-sm"
          />
        </div>
        <div class="flex w-full flex-row gap-2">
          <button @click="login" :disabled="isLoading" class="flex-1 cursor-pointer rounded border-none bg-accent px-3 py-2 text-[13px] text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-border">
            {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
          </button>
          <button @click="openBrowserLogin" class="flex-1 cursor-pointer whitespace-nowrap rounded border border-accent bg-transparent px-3 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-white">
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>
      <div v-else ref="userInfoRef" class="relative min-h-9">
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-0.5 py-[3px] transition-colors hover:bg-hover"
          :class="{ '!gap-2.5 rounded-b-none rounded-t-lg !border !border-b-0 !border-border !bg-surface !px-2 !py-[5px]': showUserMenu }"
          @click="toggleUserMenu"
        >
          <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-text-accent text-[11px] font-bold text-white">{{ userInitial }}</span>
          <span class="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-text">{{
            showUserMenu && isChineseName
              ? `${displayNickname} (${userNickname})`
              : displayNickname
          }}</span>
          <svg
            class="h-3.5 w-3.5 text-text-muted transition-transform"
            :class="{ 'rotate-180': showUserMenu }"
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

        <div v-if="showUserMenu" class="absolute left-0 right-0 top-[calc(100%-1px)] z-20 rounded-b-lg border border-t-0 border-border bg-surface p-2 shadow-lg">
          <p class="m-0 text-xs font-semibold text-text">{{ $t('auth.signInAs', { userId }) }}</p>
          <p class="mb-2 mt-1 text-xs leading-[1.35] text-text-muted">{{ $t('auth.accessMessage') }}</p>
          <button class="w-full cursor-pointer rounded-md border border-danger bg-transparent px-2.5 py-1.5 text-center text-xs font-medium text-danger transition-colors hover:bg-danger hover:text-white" @click="handleSignOut">{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="m-0 text-base font-semibold text-text">{{ $t('settings.settings') }}</h3>
        <button @click="openAdvancedSettings" class="flex cursor-pointer items-center gap-1 rounded border border-border bg-elevated px-3 py-1.5 text-xs text-text transition-colors hover:bg-hover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ $t('settings.advancedSettings') }}
        </button>
      </div>
      <div>
        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
            <button @click="openOutputDirectory" class="reset-btn" :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="flex gap-2">
            <input
              v-model="outputDirectory"
              type="text"
              readonly
              class="min-w-0 flex-1 truncate rounded border border-border-input bg-elevated px-2 py-1.5 text-xs text-text-secondary"
              :title="outputDirectory"
            />
            <button @click="selectOutputDirectory" class="cursor-pointer rounded border-none bg-accent px-3 py-1.5 text-xs text-white transition-colors hover:bg-accent-hover">{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.connectionMode') }}</label>
          <div class="flex gap-1">
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
          <div class="w-full">
            <select v-model="muteMode" @change="setMuteMode" class="w-full cursor-pointer rounded border border-border-input bg-surface px-2 py-1.5 text-xs text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10">
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
          <div class="flex h-[35px] items-stretch overflow-hidden rounded-md border border-border-input bg-elevated transition-colors hover:border-accent hover:bg-hover">
            <label class="checkbox-label flex-1 px-3 py-2">
              <input
                type="checkbox"
                class="h-4 w-4 accent-accent"
                v-model="slideDoubleVerification"
                @change="setSlideDoubleVerification"
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="flex items-center gap-1.5 border-l border-border-input bg-surface/70 px-3 py-2" v-if="slideDoubleVerification">
              <select
                v-model="slideVerificationCount"
                @change="setSlideDoubleVerification"
                class="min-w-[50px] cursor-pointer rounded border border-border-input bg-surface px-1.5 py-1 text-[11px] text-text focus:border-accent focus:outline-none"
              >
                <option v-for="i in 5" :key="i" :value="i">{{ i }}</option>
              </select>
              <span class="whitespace-nowrap text-[11px] text-text-secondary">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.taskSpeed') }}</label>
          <div class="setting-description">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="w-full">
            <select v-model="taskSpeed" @change="setTaskSpeed" class="w-full cursor-pointer rounded border border-border-input bg-surface px-2 py-1.5 text-xs text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10">
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

    <div class="border-t border-border bg-elevated p-4">
      <!-- Tools Launcher -->
      <div class="mb-2.5">
        <button class="flex w-full cursor-pointer items-center gap-1 rounded border border-border-input bg-surface px-2 py-1.5 text-[11px] font-medium text-text transition-colors hover:bg-hover hover:border-border" @click="openToolsWindow()">
          <svg class="shrink-0 opacity-70" width="14" height="14" viewBox="0 0 16 16">
            <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
          </svg>
          <span>{{ $t('tools.openTools') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="ml-auto opacity-45">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <!-- Add-ons Launcher -->
      <div class="mb-2.5">
        <button class="flex w-full cursor-pointer items-center gap-1 rounded border border-border-input bg-surface px-2 py-1.5 text-[11px] font-medium text-text transition-colors hover:bg-hover hover:border-border" @click="openAddonsWindow()">
          <svg class="shrink-0 opacity-70" width="14" height="14" viewBox="0 0 16 16">
            <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
          </svg>
          <span>{{ $t('addons.openAddons') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="ml-auto opacity-45">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="status-row">
        <span class="font-medium text-text">{{ $t('status.taskStatus') }}</span>
        <span class="text-text-secondary">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="font-medium text-text">{{ $t('status.downloadQueue') }}</span>
        <span class="text-text-secondary">{{ downloadQueueStatus }}</span>
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
    <div v-if="showNameInputModal" class="fixed inset-0 z-modal flex items-center justify-center bg-black/50" @click="cancelNameInput">
      <div class="flex max-h-[80vh] w-[400px] max-w-[90vw] flex-col overflow-hidden rounded-lg bg-modal" @click.stop>
        <div class="flex items-center justify-between border-b border-border p-4">
          <h3 class="m-0 text-base font-semibold text-text">{{ $t('advanced.enterExclusionName') }}</h3>
          <button @click="cancelNameInput" class="cursor-pointer rounded border-none bg-transparent p-1 transition-colors hover:bg-hover">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="flex flex-1 flex-col overflow-hidden text-text">
          <div class="p-4">
            <label class="setting-label">{{ $t('advanced.exclusionItemName') }}</label>
            <input
              v-model="nameInputValue"
              type="text"
              class="mt-2 w-full rounded border border-border-input bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
              :placeholder="$t('advanced.enterNamePlaceholder')"
              @keyup.enter="confirmNameInput"
              @keyup.escape="cancelNameInput"
              ref="nameInputField"
            />
          </div>
        </div>
        <div class="flex flex-shrink-0 justify-end gap-2 border-t border-border bg-elevated p-4">
          <button @click="cancelNameInput" class="cursor-pointer rounded border border-border-input bg-elevated px-4 py-2 text-xs text-text-secondary transition-colors hover:bg-hover hover:border-border-strong">{{ $t('advanced.cancel') }}</button>
          <button @click="confirmNameInput" :disabled="!nameInputValue.trim()" class="cursor-pointer rounded border border-accent bg-accent px-4 py-2 text-xs text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{{ $t('advanced.confirm') }}</button>
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
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
