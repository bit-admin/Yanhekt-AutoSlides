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
          <div class="nav-group-title">{{ $t('navigation.appName') }}</div>
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
            <button :class="['nav-item', { active: activeNav === 'recorded' }]" @click="navigate('recorded')">
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
            <button type="button" class="signin-option" @click="openSignIn('password')">
              <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <span>{{ $t('webAuth.signInWithPassword') }}</span>
            </button>
            <button type="button" class="signin-option" @click="openSignIn('token')">
              <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span>{{ $t('webAuth.signInWithToken') }}</span>
            </button>
          </div>
        </div>
        <div v-else ref="userInfoRef" class="user-info">
          <div class="user-banner" :class="{ open: showUserMenu }">
            <button type="button" class="user-banner-main" @click="toggleUserMenu">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-banner-name">{{ userNickname }}<span v-if="showUserMenu" class="user-banner-userid">{{ userId }}</span></span>
            </button>
            <div class="user-banner-actions">
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
            <button class="btn btn--danger-outline user-menu-signout" @click="handleSignOut">{{ $t('auth.signOut') }}</button>
          </div>
        </div>
      </div>
    </div>

    <SignInModal
      v-if="showSignInModal"
      :initial-mode="signInMode"
      @close="showSignInModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigationStore } from '../stores/navigationStore'
import { playbackStore } from '../stores/playbackStore'
import { authStore } from '../stores/authStore'
import { useSearchPage } from '../composables/useSearchPage'
import SignInModal from './SignInModal.vue'

const { activeNav, navigate } = navigationStore
const { keyword: searchKeyword, handleSidebarFocus, handleSidebarEnter } = useSearchPage()
const { isLoggedIn, userNickname, userId, isVerifyingToken, signOut } = authStore

const livePlaybackActive = computed(() => playbackStore.active.value?.mode === 'live')
const recordedPlaybackActive = computed(() => playbackStore.active.value?.mode === 'recorded')

const userInitial = computed(() => {
  const name = userNickname.value.trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})

const showUserMenu = ref(false)
const userInfoRef = ref<HTMLElement | null>(null)

const showSigninMenu = ref(false)
const signinMenuRef = ref<HTMLElement | null>(null)

const showSignInModal = ref(false)
const signInMode = ref<'password' | 'token'>('password')

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleSignOut = () => {
  closeUserMenu()
  signOut()
}

const toggleSigninMenu = () => {
  showSigninMenu.value = !showSigninMenu.value
}

const closeSigninMenu = () => {
  showSigninMenu.value = false
}

const openSignIn = (mode: 'password' | 'token') => {
  closeSigninMenu()
  signInMode.value = mode
  showSignInModal.value = true
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

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
/* Solid sidebar (the desktop app keeps this transparent for the macOS
   vibrancy glass — the web shell paints it directly). */
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background-color: var(--bg-page-alt);
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

@keyframes spin {
  to { transform: rotate(360deg); }
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
</style>
