<template>
  <div class="yanhe2-card">
    <button
      type="button"
      class="yanhe2-trigger"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter" aria-hidden="true">
        <path d="M12 2.25C12 7.64 7.64 12 2.25 12C7.64 12 12 16.36 12 21.75C12 16.36 16.36 12 21.75 12C16.36 12 12 7.64 12 2.25Z"/>
      </svg>
      <span class="yanhe2-label">{{ $t('auth.yanhe2Account') }}</span>
      <span class="yanhe2-status">{{ statusLabel }}</span>
      <svg
        class="yanhe2-chevron"
        :class="{ open }"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-if="open" class="yanhe2-body">
      <template v-if="yanhe2SignedIn">
        <div v-if="yanhe2ProfileLine" class="yanhe2-profile">
          <span class="yanhe2-profile-label">{{ $t('auth.yanhe2ProfileId') }}</span>
          <span class="yanhe2-profile-value">{{ yanhe2ProfileLine }}</span>
        </div>
        <button type="button" class="btn btn--danger-outline yanhe2-signout" @click="onSignOut">
          {{ $t('auth.signOut') }}
        </button>
      </template>
      <template v-else>
        <button type="button" class="signin-option" @click="onSso">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          <span>{{ $t('auth.signInWithSSO') }}</span>
        </button>
        <button type="button" class="signin-option" @click="onBrowser">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 8h20"/>
            <path d="M6 4v4"/>
            <path d="M10 4v4"/>
          </svg>
          <span>{{ $t('auth.signInWithBrowser') }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  requestYanhe2BrowserSignIn,
  requestYanhe2SignOut,
  requestYanhe2SsoSignIn,
  yanhe2MenuPhase,
  yanhe2ProfileLine,
  yanhe2SignedIn,
} from '@features/platform/yanhe2AccountUi'
import { i18n } from '@shared/i18n'

const statusLabel = computed(() => {
  if (yanhe2MenuPhase.value === 'verifying') return i18n.global.t('auth.yanhe2Verifying')
  if (yanhe2MenuPhase.value === 'signing') return i18n.global.t('auth.yanhe2Signing')
  return yanhe2SignedIn.value ? i18n.global.t('auth.yanhe2SignedIn') : i18n.global.t('auth.yanhe2SignedOut')
})

const open = ref(false)

const emit = defineEmits<{ (e: 'close'): void }>()

function onSso(): void {
  emit('close')
  requestYanhe2SsoSignIn()
}

function onBrowser(): void {
  emit('close')
  requestYanhe2BrowserSignIn()
}

function onSignOut(): void {
  emit('close')
  requestYanhe2SignOut()
}
</script>

<style scoped>
/* Inset card inside the user menu: the row is the header, the rest drops open under it. */
.yanhe2-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-subtle);
  overflow: hidden;
}

.yanhe2-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.yanhe2-trigger:hover {
  background-color: var(--bg-hover);
}

.signin-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.signin-option:hover {
  background-color: var(--bg-hover);
}

.signin-option-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.yanhe2-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yanhe2-status {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: var(--text-muted);
}

.yanhe2-chevron {
  flex-shrink: 0;
  margin-left: 2px;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.yanhe2-chevron.open {
  transform: rotate(180deg);
}

.yanhe2-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 6px 6px;
}

.yanhe2-profile {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 4px 4px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.3;
  color: var(--text-muted);
  white-space: nowrap;
  user-select: text;
  cursor: text;
}

.yanhe2-profile-label {
  flex-shrink: 0;
}

.yanhe2-profile-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yanhe2-signout {
  width: 100%;
  min-height: 0;
  padding: 4px 8px;
}
</style>
