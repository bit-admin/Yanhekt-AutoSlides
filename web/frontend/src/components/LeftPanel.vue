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

          <div class="nav-divider" v-if="subscribedRecordedCourses.length > 0"></div>

          <div class="nav-items">
            <button class="nav-item" @click="openYanhekt">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{{ $t('navigation.openYanhekt') }}</span>
              <svg class="nav-item-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h6v6"/>
                <path d="M10 14L21 3"/>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              </svg>
            </button>
            <button class="nav-item" @click="openApps">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8"/>
                <path d="M12 17v4"/>
                <path d="m9 8 3 2.5L9 13"/>
              </svg>
              <span>{{ $t('navigation.desktopApp') }}</span>
              <svg class="nav-item-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h6v6"/>
                <path d="M10 14L21 3"/>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              </svg>
            </button>
            <button class="nav-item" @click="openGitHub">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>{{ $t('navigation.openGitHub') }}</span>
              <svg class="nav-item-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h6v6"/>
                <path d="M10 14L21 3"/>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              </svg>
            </button>
          </div>

          <div class="nav-divider"></div>

          <div class="nav-items">
            <!-- No external arrow: this one opens a modal, it doesn't leave. -->
            <button class="nav-item" @click="showFeedback = true">
              <svg class="nav-item-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
              </svg>
              <span>{{ $t('navigation.feedback') }}</span>
            </button>
          </div>

          <div class="nav-divider"></div>

          <!-- Legal: quiet links plus the standing disclaimer, YouTube-footer style. -->
          <nav class="legal-links" :aria-label="$t('navigation.legal')">
            <RouterLink class="legal-link" :to="{ name: 'terms' }">{{ $t('legal.terms') }}</RouterLink>
            <RouterLink class="legal-link" :to="{ name: 'privacy' }">{{ $t('legal.privacy') }}</RouterLink>
          </nav>
          <p class="legal-notice">{{ $t('legal.notice') }}</p>
          <p class="legal-copyright">© {{ COPYRIGHT_YEAR }} {{ COPYRIGHT_HOLDER }}</p>
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

    <FeedbackModal v-if="showFeedback" @close="showFeedback = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeedbackModal from './FeedbackModal.vue'
import { COPYRIGHT_HOLDER, COPYRIGHT_YEAR } from '../legal/meta'
import { navigationStore } from '../stores/navigationStore'
import { authStore } from '../stores/authStore'
import { subscribedRecordedCourses, openSubscribedCourse, removeSubscribedCourse } from '../composables/subscribedCourses'
import { getAvatarBg, getInitials } from '../composables/courseCover'

const { activeNav, activeSubscribed, navigate, isSidebarCollapsed } = navigationStore

const showFeedback = ref(false)

const route = useRoute()
const router = useRouter()
const livePlaybackActive = computed(() => route.name === 'player-live')
const recordedPlaybackActive = computed(() => route.name === 'player-recorded')

/** In-app route, but opened as its own tab so playback here keeps running. */
const openApps = () => {
  window.open(router.resolve({ name: 'apps' }).href, '_blank', 'noopener,noreferrer')
}

/** Hand our token to yanhekt.cn's own login page so the site opens signed in. */
const openYanhekt = () => {
  const token = authStore.isLoggedIn.value ? authStore.token.value : null
  // Expiry timestamp 7 days from now (Unix seconds, matching Yanhekt's expired_at)
  const expiredAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const url = token
    ? `https://www.yanhekt.cn/login?token=${encodeURIComponent(token)}&type=Bearer&expired_at=${expiredAt}`
    : 'https://www.yanhekt.cn'
  window.open(url, '_blank', 'noopener,noreferrer')
}

const openGitHub = () => {
  window.open('https://github.com/bit-admin/Yanhekt-AutoSlides', '_blank', 'noopener,noreferrer')
}
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
  align-self: stretch;
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

.nav-item-external {
  flex: none;
  color: var(--text-muted);
  opacity: 0.45;
}

/* Legal block: deliberately the quietest thing in the panel. */
.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  padding: 0 0.75rem;
  margin: 0 0.375rem;
}

.legal-link {
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-decoration: none;
}

.legal-link:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.legal-notice {
  margin: 0.75rem 0.375rem 0;
  padding: 0 0.75rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.legal-copyright {
  margin: 0.625rem 0.375rem 0.5rem;
  padding: 0 0.75rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
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
