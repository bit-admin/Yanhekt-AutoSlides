<template>
  <div class="login-page">
    <!-- Escape hatch back to the app (the header "Sign In" routes here). -->
    <button class="login-close" type="button" @click="goHome" :aria-label="$t('webAuth.close')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>

    <div class="login-shell">
      <div class="login-card">
        <Transition name="login-fade" mode="out-in">
          <div :key="step" class="login-grid">
            <!-- Left column: brand + heading (identical frame on every step) -->
            <div class="login-head">
              <div class="login-logo">
                <svg width="46" height="34" viewBox="0 0 30 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="30" height="22" rx="5" fill="#FF0000" />
                  <polygon points="12,6 20,11 12,16" fill="white" />
                  <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </div>
              <h1 class="login-title">{{ $t('webAuth.formTitle') }}</h1>
              <p class="login-subtitle">{{ $t('webAuth.continueSubtitle') }}</p>
            </div>

            <!-- Right column -->
            <div class="login-body">
              <!-- Step 1: choose a method -->
              <div v-if="step === 'choose'" class="login-rows">
                <button type="button" class="login-row" @click="selectMode('password')">
                  <span class="login-row-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
                      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
                      <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span class="login-row-text">
                    <span class="login-row-label">{{ $t('webAuth.signInWithPassword') }}</span>
                    <span class="login-row-desc">{{ $t('webAuth.passwordOptionDesc') }}</span>
                  </span>
                  <svg class="login-row-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                <button type="button" class="login-row" @click="selectMode('token')">
                  <span class="login-row-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    </svg>
                  </span>
                  <span class="login-row-text">
                    <span class="login-row-label">{{ $t('webAuth.signInWithToken') }}</span>
                    <span class="login-row-desc">{{ $t('webAuth.tokenOptionDesc') }}</span>
                  </span>
                  <svg class="login-row-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              <!-- Step 2a: password -->
              <form v-else-if="step === 'password'" class="login-form" @submit.prevent="submitPassword">
                <div class="login-fields">
                  <input
                    v-model="username"
                    type="text"
                    class="login-input"
                    :placeholder="$t('webAuth.usernamePlaceholder')"
                    autocomplete="username"
                    autofocus
                  />
                  <input
                    v-model="password"
                    type="password"
                    class="login-input"
                    :placeholder="$t('webAuth.passwordPlaceholder')"
                    autocomplete="current-password"
                  />
                  <p class="login-note">{{ $t('webAuth.passwordDisclaimer') }}</p>
                  <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
                </div>
                <div class="login-actions">
                  <button type="button" class="login-link-btn" @click="backToChoose">{{ $t('webAuth.back') }}</button>
                  <button
                    type="submit"
                    class="login-next"
                    :disabled="isSubmitting || !username.trim() || !password"
                  >
                    {{ isSubmitting ? $t('webAuth.signingIn') : $t('webAuth.signIn') }}
                  </button>
                </div>
              </form>

              <!-- Step 2b: token — the draggable, SVG-drawn bookmarklet button -->
              <div v-else-if="step === 'token-get'" class="login-form">
                <div class="login-fields login-fields--center">
                  <div class="bm-stage">
                    <!-- Backdrop: bookmarks bar with a dashed drop-slot, and the arrow -->
                    <svg class="bm-art" viewBox="0 0 360 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <rect class="bm-bar" x="18" y="2" width="324" height="22" rx="7" />
                      <rect class="bm-mark" x="32" y="9" width="30" height="8" rx="4" />
                      <rect class="bm-mark" x="70" y="9" width="22" height="8" rx="4" />
                      <rect class="bm-mark" x="100" y="9" width="22" height="8" rx="4" />
                      <rect class="bm-slot" x="150" y="6" width="44" height="14" rx="4" />

                      <path class="bm-arrow" d="M176 62 C 168 46 168 40 172 30" fill="none" />
                      <path class="bm-arrow" d="M166 36 L 172 28 L 178 36" fill="none" />
                    </svg>

                    <!-- Only the button is the drag source -->
                    <a
                      class="bm-link"
                      :href="bookmarkletHref"
                      @click.prevent
                      draggable="true"
                      :title="$t('webAuth.bookmarkletLabel')"
                    >
                      <svg class="bm-btn-art" viewBox="0 0 264 54" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="$t('webAuth.bookmarkletLabel')">
                        <defs>
                          <filter id="bmShadow" x="-25%" y="-25%" width="150%" height="170%">
                            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.18" />
                          </filter>
                        </defs>
                        <g filter="url(#bmShadow)">
                          <rect class="bm-btn" x="0" y="0" width="264" height="54" rx="15" />
                        </g>
                        <path class="bm-glyph" d="M44 14 a2 2 0 0 1 2 -2 h13 a2 2 0 0 1 2 2 v23 l-8.5 -6.5 -8.5 6.5 z" />
                        <text class="bm-label" x="148" y="33" text-anchor="middle">{{ $t('webAuth.bookmarkletLabel') }}</text>
                      </svg>
                    </a>

                    <!-- Little grab cursor to signal dragging, drawn over the button -->
                    <svg class="bm-cursor-art" viewBox="0 0 360 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path class="bm-cursor" d="M296 100 l 0 26 l 6.5 -6.5 l 4.5 10 l 5 -2 l -4.5 -10 l 9 -0.5 z" />
                    </svg>
                  </div>
                  <div class="login-note-group">
                    <p class="login-note login-note--center">{{ $t('webAuth.tokenHint') }}</p>
                    <p class="login-note login-note--faint">
                      {{ $t('webAuth.bookmarksBarHint', { key: bookmarksBarShortcut }) }}
                    </p>
                  </div>
                </div>
                <div class="login-actions">
                  <button type="button" class="login-link-btn" @click="backToChoose">{{ $t('webAuth.back') }}</button>
                  <button type="button" class="login-next" @click="goStep('token-paste')">
                    {{ $t('webAuth.tokenContinue') }}
                  </button>
                </div>
              </div>

              <!-- Step 2c: token — paste it -->
              <form v-else class="login-form" @submit.prevent="submitToken">
                <div class="login-fields">
                  <input
                    v-model="tokenInput"
                    type="text"
                    class="login-input"
                    :placeholder="$t('webAuth.tokenPlaceholder')"
                    autocomplete="off"
                    spellcheck="false"
                    autofocus
                  />
                  <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
                </div>
                <div class="login-actions">
                  <button type="button" class="login-link-btn" @click="goStep('token-get')">{{ $t('webAuth.back') }}</button>
                  <button
                    type="submit"
                    class="login-next"
                    :disabled="isSubmitting || !tokenInput.trim()"
                  >
                    {{ isSubmitting ? $t('webAuth.signingIn') : $t('webAuth.tokenConfirm') }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>

        <div v-if="isVerifyingToken" class="login-verifying">
          <div class="login-spinner"></div>
        </div>
      </div>

      <!-- Footer outside the card, page-level (mirrors Google's) -->
      <footer class="login-footer">
        <div ref="langRef" class="login-lang-wrap">
          <button
            type="button"
            class="login-lang"
            :aria-expanded="langOpen"
            @click="langOpen = !langOpen"
          >
            <span>{{ languageLabel }}</span>
            <svg class="login-lang-caret" :class="{ open: langOpen }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div v-if="langOpen" class="login-lang-menu">
            <button
              v-for="opt in languageOptions"
              :key="opt.value"
              type="button"
              class="login-lang-item"
              :class="{ active: opt.value === currentLang }"
              @click="chooseLanguage(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <nav class="login-legal">
          <RouterLink class="login-legal-link" :to="{ name: 'privacy' }">{{ $t('legal.privacy') }}</RouterLink>
          <RouterLink class="login-legal-link" :to="{ name: 'terms' }">{{ $t('legal.terms') }}</RouterLink>
        </nav>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/authStore'
import { generateBookmarklet } from '../lib/bookmarklet'
import { setLanguageMode } from '../stores/settingsStore'
import { getCurrentLocale } from '../i18n'

const { t, locale } = useI18n()
const router = useRouter()
const { isLoggedIn, isVerifyingToken } = authStore

type Step = 'choose' | 'password' | 'token-get' | 'token-paste'
const step = ref<Step>('choose')
const username = ref('')
const password = ref('')
const tokenInput = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const bookmarkletHref = computed(() =>
  generateBookmarklet(locale.value.startsWith('zh') ? 'zh' : 'en'),
)

// The bookmarks bar can't be detected from a page, so the hint always shows —
// only the shortcut adapts. It is ⌘⇧B / Ctrl+Shift+B across every major browser.
const bookmarksBarShortcut = (() => {
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ''
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘⇧B' : 'Ctrl+Shift+B'
})()

const currentLang = computed(() => getCurrentLocale())
const languageOptions = [
  { value: 'en' as const, label: 'English (United States)' },
  { value: 'zh' as const, label: '中文（简体）' },
]
const languageLabel = computed(
  () => languageOptions.find((o) => o.value === currentLang.value)?.label ?? 'English (United States)',
)

const langOpen = ref(false)
const langRef = ref<HTMLElement | null>(null)

const chooseLanguage = (value: 'en' | 'zh') => {
  setLanguageMode(value)
  langOpen.value = false
}

const onDocClick = (e: MouseEvent) => {
  if (langOpen.value && langRef.value && !langRef.value.contains(e.target as Node)) {
    langOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

const goHome = () => {
  void router.push({ name: 'home' })
}

const goStep = (s: Step) => {
  errorMessage.value = ''
  step.value = s
}

const selectMode = (mode: 'password' | 'token') => {
  goStep(mode === 'token' ? 'token-get' : 'password')
}

const backToChoose = () => goStep('choose')

const submitPassword = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const result = await authStore.loginWithPassword(username.value.trim(), password.value)
    if (result.success) {
      goHome()
    } else {
      errorMessage.value = result.error || t('webAuth.invalidToken')
    }
  } finally {
    isSubmitting.value = false
  }
}

const submitToken = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const result = await authStore.adoptToken(tokenInput.value.trim())
    if (result.success) {
      goHome()
    } else {
      errorMessage.value = result.error || t('webAuth.invalidToken')
    }
  } finally {
    isSubmitting.value = false
  }
}

// Arriving already signed in, or a bookmarklet redirect resolving here.
watch(
  isLoggedIn,
  (loggedIn) => {
    if (loggedIn) goHome()
  },
  { immediate: true },
)
</script>

<style scoped>
/* ===== Page ===== */
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background-color: var(--bg-page);
}

.login-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s;
}

.login-close:hover {
  background-color: var(--bg-hover);
}

/* ===== Card + footer wrapper (footer sits below the card) ===== */
.login-shell {
  width: 100%;
  max-width: 58rem;
}

.login-card {
  position: relative;
  border-radius: 1.75rem;
  background-color: var(--bg-surface);
  box-shadow: 0 1px 2px var(--shadow-sm), 0 12px 40px var(--shadow-sm);
  overflow: hidden;
}

html[data-theme='dark'] .login-card {
  background-color: var(--bg-elevated);
  box-shadow: none;
}

.login-fade-enter-active,
.login-fade-leave-active {
  transition: opacity 0.15s ease;
}

.login-fade-enter-from,
.login-fade-leave-to {
  opacity: 0;
}

/* ===== Two-column grid ===== */
.login-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  min-height: 24rem;
  padding: 3.5rem 4rem;
}

/* Left column */
.login-head {
  display: flex;
  flex-direction: column;
}

.login-logo {
  margin-bottom: 1.75rem;
}

.login-title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.login-subtitle {
  margin: 1rem 0 0;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--text-primary);
}

/* Right column */
.login-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ---- Method rows ---- */
.login-rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.login-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  padding: 1.25rem 0.5rem;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.login-row:hover {
  background-color: var(--bg-hover);
}

.login-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.login-row-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.login-row-label {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
}

.login-row-desc {
  margin-top: 0.1875rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.login-row-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0;
  transform: translateX(-0.25rem);
  transition: opacity 0.15s, transform 0.15s;
}

.login-row:hover .login-row-chevron {
  opacity: 1;
  transform: translateX(0);
}

/* ---- Forms ---- */
.login-form {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.login-fields {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 1.25rem;
}

.login-fields--center {
  align-items: center;
  text-align: center;
  gap: 1.75rem;
}

.login-input {
  width: 100%;
  box-sizing: border-box;
  height: 3.5rem;
  padding: 0 1rem;
  border: 1px solid var(--border-input);
  border-radius: 0.5rem;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

html[data-theme='dark'] .login-input {
  background-color: transparent;
}

.login-input::placeholder {
  color: var(--text-muted);
}

.login-input:focus {
  border-color: var(--accent-deep);
  box-shadow: 0 0 0 1px var(--accent-deep);
  outline: none;
}

.login-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.login-note--lead {
  color: var(--text-secondary);
}

.login-note-group {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.375rem;
}

/* Always-on nudge: a page can't tell whether the bookmarks bar is showing. */
.login-note--faint {
  width: 100%;
  text-align: left;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-muted);
  opacity: 0.7;
}

.login-note--center {
  width: 100%;
  text-align: left;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.login-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--danger);
  font-weight: 500;
}

.login-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 0.95rem;
}

.login-link-btn {
  padding: 0.5rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--accent-deep);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: background-color 0.15s;
}

.login-link-btn:hover {
  background-color: var(--badge-active-bg);
}

.login-next {
  height: 2.5rem;
  padding: 0 1.75rem;
  border: none;
  border-radius: 6.25rem;
  background-color: var(--accent-deep);
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, box-shadow 0.15s;
}

.login-next:hover:not(:disabled) {
  background-color: var(--accent-deep-hover);
  box-shadow: 0 1px 3px var(--shadow-md);
}

.login-next:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- SVG-drawn bookmarklet art; only .bm-link (the button) is draggable ---- */
.bm-stage {
  position: relative;
  width: 100%;
  max-width: 21rem;
}

.bm-art {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* Button box, as a fraction of the 360x132 backdrop viewBox: x=48 y=66 w=264 h=54 */
.bm-link {
  position: absolute;
  left: 13.3333%;
  top: 50%;
  width: 73.3333%;
  height: 40.9091%;
  cursor: grab;
  text-decoration: none;
  transition: transform 0.14s ease;
}

.bm-link:hover {
  transform: translateY(-2px);
}

.bm-link:active {
  cursor: grabbing;
}

.bm-btn-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.bm-cursor-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.bm-bar {
  fill: var(--bg-hover);
}

.bm-mark {
  fill: var(--border-strong);
}

.bm-slot {
  fill: none;
  stroke: var(--accent-deep);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}

.bm-arrow {
  stroke: var(--accent-deep);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 4 5;
}

.bm-btn {
  fill: var(--accent-deep);
}

.bm-link:hover .bm-btn {
  fill: var(--accent-deep-hover);
}

.bm-glyph {
  fill: #ffffff;
}

.bm-label {
  fill: #ffffff;
  font-family: inherit;
  font-size: 17px;
  font-weight: 700;
}

.bm-cursor {
  fill: var(--text-primary);
  stroke: var(--bg-surface);
  stroke-width: 1.75;
  stroke-linejoin: round;
}

html[data-theme='dark'] .bm-cursor {
  stroke: var(--bg-elevated);
}

/* ---- Verifying overlay ---- */
.login-verifying {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-surface);
  opacity: 0.85;
}

html[data-theme='dark'] .login-verifying {
  background-color: var(--bg-elevated);
}

.login-spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-deep);
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== Footer ===== */
.login-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 0.5rem 0;
}

.login-lang-wrap {
  position: relative;
}

.login-lang {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.login-lang:hover {
  background-color: var(--bg-hover);
}

.login-lang-caret {
  transition: transform 0.15s ease;
}

.login-lang-caret.open {
  transform: rotate(180deg);
}

.login-lang-menu {
  position: absolute;
  bottom: calc(100% + 0.375rem);
  left: 0;
  width: max-content;
  min-width: 100%;
  padding: 0.375rem 0;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-surface);
  box-shadow: 0 6px 24px var(--shadow-lg);
  z-index: var(--z-dropdown);
}

html[data-theme='dark'] .login-lang-menu {
  background-color: var(--bg-elevated);
}

.login-lang-item {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.login-lang-item:hover {
  background-color: var(--bg-hover);
}

.login-lang-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent-deep);
}

.login-legal {
  display: flex;
  align-items: center;
  gap: 1.75rem;
}

.login-legal-link {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
}

.login-legal-link:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

/* ===== Responsive ===== */
@media (max-width: 720px) {
  .login-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
    min-height: 0;
    padding: 2.5rem 2rem;
  }

  .login-title {
    font-size: 2rem;
  }

  .login-footer {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}
</style>
