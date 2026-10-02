<template>
  <!-- Embedded: form only, parent owns title/chrome (onboarding step). -->
  <div v-if="embedded" class="signin-embed">
    <SmsCodePanel
      v-if="smsChallenge"
      embedded
      :code="smsCode"
      :error="smsError"
      :is-submitting="isSubmittingSmsCode"
      @update:code="smsCode = $event"
      @submit="submitSmsCode"
      @cancel="cancelSmsChallenge"
    />
    <div v-else class="sso-form">
      <SsoCredentialFields
        v-model:username="username"
        v-model:password="password"
        @submit="login"
      />
      <button @click="login" :disabled="isLoading" class="btn btn--primary signin-submit">
        {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
      </button>
      <button type="button" class="browser-alt-link" @click="$emit('browser-login')">
        {{ $t('auth.signInWithBrowser') }}
      </button>
    </div>
  </div>

  <!-- While an SMS code is pending, a stray overlay click must not throw the
       half-finished flow away; the × (which cancels it properly) still does. -->
  <div v-else class="signin-overlay" @click="onOverlayClick">
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

      <div class="signin-body">
        <h2 class="signin-title">
          {{ smsChallenge ? $t('auth.smsTitle') : $t(copy.title) }}
        </h2>
        <p class="signin-description">
          {{ smsChallenge ? smsPrompt : $t(copy.description) }}
        </p>

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
          <SsoCredentialFields
            v-model:username="username"
            v-model:password="password"
            @submit="login"
          />
          <button @click="login" :disabled="isLoading" class="btn btn--primary signin-submit">
            {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
          </button>
          <p v-if="formError" class="signin-error">{{ formError }}</p>
          <button type="button" class="browser-alt-link" @click="$emit('browser-login')">
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@features/platform/useAuth'
import {
  cancelYanhe2SmsChallenge,
  submitYanhe2SignIn,
  submitYanhe2SmsCode,
  yanhe2Error,
  yanhe2Loading,
  yanhe2Password,
  yanhe2SignedIn,
  yanhe2SmsChallenge,
  yanhe2SmsCode,
  yanhe2SmsError,
  yanhe2SubmittingSms,
  yanhe2Username,
} from '@features/platform/yanhe2AccountUi'
import SmsCodePanel from './SmsCodePanel.vue'
import SsoCredentialFields from './SsoCredentialFields.vue'

const props = withDefaults(
  defineProps<{
    showClose?: boolean
    embedded?: boolean
    /**
     * `main` signs in the AutoSlides (Yanhekt) account. `yanhe2` signs the
     * already signed-in account in to Yanhe 2.0; same card, same SMS step.
     */
    variant?: 'main' | 'yanhe2'
  }>(),
  { showClose: true, embedded: false, variant: 'main' }
)

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'browser-login'): void
  (e: 'close'): void
}>()

// The variant is fixed for an instance's lifetime, so picking the bindings
// once at setup is enough.
const mainFlow = () => {
  const auth = useAuth()
  return {
    username: auth.username,
    password: auth.password,
    isLoading: auth.isLoading,
    login: auth.login,
    smsChallenge: auth.smsChallenge,
    smsCode: auth.smsCode,
    smsError: auth.smsError,
    isSubmittingSmsCode: auth.isSubmittingSmsCode,
    submitSmsCode: auth.submitSmsCode,
    cancelSmsChallenge: auth.cancelSmsChallenge,
    // The main flow reports failures in a dialog, not inline.
    formError: ref(''),
    succeeded: auth.isLoggedIn,
    copy: { title: 'onboarding.signInTitle', description: 'onboarding.signInDescription' },
  }
}

const yanhe2Flow = () => ({
  username: yanhe2Username,
  password: yanhe2Password,
  isLoading: yanhe2Loading,
  login: submitYanhe2SignIn,
  smsChallenge: yanhe2SmsChallenge,
  smsCode: yanhe2SmsCode,
  smsError: yanhe2SmsError,
  isSubmittingSmsCode: yanhe2SubmittingSms,
  submitSmsCode: submitYanhe2SmsCode,
  cancelSmsChallenge: cancelYanhe2SmsChallenge,
  formError: yanhe2Error,
  succeeded: yanhe2SignedIn,
  copy: { title: 'auth.yanhe2SignInTitle', description: 'auth.yanhe2SignInDescription' },
})

const {
  username,
  password,
  isLoading,
  login,
  smsChallenge,
  smsCode,
  smsError,
  isSubmittingSmsCode,
  submitSmsCode,
  cancelSmsChallenge,
  formError,
  succeeded,
  copy,
} = props.variant === 'yanhe2' ? yanhe2Flow() : mainFlow()

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

// isLoggedIn (or, for Yanhe 2.0, the active account's session) is a
// module-level singleton; it flips to true on a successful sign-in from any
// source. Forward that so the parent can close.
watch(succeeded, (done) => {
  if (done) emit('success')
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

.signin-embed {
  width: 100%;
}

.signin-embed .sso-form {
  max-width: none;
}

.sso-form {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 300px;
}

.signin-submit {
  width: 100%;
}

.signin-error {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--danger);
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
</style>
