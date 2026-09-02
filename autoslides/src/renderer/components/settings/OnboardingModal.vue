<template>
  <div class="onboarding-overlay">
    <div class="onboarding-card" :data-onboarding-kind="kind">
      <button
        v-if="isSignIn && !isLoggedIn"
        type="button"
        class="onboarding-close"
        :aria-label="$t('advanced.cancel')"
        @click="skipOnboarding"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <!-- Welcome intro -->
      <template v-if="isWelcome">
        <div class="onboarding-hero">
          <h2 class="hero-title">{{ $t(isWhatsNew ? 'onboarding.whatsNewTitle' : 'onboarding.welcomeTitle') }}</h2>
          <p class="hero-subtitle">{{ $t(isWhatsNew ? 'onboarding.whatsNewSubtitle' : 'onboarding.welcomeSubtitle') }}</p>
          <button class="btn btn--primary btn--lg hero-cta" @click="next">
            {{ $t(isWhatsNew ? 'onboarding.whatsNewCta' : 'onboarding.getStarted') }}
          </button>
          <button class="skip-link" @click="finish">{{ $t('onboarding.skip') }}</button>
        </div>
      </template>

      <!-- Configuration steps -->
      <template v-else-if="isConfig">
        <div class="onboarding-progress">
          <span
            v-for="(s, i) in configSteps"
            :key="s.id"
            class="progress-dot"
            :class="{ active: s.id === currentId, done: i < configIndex }"
          />
        </div>

        <div class="onboarding-body">
          <span class="step-label">{{ $t('onboarding.stepLabel', { current: configIndex + 1, total: configSteps.length }) }}</span>

          <!-- Output directory -->
          <template v-if="currentId === 'output'">
            <h3 class="step-title">{{ $t('onboarding.outputTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.outputDescription') }}</p>
            <div class="input-group">
              <input
                :value="outputDirectory"
                type="text"
                readonly
                class="text-input directory-input"
                :title="outputDirectory"
              />
              <button @click="selectOutputDirectory" class="btn btn--primary">{{ $t('settings.browse') }}</button>
            </div>
          </template>

          <!-- Connection mode -->
          <template v-else-if="currentId === 'connection'">
            <h3 class="step-title">{{ $t('onboarding.connectionTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.connectionDescription') }}</p>
            <div class="mode-toggle">
              <button
                @click="setConnectionMode('internal')"
                :class="['mode-btn', { active: connectionMode === 'internal' }]"
              >
                {{ $t('settings.internalNetwork') }}
              </button>
              <button
                @click="setConnectionMode('external')"
                :class="['mode-btn', { active: connectionMode === 'external' }]"
              >
                {{ $t('settings.externalNetwork') }}
              </button>
            </div>
          </template>

          <!-- Audio mode -->
          <template v-else-if="currentId === 'audio'">
            <h3 class="step-title">{{ $t('onboarding.audioTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.audioDescription') }}</p>
            <select v-model="muteMode" @change="setMuteMode" class="select-field">
              <option value="normal">{{ $t('settings.normal') }}</option>
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </template>

          <!-- GitHub Copilot AI filtering -->
          <template v-else-if="currentId === 'ai'">
            <h3 class="step-title">{{ $t(aiTitleKey) }}</h3>
            <p class="step-description">{{ $t(aiDescriptionKey) }}</p>

            <!-- Waiting for authorization -->
            <div v-if="isCopilotLoading && copilotUserCode" class="copilot-waiting">
              <button class="copilot-code" @click="copyUserCode" :title="$t('advanced.ai.copilotClickToCopy')">
                <span>{{ copilotUserCode }}</span>
                <span v-if="copilotCodeCopied" class="copilot-code-copied">{{ $t('advanced.ai.copilotCopied') }}</span>
              </button>
              <p class="copilot-hint">
                {{ $t('advanced.ai.copilotEnterCode') }}
                <a class="copilot-url" @click.prevent="openVerificationUrl" :title="copilotVerificationUri">{{ copilotVerificationUri }}</a>
              </p>
              <div class="copilot-status">
                <span class="copilot-spinner"></span>
                <span>{{ $t('advanced.ai.copilotWaitingForAuth') }}</span>
                <button class="copilot-cancel-link" @click="cancelCopilotOAuth">{{ $t('onboarding.cancel') }}</button>
              </div>
            </div>

            <template v-if="!(isCopilotLoading && copilotUserCode)">
              <button
                v-if="!isUsingGithubAi"
                class="copilot-oauth-btn"
                :disabled="isCopilotLoading"
                @click="hasGithubAccount ? useGithubForAi() : loginGithub()"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {{ $t(hasGithubAccount ? 'onboarding.aiUseGithubCta' : 'onboarding.loginGithub') }}
              </button>
              <button
                v-else
                class="btn btn--primary ai-continue-btn"
                @click="next"
              >
                {{ $t('onboarding.aiContinue') }}
              </button>
              <p v-if="copilotOAuthError" class="copilot-error-text">{{ $t('onboarding.copilotError') }}</p>
            </template>

            <button v-if="!isUsingGithubAi && !isCopilotLoading" class="skip-link ai-configure-later" @click="proceed">
              {{ $t('onboarding.configureLater') }}
            </button>
          </template>

          <!-- Sign in -->
          <template v-else-if="currentId === 'signIn'">
            <h3 class="step-title">{{ signInTitle }}</h3>
            <p class="step-description">{{ signInDescription }}</p>
            <div v-if="isLoggedIn" class="cloud-inited-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ $t('onboarding.signInReadyStatus', { name: userNickname }) }}
            </div>
            <SignInModal
              v-else
              embedded
              @browser-login="onSignInBrowserLogin"
            />
          </template>

          <!-- Cloud storage -->
          <template v-else-if="currentId === 'cloud'">
            <h3 class="step-title">{{ $t('onboarding.cloudTitle') }}</h3>
            <p class="step-description cloud-step-description">{{ $t('onboarding.cloudDescription') }}</p>

            <button
              v-if="isLoggedIn && !cloudReady"
              type="button"
              class="btn btn--primary cloud-init-btn"
              :disabled="cloudBusy"
              @click="onInitCloud"
            >
              {{ cloudBusy ? $t('cloudNotes.initializing') : $t('cloudNotes.initStorage') }}
            </button>
            <p v-if="cloudStorageStore.status.value === 'error' && cloudStorageStore.lastError.value" class="cloud-storage-error">
              {{ cloudStorageStore.lastError.value }}
            </p>

            <div v-if="cloudReady" class="cloud-inited-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ $t('advanced.cloudStorage.statusReady') }}
            </div>
            <div v-if="cloudReady" class="auto-post-processing-control">
              <select
                class="select-field sync-mode-select"
                :value="configStore.cloudAutoSyncMode ?? 'disabled'"
                @change="onAutoSyncChange"
              >
                <option value="disabled">{{ $t('onboarding.cloudSyncDisabled') }}</option>
                <option value="edited">{{ $t('advanced.cloudStorage.syncModeEdited') }}</option>
                <option value="reviewed">{{ $t('advanced.cloudStorage.syncModeReviewed') }}</option>
              </select>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="!!configStore.cloudWatchSyncEnabled"
                  @change="onWatchSyncChange"
                />
                {{ $t('onboarding.cloudWatchSync') }}
              </label>
            </div>
          </template>
        </div>

        <div v-if="!(isSignIn && !isLoggedIn)" class="onboarding-footer">
          <button class="btn" :disabled="index === 0" @click="back">{{ $t('onboarding.back') }}</button>
          <button class="btn btn--primary" @click="next">
            {{ $t('onboarding.next') }}
          </button>
        </div>
      </template>

      <template v-else-if="isDone">
        <div class="onboarding-hero allset-hero">
          <div class="allset-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 class="hero-title">{{ $t('onboarding.allSetTitle') }}</h2>
          <p class="hero-subtitle">{{ $t('onboarding.allSetDescription') }}</p>
          <button class="btn btn--primary btn--lg hero-cta" @click="finish">
            {{ $t('onboarding.allSetCta') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('OnboardingModal');
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettings } from '@features/settings/useSettings'
import { useCopilotOAuth } from '@features/ai/useCopilotOAuth'
import { useAuth } from '@features/platform/useAuth'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { configStore } from '@shared/services/configStore'
import {
  isConfigOnboardingStep,
  type OnboardingKind,
  type OnboardingStep,
} from '@common/onboarding'
import SignInModal from './SignInModal.vue'

const props = defineProps<{
  kind: OnboardingKind
  steps: OnboardingStep[]
}>()

const emit = defineEmits<{
  (e: 'finish'): void
}>()

const index = ref(0)
const currentId = computed(() => props.steps[index.value]?.id ?? '')
const { t } = useI18n()
const isWhatsNew = computed(() => props.kind === 'whats-new')
const isWelcome = computed(() => currentId.value === 'welcome')
const isSignIn = computed(() => currentId.value === 'signIn')
const isDone = computed(() => currentId.value === 'done')
const isConfig = computed(() => isConfigOnboardingStep(currentId.value))
const cloudReady = computed(() => cloudStorageStore.status.value === 'ready')
const cloudBusy = computed(() =>
  cloudStorageStore.status.value === 'checking' || cloudStorageStore.status.value === 'repairing'
)
const configSteps = computed(() => props.steps.filter(s => isConfigOnboardingStep(s.id)))
const configIndex = computed(() => configSteps.value.findIndex(s => s.id === currentId.value))

const settings = useSettings()
const {
  outputDirectory,
  connectionMode,
  muteMode,
  selectOutputDirectory,
  setConnectionMode,
  setMuteMode,
} = settings

// AI filtering step (GitHub Copilot)
const {
  copilotGhoToken,
  copilotOAuthStep,
  copilotUserCode,
  copilotVerificationUri,
  copilotOAuthError,
  isCopilotLoading,
  startCopilotOAuth,
  cancelCopilotOAuth,
  applyLoadedConfig,
} = useCopilotOAuth()

const {
  isLoggedIn,
  userId,
  userNickname,
  openBrowserLogin,
  smsChallenge,
  cancelSmsChallenge,
} = useAuth()

const signInTitle = computed(() => {
  if (smsChallenge.value) return t('auth.smsTitle')
  if (isLoggedIn.value) return t('onboarding.signInReadyTitle')
  return t('onboarding.signInTitle')
})
const signInDescription = computed(() => {
  if (smsChallenge.value?.phoneHint) return t('auth.smsSentTo', { phone: smsChallenge.value.phoneHint })
  if (smsChallenge.value) return t('auth.smsSentToBoundPhone')
  if (isLoggedIn.value) return t('onboarding.signInReadyDescription')
  return t('onboarding.signInDescription')
})

const hasGithubAccount = computed(
  () => !!(copilotGhoToken.value || configStore.aiFiltering?.copilotGhoToken)
)
const isUsingGithubAi = computed(() => {
  const ai = configStore.aiFiltering
  return ai?.serviceType === 'copilot' && ai?.classifierMode === 'llm'
})
const aiTitleKey = computed(() => {
  if (isUsingGithubAi.value) return 'onboarding.aiReadyTitle'
  if (hasGithubAccount.value) return 'onboarding.aiHasTokenTitle'
  return 'onboarding.aiTitle'
})
const aiDescriptionKey = computed(() => {
  if (isUsingGithubAi.value) return 'onboarding.aiReadyDescription'
  if (hasGithubAccount.value) return 'onboarding.aiHasTokenDescription'
  return 'onboarding.aiDescription'
})
// Only switch the live AI provider when the user opts in this session
// (new GitHub sign-in, or "Use GitHub for AI filtering"). A stored token
// plus footer Next / skip must not flip serviceType on dismiss.
const adoptedGithubThisSession = ref(false)

const copilotCodeCopied = ref(false)
const copyUserCode = async () => {
  if (!copilotUserCode.value) return
  try {
    await navigator.clipboard.writeText(copilotUserCode.value)
    copilotCodeCopied.value = true
    setTimeout(() => { copilotCodeCopied.value = false }, 2000)
  } catch {
    // Clipboard API may not be available
  }
}

const openVerificationUrl = () => {
  if (copilotVerificationUri.value) {
    window.electronAPI.shell.openExternal(copilotVerificationUri.value)
  }
}

const persistAiChoice = async () => {
  if (!adoptedGithubThisSession.value) return
  try {
    await window.electronAPI.config.setAIClassifierMode('llm')
    await window.electronAPI.config.setAIFilteringConfig({
      serviceType: 'copilot',
      copilotModelName: 'gpt-4.1',
    })
  } catch (error) {
    log.error('[onboarding] Failed to persist Copilot choice:', error)
  }
}

const loginGithub = async () => {
  await startCopilotOAuth()
  if (copilotOAuthStep.value !== 'success') return
  adoptedGithubThisSession.value = true
  await persistAiChoice()
}

const useGithubForAi = async () => {
  adoptedGithubThisSession.value = true
  await persistAiChoice()
}

onMounted(() => {
  settings.loadConfig()
  const ai = configStore.aiFiltering
  if (ai) void applyLoadedConfig(ai)
})

const next = () => {
  if (index.value < props.steps.length - 1) index.value += 1
  else void finish()
}
const back = () => {
  if (index.value > 0) index.value -= 1
}
const finish = async () => {
  await persistAiChoice()
  emit('finish')
}
const skipOnboarding = () => {
  if (smsChallenge.value) cancelSmsChallenge()
  void finish()
}
const proceed = () => next()

const onInitCloud = () => {
  cloudStorageStore.setUser(userId.value)
  void cloudStorageStore.initialize()
}

const onAutoSyncChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as 'disabled' | 'edited' | 'reviewed'
  void window.electronAPI.config.setCloudAutoSyncMode(value)
}

const onWatchSyncChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  void window.electronAPI.config.setCloudWatchSyncEnabled(checked)
}

watch(currentId, (id) => {
  if (id === 'cloud' && !isLoggedIn.value) {
    const signInIdx = props.steps.findIndex(s => s.id === 'signIn')
    if (signInIdx >= 0) index.value = signInIdx
    return
  }
  if (id !== 'cloud' || !isLoggedIn.value) return
  cloudStorageStore.setUser(userId.value)
  void cloudStorageStore.refresh()
})

const onSignInBrowserLogin = () => {
  // Overlay would cover BrowserLoginView; App.vue v-shows us off while that
  // view is active. Close without a token skips remaining onboarding; a
  // successful token returns here on the signed-in step 7 state.
  openBrowserLogin()
}
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-super-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--overlay-dark);
  backdrop-filter: blur(2px);
}

.onboarding-card {
  position: relative;
  width: 460px;
  max-width: calc(100vw - 48px);
  min-height: 360px;
  background-color: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 12px 48px var(--shadow-lg);
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
}

.onboarding-close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s;
}

.onboarding-close:hover {
  background-color: var(--bg-hover);
}

/* ── Welcome hero ─────────────────────────────────────── */
.onboarding-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
}

.hero-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.hero-subtitle {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 360px;
}

.hero-cta {
  min-width: 200px;
}

.allset-hero {
  gap: 0;
}

.allset-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  border-radius: 50%;
  background-color: var(--success-bg);
  border: 1px solid var(--success-border);
  color: var(--success);
}

/* ── Sign-in dedicated page ───────────────────────────── */
.skip-link {
  margin-top: 14px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.skip-link:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

.cloud-ready-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--text-primary);
}

.cloud-step-description {
  margin-bottom: 10px;
}

.cloud-init-btn {
  width: 100%;
}

.cloud-inited-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--success-border);
  border-radius: 6px;
  background-color: var(--success-bg);
  color: var(--success);
  font-size: 12px;
  font-weight: 600;
}

.cloud-storage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--text-muted);
}

.cloud-storage-dot.is-ready { background-color: var(--success); }
.cloud-storage-dot.is-warning { background-color: var(--warning); }
.cloud-storage-dot.is-error { background-color: var(--danger); }

.cloud-storage-error {
  margin: 0 0 10px;
  font-size: 11px;
  color: var(--danger);
}

.auto-post-processing-control .sync-mode-select {
  border: none;
  border-radius: 0;
  border-bottom: 1px solid var(--border-input);
  background-color: transparent;
  min-height: unset;
  padding: 8px 12px;
}

.auto-post-processing-control .sync-mode-select:focus {
  box-shadow: none;
}

/* ── Stepped configuration ────────────────────────────── */
.onboarding-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 22px;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--border-strong);
  transition: all 0.25s ease;
}

.progress-dot.active {
  width: 22px;
  border-radius: 4px;
  background-color: var(--accent);
}

.progress-dot.done {
  background-color: var(--accent);
}

.onboarding-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.step-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-description {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.directory-input {
  flex: 1;
  min-width: 0;
}

.mode-toggle {
  display: flex;
  gap: 8px;
}

/* ── AI filtering step (matches Settings copilot UI) ──── */
.copilot-oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: 1px solid var(--brand-github);
  background-color: var(--brand-github);
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copilot-oauth-btn:hover:not(:disabled) {
  background-color: #3b434b;
}

.copilot-oauth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copilot-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: -8px;
  text-align: center;
}

.copilot-code {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--text-primary);
  padding: 6px 16px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background-color: var(--bg-card);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.copilot-code:hover {
  border-color: var(--accent);
  background-color: var(--bg-hover);
}

.copilot-code-copied {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--success);
}

.copilot-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.copilot-url {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  word-break: break-all;
}

.copilot-url:hover {
  color: var(--accent-hover);
}

.copilot-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.copilot-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: onboarding-spin 1s linear infinite;
}

@keyframes onboarding-spin {
  to { transform: rotate(360deg); }
}

.copilot-cancel-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.copilot-cancel-link:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

.copilot-error-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger-bright);
}

.ai-configure-later {
  align-self: center;
  margin-top: 14px;
}

.ai-continue-btn {
  width: 100%;
}

.onboarding-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border-color);
}
</style>
