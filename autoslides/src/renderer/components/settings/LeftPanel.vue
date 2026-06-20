<template>
  <div class="left-panel">
    <div class="control-section custom-scrollbar">
      <div class="settings-content">
        <div class="navigator-section">
          <div :class="['nav-search', { active: activeNav === 'search' }]">
            <svg class="nav-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              v-model="searchKeyword"
              type="text"
              class="nav-search-input"
              :placeholder="$t('navigation.searchPlaceholder')"
              @focus="handleSidebarFocus"
              @keyup.enter="handleSidebarEnter"
            />
          </div>
          <div class="nav-group-title">AutoSlides</div>
          <nav class="nav-items">
            <button :class="['nav-item', { active: activeNav === 'home' }]" @click="navigate('home')">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>{{ $t('navigation.home') }}</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'live' }]" @click="navigate('live')">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
              </svg>
              <span>{{ $t('navigation.live') }}</span>
              <span v-if="livePlaybackActive" class="nav-playback-indicator">●</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'recorded' && !activePinnedId }]" @click="navigate('recorded')">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>{{ $t('navigation.recorded') }}</span>
              <span v-if="recordedPlaybackActive" class="nav-playback-indicator">●</span>
            </button>
          </nav>
        </div>

        <div class="nav-group-title panel-actions-title">{{ $t('navigation.workspace') }}</div>
        <div class="panel-actions">
          <button type="button" class="panel-action-button" @click="openOutputDirectory">
            <svg class="panel-action-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{{ $t('settings.openFolder') }}</span>
            <svg class="panel-action-external-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/>
              <path d="M10 14L21 3"/>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>

          <button type="button" class="panel-action-button" @click="openToolsWindow()">
            <svg class="panel-action-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
            </svg>
            <span>{{ $t('tools.openTools') }}</span>
            <svg class="panel-action-external-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/>
              <path d="M10 14L21 3"/>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>

          <button type="button" class="panel-action-button" @click="openAddonsWindow()">
            <svg class="panel-action-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            <span>{{ $t('addons.openAddons') }}</span>
            <svg class="panel-action-external-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/>
              <path d="M10 14L21 3"/>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>
        </div>

        <div class="nav-group-title panel-actions-title">{{ $t('navigation.pinned') }}</div>
        <div class="nav-items">
          <div v-for="c in pinnedRecordedCourses" :key="c.id" class="pinned-row">
            <button :class="['nav-item', 'pinned-item', { active: activePinnedId === c.id }]" @click="openPinnedCourse(c)" :title="c.title">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span class="pinned-label">{{ c.title }}</span>
            </button>
            <button class="pinned-unpin" @click.stop="removePinnedCourse(c.id)" :title="$t('sessions.unpin')" :aria-label="$t('sessions.unpin')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="2" y1="2" x2="22" y2="22"/>
                <path d="M12 17v5"/>
                <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>
                <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="login-section">
      <div v-if="isVerifyingToken" class="verifying-state">
        <h3>{{ $t('auth.verifying') }}</h3>
        <p>{{ $t('auth.verifyingMessage') }}</p>
        <div class="loading-spinner"></div>
      </div>
      <div v-else class="login-row">
      <div v-if="!isLoggedIn" ref="signinMenuRef" class="signin-control">
        <div class="user-banner signin-banner" :class="{ open: showSigninMenu }">
          <button type="button" class="user-banner-main" @click="toggleSigninMenu">
            <span class="user-avatar signin-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span class="user-banner-name">{{ $t('auth.signIn') }}</span>
          </button>
          <div class="user-banner-actions">
            <button type="button" class="user-banner-action" :title="$t('settings.advancedSettings')" @click="openSettingsFromBar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button type="button" class="user-banner-action" @click="toggleSigninMenu">
              <svg
                class="user-banner-chevron"
                :class="{ open: showSigninMenu }"
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
                <polyline points="6 15 12 9 18 15" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="showSigninMenu" class="user-menu signin-menu">
          <UserMenuLinks />
          <button type="button" class="signin-option" @click="startBrowserLogin">
            <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>{{ $t('auth.signInWithBrowser') }}</span>
          </button>
          <button type="button" class="signin-option" @click="openSsoModal">
            <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <span>{{ $t('auth.signInWithSSO') }}</span>
          </button>
        </div>
      </div>
      <div v-else ref="userInfoRef" class="user-info">
        <div class="user-banner" :class="{ open: showUserMenu }">
          <button type="button" class="user-banner-main" @click="toggleUserMenu">
            <span class="user-avatar">{{ userInitial }}</span>
            <span class="user-banner-name">{{
              showUserMenu && isChineseName
                ? userNickname
                : displayNickname
            }}<span v-if="showUserMenu" class="user-banner-userid">{{ userId }}</span></span>
          </button>
          <div class="user-banner-actions">
            <button type="button" class="user-banner-action" :title="$t('settings.advancedSettings')" @click="openSettingsFromBar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button type="button" class="user-banner-action" @click="toggleUserMenu">
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
                <polyline points="6 15 12 9 18 15" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="showUserMenu" class="user-menu user-menu-expanded">
          <UserMenuLinks />
          <button class="btn btn--danger-outline logout-btn user-menu-signout" @click="handleSignOut">{{ $t('auth.signOut') }}</button>
        </div>
      </div>

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

    <!-- SSO Sign-In Dialog: the same shared SignInModal used by onboarding. -->
    <SignInModal
      v-if="showSsoModal"
      :on-login-success="() => aiSettings.refreshBuiltinModel()"
      @success="closeSsoModal"
      @browser-login="onModalBrowserLogin"
      @close="closeSsoModal"
    />

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
import { createLogger } from '@shared/utils/logger';
const log = createLogger('LeftPanel');
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
import { navigationStore } from '@features/course/navigationStore'
import { useSearchPage } from '@features/course/useSearchPage'
import { pinnedRecordedCourses, removePinnedCourse, openPinnedCourse } from '@features/course/pinnedCourses'
import ExtractorInstallModal from './ExtractorInstallModal.vue'
import UserMenuLinks from './UserMenuLinks.vue'
import SignInModal from './SignInModal.vue'
import AdvancedSettingsModal from './AdvancedSettingsModal.vue'
import NetworkSettingsTab from './tabs/NetworkSettingsTab.vue'
import GeneralSettingsTab from './tabs/GeneralSettingsTab.vue'
import ImageProcessingSettingsTab from './tabs/ImageProcessingSettingsTab.vue'
import PlaybackSettingsTab from './tabs/PlaybackSettingsTab.vue'
import AISettingsTab from './tabs/AISettingsTab.vue'

const { t } = useI18n()

// Navigator (Home / Live / Recorded + search bar)
const { activeNav, livePlaybackActive, recordedPlaybackActive, activePinnedId, navigate } = navigationStore
const { keyword: searchKeyword, handleSidebarFocus, handleSidebarEnter } = useSearchPage()


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
    previewFromVideo: settings.previewFromVideo,
    previewSeekSeconds: settings.previewSeekSeconds,
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
  userNickname,
  userId,
  isVerifyingToken,
  logout,
  openBrowserLogin
} = auth

const showUserMenu = ref(false)
const userInfoRef = ref<HTMLElement | null>(null)

// Signed-out "Sign In" dropup menu + SSO modal state
const showSigninMenu = ref(false)
const signinMenuRef = ref<HTMLElement | null>(null)
const showSsoModal = ref(false)

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

const toggleSigninMenu = () => {
  showSigninMenu.value = !showSigninMenu.value
}

const closeSigninMenu = () => {
  showSigninMenu.value = false
}

const openSsoModal = () => {
  closeSigninMenu()
  showSsoModal.value = true
}

const closeSsoModal = () => {
  showSsoModal.value = false
}

const startBrowserLogin = () => {
  closeSigninMenu()
  openBrowserLogin()
}

const onModalBrowserLogin = () => {
  closeSsoModal()
  openBrowserLogin()
}

const openSettingsFromBar = () => {
  closeUserMenu()
  closeSigninMenu()
  openAdvancedSettings()
}

const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as Node | null

  if (showUserMenu.value && userInfoRef.value && target && !userInfoRef.value.contains(target)) {
    closeUserMenu()
  }

  if (showSigninMenu.value && signinMenuRef.value && target && !signinMenuRef.value.contains(target)) {
    closeSigninMenu()
  }
}

// Settings
const { outputDirectory } = settings

const openOutputDirectory = async () => {
  try {
    if (outputDirectory.value) {
      await window.electronAPI.shell.openPath(outputDirectory.value)
    }
  } catch (error) {
    log.error('Failed to open output directory:', error)
  }
}

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
    log.error('Failed to open tools window:', error)
  }
}

// Add-ons Window
const openAddonsWindow = async (tab?: string) => {
  try {
    await window.electronAPI.addons.openWindow(tab)
  } catch (error) {
    log.error('Failed to open addons window:', error)
  }
}

// Settings opened from the native menu bar (macOS AutoSlides > Settings…,
// Windows/Linux File > Settings). Cleanup returned by the preload subscription.
let cleanupOpenSettings: (() => void) | undefined

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

  // Open Settings when triggered from the native menu bar
  cleanupOpenSettings = window.electronAPI.menu.onOpenSettings(() => {
    openAdvancedSettings()
  })
})

onUnmounted(() => {
  // Remove event listener for adaptive threshold changes
  window.removeEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  document.removeEventListener('click', handleDocumentClick)
  cleanupOpenSettings?.()
})

// Export for potential future use by other components
defineExpose({
  updateThresholdProgrammatically
})
</script>

<style scoped>
/* Transparent so the App.vue wrapper's sidebar background shows through:
   macOS vibrancy glass tint, solid gray elsewhere. The user bar keeps only
   its hairline. */
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background-color: transparent;
  color: var(--text-primary);
}

.login-section {
  padding: 16px;
  background-color: transparent;
  flex-shrink: 0;
}

.login-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info,
.signin-control {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 36px;
}

.verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.user-banner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 6px;
  padding: 3px 2px;
  background-color: transparent;
}

/* When open, the banner and menu both bleed 8px past the section padding so
   the drop-up is wider than the collapsed row instead of narrower. */
.user-banner.open {
  gap: 10px;
  padding: 5px 8px;
  width: calc(100% + 16px);
  margin: 0 -8px;
  border: 1px solid var(--border-input);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background-color: var(--bg-card);
}

/* Avatar + name: the menu toggle surface */
.user-banner-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 5px;
  padding: 2px 4px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.user-banner-main:hover {
  background-color: var(--bg-hover);
}

/* Settings gear + menu chevron: plain flat icon buttons */
.user-banner-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.user-banner-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.user-banner-action:hover {
  background-color: var(--bg-hover);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--accent);
  color: var(--text-on-accent);
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-banner-chevron {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.user-banner-chevron.open {
  transform: rotate(180deg);
}

.user-menu {
  position: absolute;
  bottom: calc(100% - 1px);
  left: -8px;
  right: -8px;
  z-index: 20;
  border: 1px solid var(--border-input);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background-color: var(--bg-card);
  box-shadow: 0 -6px 14px rgba(15, 23, 42, 0.08);
  padding: 8px;
}

.user-banner-userid {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.user-menu-message {
  margin: 4px 0 8px 0;
  font-size: 12px;
  color: var(--text-secondary);
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
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

.signin-avatar {
  background-color: var(--bg-hover);
  color: var(--text-secondary);
}

.signin-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signin-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.signin-option-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.signin-option:hover {
  background-color: var(--bg-hover);
}

.user-menu-expanded {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-menu-signout {
  width: 100%;
  min-height: 0;
  padding: 4px 8px;
}

.control-section {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.settings-content {
  padding: 0;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal-content {
  background-color: var(--bg-modal);
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
  border-bottom: 1px solid var(--border-color);
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
  background-color: var(--bg-hover);
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.3;
}

.setting-description .json-example {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10px;
  background-color: var(--hover-tint);
  padding: 2px 5px;
  border-radius: 3px;
  color: var(--text-primary);
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
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.save-btn {
  background-color: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}

.save-btn:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

/* Navigator (Apple Music style sidebar) */
.navigator-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Recessed gray field slightly darker than the sidebar (Apple Music style) */
.nav-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background-color: var(--hover-tint);
  transition: border-color 0.2s;
}

/* Apple Music style group label above a nav group */
.nav-group-title {
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--text-muted);
}

.nav-search:focus-within,
.nav-search.active {
  border-color: var(--accent);
}

.nav-search-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.nav-search-input {
  flex: 1;
  min-width: 0;
  min-height: var(--control-height);
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
}

.nav-search-input::placeholder {
  color: var(--text-muted);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  /* Items indent clearly past the group label, Apple Music style */
  padding: 8px 10px 8px 20px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.nav-item:hover {
  background-color: var(--bg-hover);
}

.nav-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.nav-item-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.nav-item span:not(.nav-playback-indicator) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pinned recorded courses — a nav-item with a hover-revealed unpin button. */
.pinned-row {
  position: relative;
  display: flex;
  align-items: center;
}

.pinned-item {
  /* Reserve room on the right so the label never sits under the unpin button. */
  padding-right: 30px;
}

.pinned-unpin {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.pinned-row:hover .pinned-unpin {
  opacity: 1;
}

.pinned-unpin:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.nav-playback-indicator {
  flex: none;
  color: var(--success);
  font-size: 10px;
  font-weight: bold;
  animation: nav-pulse 2s infinite;
}

@keyframes nav-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.panel-actions-title {
  margin: 18px 0 4px;
}

/* Window launchers: same flat style as the navigator items */
.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-action-button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px 8px 20px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-action-button:hover {
  background-color: var(--bg-hover);
}

.panel-action-button span {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-action-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.panel-action-external-icon {
  flex-shrink: 0;
  opacity: 0.45;
}

/* Dark mode support */

/* Downsampling control styles - modified to accommodate presets */

.downsampling-control .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-primary);
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
  accent-color: var(--accent);
}

/* Downsampling presets styles */

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
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  margin-top: 8px;
}

.name-input-field::placeholder {
  color: var(--text-muted);
}

.name-input-field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}
</style>
