<template>
  <div class="yanhe2-account">
    <button type="button" class="signin-option yanhe2-trigger">
      <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter" aria-hidden="true">
        <path d="M12 2.25C12 7.64 7.64 12 2.25 12C7.64 12 12 16.36 12 21.75C12 16.36 16.36 12 21.75 12C16.36 12 12 7.64 12 2.25Z"/>
      </svg>
      <span class="yanhe2-label">{{ $t('auth.yanhe2Account') }}</span>
      <span class="yanhe2-status">{{ yanhe2SignedIn ? $t('auth.yanhe2SignedIn') : $t('auth.yanhe2SignedOut') }}</span>
      <svg
        class="menu-link-chevron"
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
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>

    <div class="yanhe2-flyout">
      <template v-if="yanhe2SignedIn">
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
import {
  requestYanhe2BrowserSignIn,
  requestYanhe2SignOut,
  requestYanhe2SsoSignIn,
  yanhe2SignedIn,
} from '@features/platform/yanhe2AccountUi'

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
.yanhe2-account {
  position: relative;
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

.menu-link-chevron {
  flex-shrink: 0;
  margin-left: 2px;
  color: var(--text-muted);
}

/* Sideways hover flyout — same dropup anchor as AccountSwitcher. */
.yanhe2-flyout {
  position: absolute;
  left: 100%;
  bottom: -9px;
  margin-left: 12px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-md);
  z-index: var(--z-overlay);
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

.yanhe2-flyout::before {
  content: '';
  position: absolute;
  top: 0;
  left: -12px;
  width: 12px;
  height: 100%;
}

.yanhe2-account:hover .yanhe2-flyout {
  visibility: visible;
  opacity: 1;
}

.yanhe2-signout {
  width: 100%;
  min-height: 0;
  padding: 4px 8px;
}
</style>
