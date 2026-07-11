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
  width: 420px;
  max-width: 92vw;
}

.signin-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Same segmented control idiom as the Search page mode switch */
.signin-mode-switch {
  display: flex;
  align-items: center;
  align-self: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.signin-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
}

.signin-submit {
  margin-top: 4px;
}

/* Draggable bookmarklet chip */
.bookmarklet-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  align-self: flex-start;
  padding: 7px 14px;
  border: 1px dashed var(--accent);
  border-radius: 8px;
  background-color: var(--badge-active-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: grab;
  user-select: none;
}

.bookmarklet-link:active {
  cursor: grabbing;
}
</style>
