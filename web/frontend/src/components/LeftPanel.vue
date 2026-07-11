<template>
  <div class="left-panel" :class="{ 'collapsed': isSidebarCollapsed }">
    <div class="control-section custom-scrollbar">
      <div class="settings-content">
        <!-- Expanded Navigator -->
        <div v-if="!isSidebarCollapsed" class="navigator-section">
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
            <button :class="['nav-item', { active: activeNav === 'recorded' && !activePinned }]" @click="navigate('recorded')">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>{{ $t('navigation.recorded') }}</span>
              <span v-if="recordedPlaybackActive" class="nav-playback-indicator">●</span>
            </button>
            <button :class="['nav-item', { active: activeNav === 'settings' }]" @click="navigate('settings')">
              <svg class="nav-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>{{ $t('settings.settings') }}</span>
            </button>
          </nav>

          <div class="nav-group-title panel-actions-title" v-if="pinnedRecordedCourses.length > 0">{{ $t('navigation.pinned') }}</div>
          <div class="nav-items" v-if="pinnedRecordedCourses.length > 0">
            <div v-for="c in pinnedRecordedCourses" :key="c.id" class="pinned-row">
              <button :class="['nav-item', 'pinned-item', { active: activePinned === c.id }]" @click="openPinnedCourse(c)" :title="c.title">
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

        <!-- Collapsed/Mini Navigator (YouTube Style) -->
        <div v-else class="mini-navigator">
          <button :class="['mini-nav-item', { active: activeNav === 'home' }]" @click="navigate('home')" :title="$t('navigation.home')">
            <svg class="mini-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="mini-nav-label">{{ $t('navigation.home') }}</span>
          </button>
          
          <button :class="['mini-nav-item', { active: activeNav === 'live' }]" @click="navigate('live')" :title="$t('navigation.live')">
            <div class="mini-nav-icon-wrap">
              <svg class="mini-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m23 7-3 2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4l3 2z"/>
              </svg>
              <span v-if="livePlaybackActive" class="mini-playback-indicator">●</span>
            </div>
            <span class="mini-nav-label">{{ $t('navigation.live') }}</span>
          </button>
          
          <button :class="['mini-nav-item', { active: activeNav === 'recorded' }]" @click="navigate('recorded')" :title="$t('navigation.recorded')">
            <div class="mini-nav-icon-wrap">
              <svg class="mini-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span v-if="recordedPlaybackActive" class="mini-playback-indicator">●</span>
            </div>
            <span class="mini-nav-label">{{ $t('navigation.recorded') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { navigationStore } from '../stores/navigationStore'
import { playbackStore } from '../stores/playbackStore'
import { pinnedRecordedCourses, openPinnedCourse, removePinnedCourse } from '../composables/pinnedCourses'

const { activeNav, activePinned, navigate, isSidebarCollapsed } = navigationStore

const livePlaybackActive = computed(() => playbackStore.active.value?.mode === 'live')
const recordedPlaybackActive = computed(() => playbackStore.active.value?.mode === 'recorded')
</script>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background-color: var(--bg-page-alt);
  color: var(--text-primary);
}

.control-section {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.left-panel.collapsed .control-section {
  padding: 8px 0;
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

/* Apple Music style group label above a nav group */
.nav-group-title {
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--text-muted);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-actions-title {
  margin: 18px 0 4px;
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

/* YouTube Mini Navigation Style */
.mini-navigator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 4px;
}

.mini-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 14px 0 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  color: var(--text-secondary);
}

.mini-nav-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.mini-nav-item.active {
  color: var(--accent);
}

.mini-nav-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-nav-icon {
  opacity: 0.9;
}

.mini-nav-label {
  font-size: 10px;
  font-weight: 500;
  margin-top: 6px;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-playback-indicator {
  position: absolute;
  top: -4px;
  right: -6px;
  color: var(--success);
  font-size: 8px;
  animation: nav-pulse 2s infinite;
}
</style>
