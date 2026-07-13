<template>
  <div class="left-panel" :class="{ 'collapsed': isSidebarCollapsed }">
    <div class="control-section custom-scrollbar">
      <div class="settings-content">
        <!-- Expanded Navigator -->
        <div v-if="!isSidebarCollapsed" class="navigator-section">
          <nav class="nav-items">
            <button :class="['nav-item', { active: activeNav === 'home' }]" @click="navigate('home')">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>{{ $t('navigation.home') }}</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'live' }]" @click="navigate('live')">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
              </svg>
              <span>{{ $t('navigation.live') }}</span>
              <span v-if="livePlaybackActive" class="nav-playback-indicator">●</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'recorded' && !activeSubscribed }]" @click="navigate('recorded')">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>{{ $t('navigation.recorded') }}</span>
              <span v-if="recordedPlaybackActive" class="nav-playback-indicator">●</span>
            </button>
            <div class="nav-divider"></div>
            <button :class="['nav-item', { active: activeNav === 'slides' }]" @click="navigate('slides')">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>{{ $t('navigation.slidesReview') }}</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'settings' }]" @click="navigate('settings')">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>{{ $t('settings.settings') }}</span>
            </button>
          </nav>

          <div class="nav-divider"></div>

          <div class="nav-group-title" v-if="subscribedRecordedCourses.length > 0">
            {{ $t('navigation.subscriptions') }}
          </div>
          <div class="nav-items" v-if="subscribedRecordedCourses.length > 0">
            <div v-for="c in subscribedRecordedCourses" :key="c.id" class="subscribed-row">
              <button
                :class="['nav-item', 'subscribed-item', { active: activeSubscribed === c.id }]"
                @click="openSubscribedCourse(c)"
                :title="c.title"
              >
                <!-- Subscription Style Circle Initials Avatar -->
                <div class="subscribed-avatar" :style="{ backgroundColor: getAvatarBg(c.title) }">
                  {{ getInitials(c.title) }}
                </div>
                <span class="subscribed-label">{{ c.title }}</span>
              </button>
              <button
                class="subscribed-unpin"
                @click.stop="removeSubscribedCourse(c.id)"
                :title="$t('sessions.unpin')"
                :aria-label="$t('sessions.unpin')"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Collapsed/Mini Navigator (YouTube Style) -->
        <div v-else class="mini-navigator">
          <button :class="['mini-nav-item', { active: activeNav === 'home' }]" @click="navigate('home')" :title="$t('navigation.home')">
            <svg class="mini-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="mini-nav-label">{{ $t('navigation.home') }}</span>
          </button>
          
          <button :class="['mini-nav-item', { active: activeNav === 'live' }]" @click="navigate('live')" :title="$t('navigation.live')">
            <div class="mini-nav-icon-wrap">
              <svg class="mini-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
              </svg>
              <span v-if="livePlaybackActive" class="mini-playback-indicator">●</span>
            </div>
            <span class="mini-nav-label">{{ $t('navigation.live') }}</span>
          </button>
          
          <button :class="['mini-nav-item', { active: activeNav === 'recorded' }]" @click="navigate('recorded')" :title="$t('navigation.recorded')">
            <div class="mini-nav-icon-wrap">
              <svg class="mini-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span v-if="recordedPlaybackActive" class="mini-playback-indicator">●</span>
            </div>
            <span class="mini-nav-label">{{ $t('navigation.recorded') }}</span>
          </button>
          <div class="nav-divider"></div>
          <button :class="['mini-nav-item', { active: activeNav === 'slides' }]" @click="navigate('slides')" :title="$t('navigation.slidesReview')">
            <svg class="mini-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            <span class="mini-nav-label">{{ $t('navigation.slidesReview') }}</span>
          </button>

          <button :class="['mini-nav-item', { active: activeNav === 'settings' }]" @click="navigate('settings')" :title="$t('settings.settings')">
            <svg class="mini-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="mini-nav-label">{{ $t('settings.settings') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navigationStore } from '../stores/navigationStore'
import { subscribedRecordedCourses, openSubscribedCourse, removeSubscribedCourse } from '../composables/subscribedCourses'
import { getAvatarBg, getInitials } from '../composables/courseCover'

const { activeNav, activeSubscribed, navigate, isSidebarCollapsed } = navigationStore

const route = useRoute()
const livePlaybackActive = computed(() => route.name === 'player-live')
const recordedPlaybackActive = computed(() => route.name === 'player-recorded')
</script>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.control-section {
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
}

.left-panel.collapsed .control-section {
  padding: 0.5rem 0;
}

.settings-content {
  padding: 0;
}

.navigator-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 0.75rem 0.5rem;
}

/* YouTube Style Section Header */
.nav-group-title {
  padding: 0.25rem 0.75rem 0.625rem;
  font-family: Roboto, Inter, sans-serif;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  text-transform: none;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

/* Subscribed recorded courses */
.subscribed-row {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 0.375rem;
}

.subscribed-item {
  padding-right: 2.25rem !important;
  margin: 0 !important;
  flex: 1;
  min-width: 0;
}

.subscribed-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.subscribed-unpin {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
  z-index: 5;
}

.subscribed-row:hover .subscribed-unpin {
  opacity: 1;
}

.subscribed-unpin:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  width: auto;
  margin: 0 0.375rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.625rem;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 0.15s;
  text-align: left;
}

.nav-item:hover {
  background-color: var(--bg-hover);
}

.nav-item.active {
  background-color: var(--bg-hover);
  font-weight: 500;
}

.nav-item-icon {
  flex-shrink: 0;
  color: var(--text-primary);
}

.nav-item.active .nav-item-icon {
  color: var(--accent-deep);
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
  color: var(--accent);
  font-size: 0.625rem;
  font-weight: bold;
  animation: nav-pulse 2s infinite;
}

@keyframes nav-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* YouTube Mini Navigation Style */
.mini-navigator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 0.25rem;
}

.mini-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: calc(100% - 0.5rem);
  margin: 0 0.25rem;
  padding: 0.875rem 0 0.75rem;
  border: none;
  background: transparent;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  color: var(--text-primary);
}

.mini-nav-item:hover {
  background-color: var(--bg-hover);
}

.mini-nav-item.active {
  font-weight: 500;
}

.mini-nav-item.active .mini-nav-icon {
  color: var(--accent-deep);
}

.mini-nav-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-nav-icon {
  color: var(--text-primary);
}

.mini-nav-label {
  font-size: 0.625rem;
  margin-top: 0.375rem;
  max-width: 4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-playback-indicator {
  position: absolute;
  top: -0.25rem;
  right: -0.375rem;
  color: var(--accent);
  font-size: 0.5rem;
  animation: nav-pulse 2s infinite;
}
</style>
