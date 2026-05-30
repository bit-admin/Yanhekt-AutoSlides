<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.authentication') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.token') }}</label>
      <div class="setting-description">{{ $t('advanced.tokenDescription') }}</div>
      <div class="flex gap-2 items-center">
        <input
          v-model="manualToken"
          type="password"
          :placeholder="$t('advanced.tokenPlaceholder')"
          class="flex-1 py-1.5 px-2 border border-border-input rounded text-xs bg-surface text-text font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
          @input="onTokenInput"
        />
        <button @click="toggleTokenVisibility" class="py-[5px] px-2 bg-elevated border border-border-input rounded cursor-pointer flex items-center justify-center transition-colors hover:bg-hover" :title="showToken ? $t('advanced.hideToken') : $t('advanced.showToken')">
          <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button @click="verifyManualToken" :disabled="!manualToken || isVerifyingManualToken" class="py-1.5 px-3 bg-success text-white border-none rounded text-xs cursor-pointer whitespace-nowrap transition-colors hover:not(:disabled):bg-success/85 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ isVerifyingManualToken ? $t('advanced.verifying') : $t('advanced.verify') }}
        </button>
      </div>
      <div v-if="tokenVerificationStatus" :class="['token-status', tokenVerificationStatus.type]">
        {{ tokenVerificationStatus.message }}
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.appearance') }}</h4>
    <div class="setting-item">
      <div class="two-col-row">
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.theme') }}</label>
          <div class="w-full">
            <select v-model="tempThemeMode" class="concurrent-select">
              <option value="system">{{ $t('settings.followSystem') }}</option>
              <option value="light">{{ $t('settings.light') }}</option>
              <option value="dark">{{ $t('settings.dark') }}</option>
            </select>
          </div>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.language') }}</label>
          <div class="w-full">
            <select v-model="tempLanguageMode" class="concurrent-select">
              <option value="system">{{ $t('settings.followSystem') }}</option>
              <option value="en">{{ $t('settings.english') }}</option>
              <option value="zh">{{ $t('settings.chinese') }}</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.cacheManagement') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.cacheManagementDescription') }}</div>
      <div class="flex flex-col gap-2 mb-3 p-3 bg-elevated border border-hover rounded-md">
        <div class="flex justify-between items-center text-xs">
          <span class="text-text-secondary font-medium">{{ $t('advanced.cacheSize') }}</span>
          <span class="text-text font-semibold font-mono">{{ formatCacheSize(cacheStats.totalSize) }}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
          <span class="text-text-secondary font-medium">{{ $t('advanced.totalFiles') }}</span>
          <span class="text-text font-semibold font-mono">{{ cacheStats.tempFiles }}</span>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap mb-2">
        <button
          @click="refreshCacheStats"
          :disabled="isRefreshingCache"
          class="flex items-center gap-1.5 py-1.5 px-3 border border-border-input rounded text-[11px] cursor-pointer transition-all flex-1 min-w-0 justify-center bg-elevated text-text-secondary hover:not(:disabled):bg-hover hover:not(:disabled):border-accent hover:not(:disabled):text-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
          {{ isRefreshingCache ? $t('advanced.refreshing') : $t('advanced.refresh') }}
        </button>
        <button
          @click="clearCache"
          :disabled="isClearingCache || cacheStats.totalSize === 0"
          class="flex items-center gap-1.5 py-1.5 px-3 border rounded text-[11px] cursor-pointer transition-all flex-1 min-w-0 justify-center bg-warning border-warning text-white hover:not(:disabled):bg-warning/85 hover:not(:disabled):border-warning/85 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          {{ isClearingCache ? $t('advanced.clearing') : $t('advanced.clearCache') }}
        </button>
        <button
          @click="resetAllData"
          :disabled="isResettingData"
          class="flex items-center gap-1.5 py-1.5 px-3 border rounded text-[11px] cursor-pointer transition-all flex-1 min-w-0 justify-center bg-danger border-danger text-white hover:not(:disabled):bg-danger/85 hover:not(:disabled):border-danger/85 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="m2 17 10 5 10-5"/>
            <path d="m2 12 10 5 10-5"/>
          </svg>
          {{ isResettingData ? $t('advanced.resetting') : $t('advanced.resetAllData') }}
        </button>
      </div>
      <div v-if="cacheOperationStatus" :class="['cache-status', cacheOperationStatus.type]">
        {{ cacheOperationStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsContext } from '@features/settings/settingsContext'

const { auth, advanced, cache } = useSettingsContext()

const {
  manualToken,
  showToken,
  isVerifyingManualToken,
  tokenVerificationStatus,
  toggleTokenVisibility,
  onTokenInput,
  verifyManualToken,
} = auth

const {
  tempThemeMode,
  tempLanguageMode,
} = advanced

const {
  cacheStats,
  isRefreshingCache,
  isClearingCache,
  isResettingData,
  cacheOperationStatus,
  refreshCacheStats,
  clearCache,
  resetAllData,
  formatCacheSize,
} = cache
</script>

<style scoped>
@reference "tailwindcss";
/* Status badges — token-based colors that auto-darken */
.token-status {
  @apply mt-2 py-1.5 px-2 rounded text-[11px] font-medium;
}

.token-status.success {
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
}

.token-status.error {
  background-color: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.cache-status {
  @apply mt-2 py-2 px-3 rounded text-[11px] font-medium;
}

.cache-status.success {
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
}

.cache-status.error {
  background-color: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.cache-status.warning {
  background-color: color-mix(in srgb, var(--warning) 12%, transparent);
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
}
</style>
