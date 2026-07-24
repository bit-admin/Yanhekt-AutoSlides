<template>
  <!-- While an SMS code is pending, a stray overlay click must not throw the
       half-finished flow away; the × (which cancels it properly) still does. -->
  <div class="signin-overlay" @click="onOverlayClick">
    <div class="signin-card" @click.stop>
      <button
        v-if="showClose"
        type="button"
        class="signin-close"
        :aria-label="$t('advanced.cancel')"
        @click="requestClose()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- Onboarding skip lives in the top-right corner (the slot a normal login
           modal uses for its "×") — mutually exclusive with showClose. -->
      <button
        v-if="skipLabel"
        type="button"
        class="signin-skip-top"
        @click="$emit('skip')"
      >
        {{ skipLabel }}
      </button>

      <div class="signin-body">
        <h2 class="signin-title">
          {{ smsChallenge ? $t('auth.smsTitle') : $t('onboarding.signInTitle') }}
        </h2>
        <p class="signin-description">
          {{ smsChallenge ? smsPrompt : $t('onboarding.signInDescription') }}
        </p>

        <!-- CAS asked for a texted code. Same card, different body — so the
             left-panel and onboarding hosts both get this step for free. -->
        <SmsCodePanel
          v-if="smsChallenge"
          :code="smsCode"
          :error="smsError"
          :is-submitting="isSubmittingSmsCode"
          @update:code="smsCode = $event"
          @submit="submitSmsCode"
          @cancel="cancelSmsChallenge"
        />

        <div v-else class="sso-form">
          <div class="field-group">
            <input
              v-model="username"
              type="text"
              :placeholder="$t('auth.username')"
              class="input-field"
              @keyup.enter="login"
            />
            <input
              v-model="password"
              type="password"
              :placeholder="$t('auth.password')"
              class="input-field"
              @keyup.enter="login"
            />
          </div>
          <button @click="login" :disabled="isLoading" class="btn btn--primary signin-submit">
            {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
          </button>
          <button type="button" class="browser-alt-link" @click="$emit('browser-login')">
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>

        <!-- Onboarding-injected content (e.g. the cloud-storage setup checkbox). -->
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@features/platform/useAuth'
import SmsCodePanel from './SmsCodePanel.vue'

const props = withDefaults(
  defineProps<{
    onLoginSuccess?: () => void
    showClose?: boolean
    skipLabel?: string
  }>(),
  { showClose: true }
)

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'browser-login'): void
  (e: 'close'): void
  (e: 'skip'): void
}>()

const {
  username,
  password,
  isLoading,
  isLoggedIn,
  login,
  smsChallenge,
  smsCode,
  smsError,
  isSubmittingSmsCode,
  submitSmsCode,
  cancelSmsChallenge,
} = useAuth(props.onLoginSuccess)

const { t } = useI18n()

// Doubles as the card's description during the OTP step, so the prompt is not
// stated twice (once as a description, once above the boxes).
const smsPrompt = computed(() =>
  smsChallenge.value?.phoneHint
    ? t('auth.smsSentTo', { phone: smsChallenge.value.phoneHint })
    : t('auth.smsSentToBoundPhone')
)

// Dismissing the card abandons any parked SMS challenge, so main is not left
// holding a flow nobody will finish.
const requestClose = () => {
  if (smsChallenge.value) cancelSmsChallenge()
  emit('close')
}

const onOverlayClick = () => {
  if (!smsChallenge.value) requestClose()
}

// isLoggedIn is a module-level singleton; it flips to true on a successful login
// from any source. Forward that so the parent can close.
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) emit('success')
})
</script>

<style scoped>
/* Mirrors OnboardingModal's overlay + card so the sign-in surface is identical
   whether reached during onboarding or from the left-panel "Sign in" menu. */
.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-super-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--overlay-dark);
  backdrop-filter: blur(2px);
}

.signin-card {
  position: relative;
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

.signin-close {
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

.signin-close:hover {
  background-color: var(--bg-hover);
}

.signin-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.signin-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.signin-description {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 360px;
}

.sso-form {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 300px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.input-field {
  padding: 8px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.input-field::placeholder {
  color: var(--text-muted);
}

.input-field:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.signin-submit {
  width: 100%;
}

.browser-alt-link {
  align-self: center;
  margin-top: 14px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.browser-alt-link:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

.signin-skip-top {
  position: absolute;
  top: 14px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.signin-skip-top:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}
</style>
