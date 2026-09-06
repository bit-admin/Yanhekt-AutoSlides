<template>
  <!-- Mobile-only overflow menu behind the bottom bar's "More" tab. The
       desktop LeftPanel is hidden under 768px, so everything that only lived
       there (Slides / Notes / Settings, sister sites, Feedback, legal) is
       reachable from here. -->
  <div class="mms-root">
    <div class="mms-backdrop" @click="$emit('close')"></div>

    <div class="mms-sheet" role="dialog" aria-modal="true" :aria-label="$t('navigation.moreLinks')">
      <div class="mms-grabber" @click="$emit('close')"></div>

      <div class="mms-scroll custom-scrollbar">
        <!-- Workspace destinations moved off the bottom bar -->
        <nav class="mms-group">
          <button
            v-for="item in WORKSPACE_ITEMS"
            :key="item.nav"
            type="button"
            :class="['mms-item', { active: activeNav === item.nav }]"
            @click="go(item.nav)"
          >
            <svg class="mms-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <template v-if="item.nav === 'slides'">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </template>
              <template v-else-if="item.nav === 'notes'">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </template>
              <template v-else>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </template>
            </svg>
            <span>{{ $t(item.labelKey) }}</span>
          </button>
        </nav>

        <div class="mms-divider"></div>

        <!-- Subscribed courses: the desktop rail's list, condensed -->
        <button
          type="button"
          :class="['mms-item', 'mms-item--header', { active: activeNav === 'subscriptions' }]"
          @click="go('subscriptions')"
        >
          <span>{{ $t('navigation.subscriptions') }}</span>
          <svg class="mms-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div v-if="subscribedRecordedCourses.length > 0" class="mms-group">
          <button
            v-for="c in subscribedRecordedCourses"
            :key="c.id"
            type="button"
            class="mms-item mms-item--sub"
            @click="openCourse(c)"
          >
            <span class="mms-avatar" :style="{ backgroundColor: getAvatarBg(c.title) }">{{ getInitials(c.title) }}</span>
            <span class="mms-sub-label">{{ c.title }}</span>
          </button>
        </div>

        <div class="mms-divider"></div>

        <!-- External destinations + Feedback (LeftPanel parity) -->
        <nav class="mms-group">
          <button type="button" class="mms-item" @click="openYanhekt">
            <svg class="mms-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>{{ $t('navigation.openYanhekt') }}</span>
            <svg class="mms-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>
          <button type="button" class="mms-item" @click="openApps">
            <svg class="mms-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8"/><path d="M12 17v4"/><path d="m9 8 3 2.5L9 13"/>
            </svg>
            <span>{{ $t('navigation.desktopApp') }}</span>
            <svg class="mms-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>
          <button type="button" class="mms-item" @click="openGitHub">
            <svg class="mms-icon" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span>{{ $t('navigation.openGitHub') }}</span>
            <svg class="mms-external" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>
          <button type="button" class="mms-item" @click="showFeedback = true">
            <svg class="mms-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
            </svg>
            <span>{{ $t('navigation.feedback') }}</span>
          </button>
        </nav>

        <div class="mms-divider"></div>

        <nav class="mms-links" :aria-label="$t('navigation.moreLinks')">
          <a
            v-for="link in FOOTER_LINKS"
            :key="link.href"
            class="mms-link"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t(link.labelKey) }}</a>
        </nav>

        <nav class="mms-links" :aria-label="$t('navigation.legal')">
          <RouterLink class="mms-link" :to="{ name: 'terms' }" @click="$emit('close')">{{ $t('legal.terms') }}</RouterLink>
          <RouterLink class="mms-link" :to="{ name: 'privacy' }" @click="$emit('close')">{{ $t('legal.privacy') }}</RouterLink>
          <RouterLink class="mms-link" :to="{ name: 'copyright' }" @click="$emit('close')">{{ $t('legal.copyright') }}</RouterLink>
          <RouterLink class="mms-link" :to="{ name: 'disclosure' }" @click="$emit('close')">{{ $t('legal.disclosure') }}</RouterLink>
        </nav>

        <p class="mms-notice">{{ $t('legal.notice') }}</p>
        <p class="mms-copyright">© {{ COPYRIGHT_YEAR }} {{ COPYRIGHT_HOLDER }}</p>
      </div>
    </div>

    <FeedbackModal v-if="showFeedback" @close="showFeedback = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import FeedbackModal from './FeedbackModal.vue'
import { COPYRIGHT_HOLDER, COPYRIGHT_YEAR } from '../legal/meta'
import { navigationStore, type NavTarget } from '../stores/navigationStore'
import { authStore } from '../stores/authStore'
import { subscribedRecordedCourses, openSubscribedCourse } from '../composables/subscribedCourses'
import { getAvatarBg, getInitials } from '../composables/courseCover'
import type { SubscribedCourse } from '../stores/configStore'

const emit = defineEmits<{ close: [] }>()

const { activeNav, navigate } = navigationStore
const router = useRouter()
const showFeedback = ref(false)

/** The three destinations the bottom bar hands off to this sheet. */
const WORKSPACE_ITEMS: { nav: NavTarget; labelKey: string }[] = [
  { nav: 'slides', labelKey: 'navigation.slidesReview' },
  { nav: 'notes', labelKey: 'navigation.notes' },
  { nav: 'settings', labelKey: 'settings.settings' },
]

const FOOTER_LINKS = computed(() => [
  { href: 'https://it.ruc.edu.kg', labelKey: 'footerLinks.itCentre' },
  { href: 'https://relay.ruc.edu.kg', labelKey: 'footerLinks.publicRelay' },
  { href: 'https://share.ruc.edu.kg', labelKey: 'footerLinks.publicIndex' },
  { href: 'https://notes.ruc.edu.kg', labelKey: 'footerLinks.notes' },
  { href: router.resolve({ name: 'image-comparison' }).href, labelKey: 'lab.imageComparison' },
  { href: 'https://copilot.ruc.edu.kg', labelKey: 'footerLinks.copilot' },
  { href: 'https://coss.ruc.edu.kg', labelKey: 'footerLinks.coss' },
  { href: 'https://cv.ruc.edu.kg', labelKey: 'footerLinks.cvForge' },
  { href: 'https://s.ruc.edu.kg', labelKey: 'footerLinks.shortLink' },
])

const go = (nav: NavTarget) => {
  navigate(nav)
  emit('close')
}

const openCourse = (c: SubscribedCourse) => {
  openSubscribedCourse(c)
  emit('close')
}

const openApps = () => {
  window.open(router.resolve({ name: 'apps' }).href, '_blank', 'noopener,noreferrer')
  emit('close')
}

/** Same token hand-off as the desktop rail so Yanhekt opens signed in. */
const openYanhekt = () => {
  const token = authStore.isLoggedIn.value ? authStore.token.value : null
  const expiredAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const url = token
    ? `https://www.yanhekt.cn/login?token=${encodeURIComponent(token)}&type=Bearer&expired_at=${expiredAt}`
    : 'https://www.yanhekt.cn'
  window.open(url, '_blank', 'noopener,noreferrer')
  emit('close')
}

const openGitHub = () => {
  window.open('https://github.com/bit-admin/Yanhekt-AutoSlides', '_blank', 'noopener,noreferrer')
  emit('close')
}

// Escape closes the sheet — but not while the Feedback dialog it can open is
// on top, which owns its own dismissal.
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !showFeedback.value) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.mms-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  /* Above the bottom bar (--z-overlay), below real modals (--z-modal) so the
     Feedback dialog opened from here still lands on top. */
  z-index: calc(var(--z-overlay) + 1);
}

.mms-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-overlay) + 2);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  max-height: 80dvh;
  background-color: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -8px 32px var(--shadow-lg);
  animation: mms-rise 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes mms-rise {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .mms-sheet { animation: none; }
}

.mms-grabber {
  flex-shrink: 0;
  width: 2.25rem;
  height: 0.25rem;
  margin: 0.625rem auto 0.25rem;
  border-radius: 6.25rem;
  background-color: var(--border-strong);
  cursor: pointer;
}

.mms-scroll {
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  /* The sheet rises over the bottom bar, so only the home indicator to clear. */
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling: touch;
}

.mms-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mms-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.625rem;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
}

.mms-item:hover,
.mms-item:active {
  background-color: var(--bg-hover);
}

.mms-item.active {
  background-color: var(--bg-hover);
  font-weight: 500;
}

.mms-item.active .mms-icon {
  color: var(--accent-deep);
}

.mms-item--header {
  font-size: 1rem;
  font-weight: 500;
  justify-content: space-between;
  gap: 0.25rem;
}

.mms-icon,
.mms-chevron {
  flex-shrink: 0;
  color: var(--text-primary);
}

.mms-external {
  flex: none;
  margin-left: auto;
  color: var(--text-muted);
  opacity: 0.45;
}

.mms-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mms-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.mms-sub-label {
  flex: 1;
}

.mms-divider {
  height: 1px;
  margin: 0.5rem 0.5rem;
  background-color: var(--border-color);
}

.mms-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  padding: 0.25rem 0.75rem;
}

.mms-link {
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-decoration: none;
}

.mms-notice {
  margin: 0.75rem 0 0;
  padding: 0 0.75rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.mms-copyright {
  margin: 0.625rem 0 0;
  padding: 0 0.75rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}
</style>
