<template>
  <div class="app">
    <!-- Full-page routes render standalone (no Header / LeftPanel / bottom nav).
         Notes + Slides are KeepAlive-cached so deep links share one instance;
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

    <!-- Responsive Mobile Bottom Navigation Bar. Four tabs only: the three
         browse modes plus More, which holds Slides / Notes / Settings and the
         rest of the desktop rail (hidden entirely under 768px). -->
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
        </div>
        <span class="bottom-nav-label">{{ $t('navigation.recorded') }}</span>
      </button>

      <button
        :class="['bottom-nav-item', { active: moreOpen || MORE_NAVS.includes(activeNav) }]"
        :aria-expanded="moreOpen"
        @click="moreOpen = !moreOpen"
      >
        <svg class="bottom-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <span class="bottom-nav-label">{{ $t('navigation.moreLinks') }}</span>
      </button>
    </nav>

    <MobileMoreSheet v-if="isMobile && moreOpen" @close="moreOpen = false" />
    </template>

    <!-- First-run notice. Skipped on full-page routes so its own Terms/Privacy
         links are reachable; it reappears on return until acknowledged. -->
    <FirstRunNotice v-if="!isFullPage && !noticeStore.acknowledged.value" />
    <ConfirmHost />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import ConfirmHost from './components/ConfirmHost.vue'
import FirstRunNotice from './components/FirstRunNotice.vue'
import Header from './components/Header.vue'
import LeftPanel from './components/LeftPanel.vue'
import MainContent from './components/MainContent.vue'
import MobileMoreSheet from './components/MobileMoreSheet.vue'
import { noticeStore } from './stores/noticeStore'
import { playbackStore } from './stores/playbackStore'
import { navigationStore, type NavTarget } from './stores/navigationStore'

const { isSidebarCollapsed, activeNav, navigate } = navigationStore

const isMobile = ref(false)

// Destinations that live behind the bottom bar's More tab, so the tab still
// reads as selected while one of them is open.
const MORE_NAVS: NavTarget[] = ['slides', 'notes', 'settings', 'subscriptions']
const moreOpen = ref(false)

const route = useRoute()
const isFullPage = computed(() => route.meta.fullPage === true)

// Notes + Slides need full-page KeepAlive so deep links share one instance.
const FULLPAGE_CACHE_NAMES = ['NotesPage', 'SlidesPage']
const fullPageCacheKey = (r: RouteLocationNormalizedLoaded) => {
  if (r.name === 'notes' || r.name === 'notes-detail') return 'NotesPage'
  if (r.name === 'slides' || r.name === 'slides-folder') return 'SlidesPage'
  return String(r.name)
}

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) moreOpen.value = false
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
  /* dvh keeps the bottom bar on screen while mobile browser chrome
     collapses/expands; vh above is the fallback for older engines. */
  height: 100dvh;
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
  height: calc(100dvh - var(--header-height));
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
  /* Sit above the iOS home indicator without shrinking the tap targets. */
  height: calc(3.5rem + env(safe-area-inset-bottom));
  padding: 0 max(0.5rem, env(safe-area-inset-right)) env(safe-area-inset-bottom)
    max(0.5rem, env(safe-area-inset-left));
  background-color: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  position: relative;
  z-index: var(--z-overlay);
  box-shadow: 0 -1px 3px var(--shadow-sm);
  flex-shrink: 0;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  height: 3.5rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0.25rem 0;
  -webkit-tap-highlight-color: transparent;
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
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .layout {
    height: calc(100dvh - var(--header-height) - 3.5rem - env(safe-area-inset-bottom));
  }
}
</style>
