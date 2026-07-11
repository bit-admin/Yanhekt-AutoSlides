<template>
  <header class="masthead">
    <div class="masthead-left">
      <button
        class="masthead-btn hamburger-btn"
        @click="toggleSidebar"
        :aria-label="$t('navigation.menu')"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="12" x2="20" y2="12"></line>
          <line x1="4" y1="6" x2="20" y2="6"></line>
          <line x1="4" y1="18" x2="20" y2="18"></line>
        </svg>
      </button>
      <div class="logo-wrap" @click="navigate('home')">
        <img class="logo-img" src="/icon.png" alt="AutoSlides Logo" />
        <span class="logo-text">AutoSlides</span>
      </div>
    </div>

    <div class="masthead-middle">
      <form class="search-form" @submit.prevent="handleSearchSubmit">
        <div class="search-input-wrap">
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            :placeholder="$t('navigation.searchPlaceholder')"
            @focus="handleSidebarFocus"
          />
          <button
            v-if="searchKeyword"
            class="clear-btn"
            type="button"
            @click="clearSearch"
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <button class="search-btn" type="submit" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </form>
    </div>

    <div class="masthead-right">
      <div v-if="isVerifyingToken" class="auth-loading">
        <div class="loading-spinner"></div>
      </div>
      <div v-else class="auth-wrap">
        <!-- Not Logged In -->
        <div v-if="!isLoggedIn" ref="signinMenuRef" class="signin-control">
          <button class="signin-trigger-btn" type="button" @click="toggleSigninMenu">
            <span class="signin-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span class="signin-text">{{ $t('auth.signIn') }}</span>
          </button>
          
          <div v-if="showSigninMenu" class="dropdown-menu signin-dropdown">
            <button type="button" class="dropdown-item" @click="openSignIn('password')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <span>{{ $t('webAuth.signInWithPassword') }}</span>
            </button>
            <button type="button" class="dropdown-item" @click="openSignIn('token')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span>{{ $t('webAuth.signInWithToken') }}</span>
            </button>
          </div>
        </div>

        <!-- Logged In -->
        <div v-else ref="userInfoRef" class="user-control">
          <button class="avatar-btn" type="button" @click="toggleUserMenu">
            <span class="user-avatar-circle">{{ userInitial }}</span>
          </button>

          <div v-if="showUserMenu" class="dropdown-menu user-dropdown">
            <div class="user-profile-header">
              <div class="user-name">{{ userNickname }}</div>
              <div class="user-id">{{ userId }}</div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" type="button" @click="openSettings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>{{ $t('settings.settings') }}</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-item--danger" type="button" @click="handleSignOut">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>{{ $t('auth.signOut') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <SignInModal
      v-if="showSignInModal"
      :initial-mode="signInMode"
      @close="showSignInModal = false"
    />
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigationStore } from '../stores/navigationStore'
import { authStore } from '../stores/authStore'
import { useSearchPage } from '../composables/useSearchPage'
import SignInModal from './SignInModal.vue'

const { navigate, toggleSidebar } = navigationStore
const { keyword: searchKeyword, handleSidebarFocus, executeSearch } = useSearchPage()
const { isLoggedIn, userNickname, userId, isVerifyingToken, signOut } = authStore

// User initials
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

const openSettings = () => {
  closeUserMenu()
  navigate('settings')
}

const handleSignOut = () => {
  closeUserMenu()
  signOut()
}

const handleSearchSubmit = () => {
  // Triggers search execution and ensures navigation to 'search' page.
  navigate('search')
  executeSearch()
}

const clearSearch = () => {
  searchKeyword.value = ''
  executeSearch()
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
.masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  position: relative;
  z-index: 100;
  box-shadow: 0 1px 3px var(--shadow-sm);
}

.masthead-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.masthead-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
}

.masthead-btn:hover {
  background-color: var(--bg-hover);
}

.logo-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  transition: filter 0.3s ease;
}

:global(html[data-theme="dark"] .logo-img) {
  filter: invert(1) hue-rotate(180deg);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

/* YouTube Style Centered Search Bar */
.masthead-middle {
  flex: 0 1 600px;
  margin: 0 16px;
}

.search-form {
  display: flex;
  width: 100%;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
  border: 1px solid var(--border-input);
  border-radius: 40px 0 0 40px;
  background-color: var(--bg-input);
  padding: 0 4px 0 16px;
  height: 40px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05), 0 0 0 1px var(--accent);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  height: 100%;
  padding: 0;
  width: 100%;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
}

.clear-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 40px;
  border: 1px solid var(--border-input);
  border-left: none;
  border-radius: 0 40px 40px 0;
  background-color: var(--bg-page-alt);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-btn:hover {
  background-color: var(--bg-hover);
}

/* Right Section Accounts & controls */
.masthead-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-wrap {
  position: relative;
}

/* YouTube Style Sign In Button */
.signin-control {
  position: relative;
}

.signin-trigger-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--accent);
  border-radius: 36px;
  background: transparent;
  color: var(--accent);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.signin-trigger-btn:hover {
  background-color: var(--badge-active-bg);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.signin-icon-wrap {
  display: flex;
  align-items: center;
}

/* User Controls and Dropdown Menu */
.user-control {
  position: relative;
}

.avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  padding: 0;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
}

.user-avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--accent);
  color: var(--text-on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}

/* Floating Dropdown Menus */
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 240px;
  background-color: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 20px var(--shadow-lg);
  padding: 8px 0;
  z-index: 1000;
}

.signin-dropdown {
  width: 200px;
}

.user-profile-header {
  padding: 12px 16px;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-id {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 6px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
}

.dropdown-item--danger {
  color: var(--danger);
}

.dropdown-item--danger:hover {
  background-color: var(--danger-bg);
}

@media (max-width: 600px) {
  .masthead-middle {
    display: none; /* Hide search bar on mobile screens, or let it toggle. YouTube hides it and shows a separate toggle. */
  }
}
</style>
