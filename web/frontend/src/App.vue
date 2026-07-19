<template>
  <div class="app">
    <!-- Full-page routes render standalone (no Header / LeftPanel / bottom nav).
         Notes is KeepAlive-cached so /notes ↔ /notes/:id share one instance;
         login/apps/legal stay uncached (keepAlive: false). -->
    <RouterView v-if="isFullPage" v-slot="{ Component, route: fullPageRoute }">
      <KeepAlive :include="FULLPAGE_CACHE_NAMES" :max="4">
        <component
          :is="Component"
          v-if="fullPageRoute.meta.keepAlive"
          :key="fullPageCacheKey(fullPageRoute)"
          class="fullpage-view"
        />
      </KeepAlive>
      <component
        :is="Component"
        v-if="!fullPageRoute.meta.keepAlive"
        :key="fullPageRoute.fullPath"
        class="fullpage-view"
      />
    </RouterView>

    <template v-else>
    <Header />
    <div class="layout">
      <!-- Desktop sidebar (hidden on mobile and in cinema mode) -->
      <div
        v-if="!isMobile"
        class="left-panel-slot"
        :class="{ 'collapsed': isSidebarCollapsed }"
        v-show="!playbackStore.cinema.value"
      >
        <LeftPanel />
      </div>

      <!-- Main content area -->
      <div class="main-content-slot">
        <MainContent />
      </div>
    </div>

    <!-- Responsive Mobile Bottom Navigation Bar -->
    <nav v-if="isMobile && !playbackStore.cinema.value" class="mobile-bottom-nav">
      <button :class="['bottom-nav-item', { active: activeNav === 'home' }]" @click="navigate('home')">
        <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="bottom-nav-label">{{ $t('navigation.home') }}</span>
      </button>
      
      <button :class="['bottom-nav-item', { active: activeNav === 'live' }]" @click="navigate('live')">
        <div class="bottom-nav-icon-wrap">
          <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
          </svg>
          <span v-if="livePlaybackActive" class="bottom-playback-indicator">●</span>
        </div>
        <span class="bottom-nav-label">{{ $t('navigation.live') }}</span>
      </button>

      <button :class="['bottom-nav-item', { active: activeNav === 'recorded' }]" @click="navigate('recorded')">
        <div class="bottom-nav-icon-wrap">
          <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span v-if="recordedPlaybackActive" class="bottom-playback-indicator">●</span>
        </div>
        <span class="bottom-nav-label">{{ $t('navigation.recorded') }}</span>
      </button>

      <button :class="['bottom-nav-item', { active: activeNav === 'slides' }]" @click="navigate('slides')">
        <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <span class="bottom-nav-label">{{ $t('navigation.slidesReview') }}</span>
      </button>

      <button :class="['bottom-nav-item', { active: activeNav === 'notes' }]" @click="navigate('notes')">
        <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span class="bottom-nav-label">{{ $t('navigation.notes') }}</span>
      </button>

      <button :class="['bottom-nav-item', { active: activeNav === 'settings' }]" @click="navigate('settings')">
        <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="bottom-nav-label">{{ $t('settings.settings') }}</span>
      </button>
    </nav>
    </template>

    <!-- First-run notice. Skipped on full-page routes so its own Terms/Privacy
         links are reachable; it reappears on return until acknowledged. -->
    <FirstRunNotice v-if="!isFullPage && !noticeStore.acknowledged.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import FirstRunNotice from './components/FirstRunNotice.vue'
import Header from './components/Header.vue'
import LeftPanel from './components/LeftPanel.vue'
import MainContent from './components/MainContent.vue'
import { noticeStore } from './stores/noticeStore'
import { playbackStore } from './stores/playbackStore'
import { navigationStore } from './stores/navigationStore'

const { isSidebarCollapsed, activeNav, navigate } = navigationStore

const isMobile = ref(false)

const route = useRoute()
const isFullPage = computed(() => route.meta.fullPage === true)
const livePlaybackActive = computed(() => route.name === 'player-live')
const recordedPlaybackActive = computed(() => route.name === 'player-recorded')

// Only Notes needs full-page KeepAlive (list + editor state across deep links).
const FULLPAGE_CACHE_NAMES = ['NotesPage']
const fullPageCacheKey = (r: RouteLocationNormalizedLoaded) =>
  r.name === 'notes' || r.name === 'notes-detail' ? 'NotesPage' : String(r.name)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-page);
}

.fullpage-view {
  height: 100%;
  width: 100%;
  min-height: 0;
}

.layout {
  display: flex;
  flex: 1;
  height: calc(100vh - var(--header-height));
  min-height: 0;
  position: relative;
}

.left-panel-slot {
  width: var(--sidebar-width-expanded);
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-page);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.left-panel-slot.collapsed {
  width: var(--sidebar-width-collapsed);
}

.main-content-slot {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

/* YouTube Style Mobile Bottom Navigation */
.mobile-bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 3.5rem;
  background-color: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  position: relative;
  z-index: 99;
  box-shadow: 0 -1px 3px var(--shadow-sm);
  padding: 0 0.5rem;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0.25rem 0;
}

.bottom-nav-item.active {
  font-weight: 500;
}

.bottom-nav-item.active .bottom-nav-icon {
  color: var(--accent-deep);
}

.bottom-nav-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav-icon {
  color: var(--text-primary);
}

.bottom-nav-label {
  font-size: 0.625rem;
  margin-top: 0.25rem;
}

.bottom-playback-indicator {
  position: absolute;
  top: -0.25rem;
  right: -0.375rem;
  color: var(--accent);
  font-size: 0.5rem;
  animation: bottom-pulse 2s infinite;
}

@keyframes bottom-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 768px) {
  .layout {
    height: calc(100vh - var(--header-height) - 3.5rem);
  }
}
</style>
