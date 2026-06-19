<template>
  <!-- Final sign-in page: the shared SignInModal (same component the left-panel
       "Sign in with SSO Account" button opens), so the two are identical. -->
  <SignInModal
    v-if="step === signInStep && !isLoggedIn"
    :show-close="false"
    :skip-label="$t('onboarding.skip')"
    @skip="finish"
    @success="onSignInSuccess"
    @browser-login="onSignInBrowserLogin"
  />

  <div v-else class="onboarding-overlay">
    <div class="onboarding-card">
      <!-- Welcome intro -->
      <template v-if="step === 0">
        <div class="onboarding-hero">
          <h2 class="hero-title">{{ $t('onboarding.welcomeTitle') }}</h2>
          <p class="hero-subtitle">{{ $t('onboarding.welcomeSubtitle') }}</p>
          <button class="btn btn--primary btn--lg hero-cta" @click="next">
            {{ $t('onboarding.getStarted') }}
          </button>
          <button class="skip-link" @click="finish">{{ $t('onboarding.skip') }}</button>
        </div>
      </template>

      <!-- Configuration steps -->
      <template v-else-if="step <= configSteps">
        <div class="onboarding-progress">
          <span
            v-for="n in configSteps"
            :key="n"
            class="progress-dot"
            :class="{ active: n === step, done: n < step }"
          />
        </div>

        <div class="onboarding-body">
          <span class="step-label">{{ $t('onboarding.stepLabel', { current: step, total: configSteps }) }}</span>

          <!-- 1. Output directory -->
          <template v-if="step === 1">
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

          <!-- 2. Connection mode -->
          <template v-else-if="step === 2">
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

          <!-- 3. Audio mode -->
          <template v-else-if="step === 3">
            <h3 class="step-title">{{ $t('onboarding.audioTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.audioDescription') }}</p>
            <select v-model="muteMode" @change="setMuteMode" class="select-field">
              <option value="normal">{{ $t('settings.normal') }}</option>
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </template>

          <!-- 4. Task speed -->
          <template v-else-if="step === 4">
            <h3 class="step-title">{{ $t('onboarding.taskSpeedTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.taskSpeedDescription') }}</p>
            <select v-model="taskSpeed" @change="setTaskSpeed" class="select-field">
              <option v-for="n in 16" :key="n" :value="n">{{ n }}x</option>
            </select>
          </template>

          <!-- 5. Parallel tasks -->
          <template v-else-if="step === 5">
            <h3 class="step-title">{{ $t('onboarding.parallelTasksTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.parallelTasksDescription') }}</p>
            <select v-model.number="parallelTasks" @change="setParallelTasks" class="select-field">
              <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
            </select>
          </template>

          <!-- 6. GitHub Copilot AI filtering -->
          <template v-else-if="step === 6">
            <h3 class="step-title">{{ $t('onboarding.aiTitle') }}</h3>
            <p class="step-description">{{ $t('onboarding.aiDescription') }}</p>

            <!-- Connected -->
            <div v-if="copilotConnected" class="copilot-user-row">
              <img v-if="copilotAvatarUrl" :src="copilotAvatarUrl" class="copilot-avatar" alt="" />
              <span class="copilot-username">{{ copilotUsername }}</span>
            </div>

            <!-- Waiting for authorization -->
            <div v-else-if="isCopilotLoading && copilotUserCode" class="copilot-waiting">
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

            <!-- Idle -->
            <template v-else>
              <button class="copilot-oauth-btn" :disabled="isCopilotLoading" @click="loginGithub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {{ $t('onboarding.loginGithub') }}
              </button>
              <p v-if="copilotOAuthError" class="copilot-error-text">{{ $t('onboarding.copilotError') }}</p>
            </template>

            <button v-if="!copilotConnected && !isCopilotLoading" class="skip-link ai-configure-later" @click="proceed">
              {{ $t('onboarding.configureLater') }}
            </button>
          </template>
        </div>

        <div class="onboarding-footer">
          <button class="btn" @click="back">{{ $t('onboarding.back') }}</button>
          <button class="btn btn--primary" @click="next">
            {{ $t('onboarding.next') }}
          </button>
        </div>
      </template>

      <!-- Final step, already signed in (rare — e.g. a persisted token).
           The not-signed-in path is the SignInModal rendered above. -->
      <template v-else>
        <div class="onboarding-hero">
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
import { computed, onMounted, ref } from 'vue'
import { useSettings } from '@features/settings/useSettings'
import { useCopilotOAuth } from '@features/ai/useCopilotOAuth'
import { useAuth } from '@features/platform/useAuth'
import SignInModal from './SignInModal.vue'

const emit = defineEmits<{
  (e: 'finish'): void
}>()

// Dotted configuration steps (1..configSteps). The SSO sign-in is a dedicated
// terminal page that always comes last — even if more config steps are added.
const configSteps = 6
const signInStep = configSteps + 1
const step = ref(0)

const settings = useSettings()
const {
  outputDirectory,
  connectionMode,
  muteMode,
  taskSpeed,
  parallelTasks,
  selectOutputDirectory,
  setConnectionMode,
  setMuteMode,
  setTaskSpeed,
  setParallelTasks,
} = settings

// AI filtering step (GitHub Copilot)
const {
  copilotGhoToken,
  copilotUsername,
  copilotAvatarUrl,
  copilotOAuthStep,
  copilotUserCode,
  copilotVerificationUri,
  copilotOAuthError,
  isCopilotLoading,
  startCopilotOAuth,
  cancelCopilotOAuth,
} = useCopilotOAuth()

// Sign-in step (final, dedicated page)
const { isLoggedIn, openBrowserLogin } = useAuth()

const copilotConnected = computed(
  () => copilotOAuthStep.value === 'success' && !!copilotGhoToken.value
)

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

const loginGithub = async () => {
  await startCopilotOAuth()
}

// If the user signed in with Copilot, switch the AI filtering service to it.
// Otherwise leave the existing defaults untouched ("configure later").
const persistAiChoice = async () => {
  if (!copilotConnected.value) return
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

onMounted(() => {
  settings.loadConfig()
})

const next = () => {
  if (step.value < signInStep) step.value += 1
}
const back = () => {
  if (step.value > 0) step.value -= 1
}
const finish = async () => {
  await persistAiChoice()
  emit('finish')
}
// Forward action for the AI "configure later" link: advance to the next step
// (the sign-in page), or finish if this somehow is the last one.
const proceed = () => {
  if (step.value < signInStep) next()
  else finish()
}

// Sign-in page handlers.
const onSignInSuccess = () => {
  finish()
}
const onSignInBrowserLogin = async () => {
  // Browser login takes over the main window, which sits behind this overlay —
  // so close onboarding first, then open it.
  await finish()
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
  width: 460px;
  max-width: calc(100vw - 48px);
  min-height: 344px;
  background-color: var(--bg-modal);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 12px 48px var(--shadow-lg);
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
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

.copilot-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 6px;
}

.copilot-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
}

.copilot-username {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
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

.onboarding-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border-color);
}
</style>
