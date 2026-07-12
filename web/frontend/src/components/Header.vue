<template>
  <header class="masthead" :class="{ 'mobile-search-active': showMobileSearch }">
    <!-- Desktop Left / Mobile Brand (hidden when mobile search is active) -->
    <div class="masthead-left" v-show="!showMobileSearch">
      <button
        v-if="!isMobile"
        class="masthead-btn hamburger-btn"
        @click="onHamburger"
        :aria-label="$t('navigation.menu')"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div class="logo-wrap" @click="navigate('home')">
        <!-- YouTube styled play icon customized for slides -->
        <div class="logo-icon-box">
          <svg class="logo-svg" width="30" height="22" viewBox="0 0 30 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="30" height="22" rx="5" fill="#FF0000"/>
            <polygon points="12,6 20,11 12,16" fill="white"/>
            <!-- Slide lines underneath for branding -->
            <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="logo-text">AutoSlides</span>
      </div>
    </div>

    <!-- Mobile Search Back Button -->
    <button
      v-if="showMobileSearch"
      class="masthead-btn back-search-btn"
      type="button"
      @click="showMobileSearch = false"
      aria-label="Back"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12,19 5,12 12,5"></polyline>
      </svg>
    </button>

    <!-- Centered Search Form (Desktop always, Mobile when active) -->
    <div
      class="masthead-middle"
      :class="{ 'mobile-search-open': showMobileSearch }"
      v-show="!isMobile || showMobileSearch"
    >
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

    <!-- Right Controls / Profile (hidden when mobile search is active) -->
    <div class="masthead-right" v-show="!showMobileSearch">
      <!-- Mobile Search Trigger Button -->
      <button
        v-if="isMobile"
        class="masthead-btn search-trigger-btn"
        type="button"
        @click="showMobileSearch = true"
        aria-label="Toggle Search"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>

      <div v-if="isVerifyingToken" class="auth-loading">
        <div class="loading-spinner"></div>
      </div>
      <div v-else class="auth-wrap">
        <!-- Not Logged In -->
        <div v-if="!isLoggedIn" ref="signinMenuRef" class="signin-control">
          <button class="signin-trigger-btn" type="button" @click="toggleSigninMenu">
            <span class="signin-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span class="signin-text">{{ $t('auth.signIn') }}</span>
          </button>
          
          <div v-if="showSigninMenu" class="dropdown-menu signin-dropdown">
            <button type="button" class="dropdown-item" @click="openSignIn('password')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <span>{{ $t('webAuth.signInWithPassword') }}</span>
            </button>
            <button type="button" class="dropdown-item" @click="openSignIn('token')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              <span>{{ $t('webAuth.signInWithToken') }}</span>
            </button>
          </div>
        </div>

        <!-- Logged In -->
        <template v-else>
          <!-- Bell Icon / Subscriptions Dropdown -->
          <div ref="bellMenuRef" class="bell-control">
            <button class="bell-btn" type="button" @click="toggleBellMenu" :title="$t('navigation.subscriptions')">
              <svg class="bell-icon" width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span v-if="subscribedCount > 0" class="bell-badge"></span>
            </button>

            <!-- Dropdown popup list -->
            <div v-if="showBellMenu" class="dropdown-menu bell-dropdown custom-scrollbar">
              <div class="bell-dropdown-header">
                <h3>{{ $t('navigation.subscriptions') }}</h3>
              </div>
              <div class="dropdown-divider"></div>
              
              <div v-if="subscribedRecordedCourses.length === 0" class="bell-empty-state">
                <p>{{ $t('sessions.noSubscriptions') }}</p>
              </div>
              <div v-else class="bell-items">
                <button
                  v-for="c in subscribedRecordedCourses"
                  :key="c.id"
                  class="dropdown-item bell-item"
                  type="button"
                  @click="clickSubscribedCourse(c)"
                >
                  <div class="bell-avatar" :style="{ backgroundColor: getAvatarBg(c.title) }">
                    {{ getInitials(c.title) }}
                  </div>
                  <div class="bell-item-info">
                    <span class="bell-item-title" :title="c.title">{{ c.title }}</span>
                    <span v-if="c.instructor" class="bell-item-sub">{{ c.instructor }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div ref="userInfoRef" class="user-control">
            <button class="avatar-btn" type="button" @click="toggleUserMenu">
              <span class="user-avatar-circle">{{ userInitial }}</span>
            </button>

          <div v-if="showUserMenu" class="dropdown-menu user-dropdown">
            <div class="user-profile-header">
              <div class="user-name">{{ userNickname }}</div>
              <div class="user-id">@{{ userId }}</div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" type="button" @click="openSettings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>{{ $t('settings.settings') }}</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-item--danger" type="button" @click="handleSignOut">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>{{ $t('auth.signOut') }}</span>
            </button>
          </div>
        </div>
      </template>
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
import { subscribedRecordedCourses, openSubscribedCourse } from '../composables/subscribedCourses'
import { getAvatarBg, getInitials } from '../composables/courseCover'
import type { SubscribedCourse } from '../stores/configStore'

const { navigate, toggleSidebar } = navigationStore

// Desktop-only (hidden on mobile, where the bottom nav takes over): the
// hamburger collapses/expands the sidebar rail.
const onHamburger = () => {
  toggleSidebar()
}
const { keyword: searchKeyword, handleSidebarFocus, executeSearch } = useSearchPage()
const { isLoggedIn, userNickname, userId, isVerifyingToken, signOut } = authStore

// User initials
const userInitial = computed(() => {
  const name = userNickname.value.trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})

const showUserMenu = ref(false)
const userInfoRef = ref<HTMLElement | null>(null)

const showBellMenu = ref(false)
const bellMenuRef = ref<HTMLElement | null>(null)

const toggleBellMenu = () => {
  showBellMenu.value = !showBellMenu.value
}

const closeBellMenu = () => {
  showBellMenu.value = false
}

const clickSubscribedCourse = (course: SubscribedCourse) => {
  closeBellMenu()
  openSubscribedCourse(course)
}

const subscribedCount = computed(() => subscribedRecordedCourses.value.length)

const showSigninMenu = ref(false)
const signinMenuRef = ref<HTMLElement | null>(null)

const showSignInModal = ref(false)
const signInMode = ref<'password' | 'token'>('password')

// Responsive state
const showMobileSearch = ref(false)
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    showMobileSearch.value = false
  }
}

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
  navigate('search')
  executeSearch()
  showMobileSearch.value = false
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

  if (showBellMenu.value && bellMenuRef.value && target && !bellMenuRef.value.contains(target)) {
    closeBellMenu()
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 1rem;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  position: relative;
  z-index: 100;
  box-shadow: 0 1px 3px var(--shadow-sm);
  transition: padding 0.2s ease;
}

.masthead.mobile-search-active {
  padding: 0 0.5rem;
}

.masthead-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.masthead-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
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
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.logo-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-svg {
  display: block;
}

.logo-text {
  font-family: Roboto, Inter, sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.05rem;
  color: var(--text-primary);
}

/* Centered Pill Search Bar */
.masthead-middle {
  flex: 0 1 37.5rem;
  margin: 0 1rem;
  transition: all 0.2s ease;
}

.masthead-middle.mobile-search-open {
  flex: 1;
  margin: 0 0.5rem;
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
  border-radius: 2.5rem 0 0 2.5rem;
  background-color: var(--bg-input);
  padding: 0 0.25rem 0 1rem;
  height: var(--control-height);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input-wrap:focus-within {
  border-color: var(--link-color);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05), 0 0 0 1px var(--link-color);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  font-size: 0.9375rem;
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
  width: 1.75rem;
  height: 1.75rem;
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
  width: 4rem;
  height: var(--control-height);
  border: 1px solid var(--border-input);
  border-left: none;
  border-radius: 0 2.5rem 2.5rem 0;
  background-color: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-btn:hover {
  background-color: var(--bg-hover);
}

/* Right side controls */
.masthead-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
}

.loading-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--accent-deep);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* YouTube Style Sign In Pill */
.signin-control {
  position: relative;
}

.signin-trigger-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: var(--control-height);
  padding: 0 0.75rem;
  border: 1px solid var(--accent-deep);
  border-radius: 2.5rem;
  background: transparent;
  color: var(--accent-deep);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.signin-trigger-btn:hover {
  background-color: var(--focus-ring);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.signin-icon-wrap {
  display: flex;
  align-items: center;
  color: var(--accent-deep);
}

/* User Controls and Dropdown Menu */
.user-control {
  position: relative;
}

.avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  padding: 0;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
}

.user-avatar-circle {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background-color: var(--accent-deep);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
}

/* Floating Dropdown Menus */
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  width: 15rem;
  background-color: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  box-shadow: 0 4px 20px var(--shadow-lg);
  padding: 0.5rem 0;
  z-index: 1000;
}

.signin-dropdown {
  width: 12.5rem;
}

.user-profile-header {
  padding: 0.75rem 1rem;
}

.user-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-id {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}

.dropdown-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 0.375rem 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
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

/* Mobile responsive search overlay style */
@media (max-width: 768px) {
  .masthead-middle {
    display: none;
  }
  
  .masthead-middle.mobile-search-open {
    display: flex;
    position: absolute;
    top: 0;
    left: 3.5rem;
    right: 0.5rem;
    height: 100%;
    align-items: center;
    z-index: 101;
  }
}
/* Bell notification control styling */
.bell-control {
  position: relative;
  display: flex;
  align-items: center;
}

.bell-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  padding: 0;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
  position: relative;
  transition: background-color 0.2s;
}

.bell-btn:hover {
  background-color: var(--bg-hover);
}

.bell-icon {
  flex-shrink: 0;
}

.bell-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background-color: var(--accent);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--bg-surface);
}

.bell-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  width: 20rem;
  max-height: 25rem;
  overflow-y: auto;
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
  box-shadow: 0 8px 24px var(--shadow-lg);
  z-index: 101;
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
}

.bell-dropdown-header {
  padding: 0.5rem 1rem 0.25rem;
}

.bell-dropdown-header h3 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.bell-empty-state {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.bell-items {
  display: flex;
  flex-direction: column;
}

.bell-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem !important;
  text-align: left;
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.bell-item:hover {
  background-color: var(--bg-hover);
}

.bell-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.bell-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.bell-item-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bell-item-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.125rem;
}
</style>
