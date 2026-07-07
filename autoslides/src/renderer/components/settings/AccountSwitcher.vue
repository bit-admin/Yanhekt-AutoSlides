<template>
  <div class="account-switcher">
    <button type="button" class="signin-option account-switcher-trigger">
      <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 11h-6"/>
        <path d="M20 8v6"/>
      </svg>
      <span>{{ $t('auth.switchAccount') }}</span>
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

    <div class="account-flyout">
      <button
        v-for="account in switchableAccounts"
        :key="account.badge || account.token"
        type="button"
        class="signin-option account-row"
        @click="onSwitch(account.badge)"
      >
        <span class="account-avatar">{{ initialFor(account) }}</span>
        <span class="account-labels">
          <span class="account-name">{{ account.displayName || account.nickname || 'User' }}</span>
          <span v-if="account.badge" class="account-badge">{{ account.badge }}</span>
        </span>
      </button>

      <template v-if="mode === 'signed-in'">
        <div v-if="switchableAccounts.length > 0" class="menu-links-separator"></div>
        <button type="button" class="signin-option" @click="onAddAccount">
          <svg class="signin-option-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>{{ $t('auth.addAccount') }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore } from '@shared/services/configStore'
import { useAuth } from '@features/platform/useAuth'
import type { StoredAccount } from '@common/types'

const { t: $t } = useI18n()

const props = defineProps<{ mode: 'signed-in' | 'signed-out' }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { userId, switchAccount, deactivate } = useAuth()

// Signed-in: everyone except the active account. Signed-out: everyone.
const switchableAccounts = computed<StoredAccount[]>(() => {
  const accounts = configStore.accounts ?? []
  if (props.mode === 'signed-out') return accounts
  return accounts.filter((a) => a.badge !== userId.value)
})

function initialFor(account: StoredAccount): string {
  const name = account.displayName || account.nickname
  return name ? name.charAt(0).toUpperCase() : 'U'
}

async function onSwitch(badge: string) {
  emit('close')
  await switchAccount(badge)
}

function onAddAccount() {
  emit('close')
  deactivate()
}
</script>

<style scoped>
.account-switcher {
  position: relative;
}

/* Reuse the dropup menu-item idiom from LeftPanel's .signin-option */
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

.menu-link-chevron {
  margin-left: auto;
  color: var(--text-muted);
}

.menu-links-separator {
  height: 1px;
  background-color: var(--border-input);
  margin: 4px 0;
}

/* Sideways hover flyout — mirrors UserMenuLinks' .feedback-flyout */
.account-flyout {
  position: absolute;
  left: 100%;
  /* Bottom-anchored so the list grows upward: the parent is a dropup pinned to the
     bottom of the sidebar, so a top-anchored flyout overshoots the window with 2+ rows. */
  bottom: -9px;
  margin-left: 12px;
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-md);
  z-index: 30;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

/* Transparent bridge spanning the gap so hover stays continuous */
.account-flyout::before {
  content: '';
  position: absolute;
  top: 0;
  left: -12px;
  width: 12px;
  height: 100%;
}

.account-switcher:hover .account-flyout {
  visibility: visible;
  opacity: 1;
}

.account-row {
  align-items: center;
  padding: 4px 10px;
}

.account-avatar {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--accent);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 600;
}

.account-labels {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.account-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-badge {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
