<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content signin-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ mode === 'password' ? $t('webAuth.passwordTitle') : $t('webAuth.tokenTitle') }}</h3>
        <button @click="$emit('close')" class="modal-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body signin-body">
        <div class="signin-mode-switch">
          <button
            :class="['mode-pill', { active: mode === 'password' }]"
            @click="switchMode('password')"
          >
            {{ $t('webAuth.signInWithPassword') }}
          </button>
          <button
            :class="['mode-pill', { active: mode === 'token' }]"
            @click="switchMode('token')"
          >
            {{ $t('webAuth.signInWithToken') }}
          </button>
        </div>

        <form v-if="mode === 'password'" class="signin-form" @submit.prevent="submitPassword">
          <input
            v-model="username"
            type="text"
            class="text-input"
            :placeholder="$t('webAuth.usernamePlaceholder')"
            autocomplete="username"
          />
          <input
            v-model="password"
            type="password"
            class="text-input"
            :placeholder="$t('webAuth.passwordPlaceholder')"
            autocomplete="current-password"
          />
          <p class="signin-disclaimer">{{ $t('webAuth.passwordDisclaimer') }}</p>
          <p v-if="errorMessage" class="signin-error">{{ errorMessage }}</p>
          <button
            type="submit"
            class="btn btn--primary signin-submit"
            :disabled="isSubmitting || !username.trim() || !password"
          >
            {{ isSubmitting ? $t('webAuth.signingIn') : $t('webAuth.signIn') }}
          </button>
        </form>

        <form v-else class="signin-form" @submit.prevent="submitToken">
          <p class="signin-hint">{{ $t('webAuth.tokenHint') }}</p>
          <a
            class="bookmarklet-link"
            :href="bookmarkletHref"
            @click.prevent
            draggable="true"
            :title="$t('webAuth.bookmarkletLabel')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
            </svg>
            {{ $t('webAuth.bookmarkletLabel') }}
          </a>
          <input
            v-model="tokenInput"
            type="text"
            class="text-input"
            :placeholder="$t('webAuth.tokenPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          />
          <p v-if="errorMessage" class="signin-error">{{ errorMessage }}</p>
          <button
            type="submit"
            class="btn btn--primary signin-submit"
            :disabled="isSubmitting || !tokenInput.trim()"
          >
            {{ isSubmitting ? $t('webAuth.signingIn') : $t('webAuth.tokenConfirm') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { authStore } from '../stores/authStore'
import { generateBookmarklet } from '../lib/bookmarklet'

const props = defineProps<{
  initialMode?: 'password' | 'token'
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t, locale } = useI18n()

const mode = ref<'password' | 'token'>(props.initialMode ?? 'password')
const username = ref('')
const password = ref('')
const tokenInput = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const bookmarkletHref = computed(() =>
  generateBookmarklet(locale.value.startsWith('zh') ? 'zh' : 'en'),
)

const switchMode = (m: 'password' | 'token') => {
  mode.value = m
  errorMessage.value = ''
}

const submitPassword = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const result = await authStore.loginWithPassword(username.value.trim(), password.value)
    if (result.success) {
      emit('success')
      emit('close')
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
      emit('success')
      emit('close')
    } else {
      errorMessage.value = result.error || t('webAuth.invalidToken')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.signin-modal {
  width: 400px;
  max-width: 92vw;
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 12px 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.signin-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Premium iOS/macOS style segmented control */
.signin-mode-switch {
  display: flex;
  width: 100%;
  padding: 2px;
  background-color: var(--bg-page-alt);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 4px;
}

.mode-pill {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  background-color: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.signin-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.signin-form .text-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.signin-form .text-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
  outline: none;
}

.signin-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.signin-disclaimer {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}

.signin-error {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
  font-weight: 500;
}

.signin-submit {
  height: 38px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  margin-top: 4px;
  transition: all 0.15s ease;
}

.signin-submit:hover:not(:disabled) {
  transform: translateY(-1px);
}

.signin-submit:active:not(:disabled) {
  transform: translateY(0);
}

/* Full-width premium bookmarklet link */
.bookmarklet-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 16px;
  border: 1.5px dashed var(--accent);
  border-radius: 8px;
  background-color: var(--badge-active-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: grab;
  user-select: none;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.bookmarklet-link:hover {
  background-color: var(--bg-hover);
}

.bookmarklet-link:active {
  cursor: grabbing;
  transform: scale(0.98);
}
</style>
