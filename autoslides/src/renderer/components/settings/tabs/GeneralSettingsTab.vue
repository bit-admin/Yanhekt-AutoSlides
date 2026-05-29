<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.authentication') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.token') }}</label>
      <div class="setting-description">{{ $t('advanced.tokenDescription') }}</div>
      <div class="flex items-center gap-2">
        <input
          v-model="manualToken"
          type="password"
          :placeholder="$t('advanced.tokenPlaceholder')"
          class="input flex-1 font-mono"
          @input="onTokenInput"
        />
        <button @click="toggleTokenVisibility" class="flex cursor-pointer items-center justify-center rounded border border-line-input bg-elevated px-2 py-[5px] text-fg transition-colors hover:bg-hover" :title="showToken ? $t('advanced.hideToken') : $t('advanced.showToken')">
          <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button @click="verifyManualToken" :disabled="!manualToken || isVerifyingManualToken" class="whitespace-nowrap rounded border-none bg-[#28a745] px-3 py-1.5 text-xs text-white cursor-pointer transition-colors enabled:hover:bg-[#218838] disabled:cursor-not-allowed disabled:bg-[#6c757d] dark:bg-[#4caf50] dark:enabled:hover:bg-[#45a049] dark:disabled:bg-[#555]">
          {{ isVerifyingManualToken ? $t('advanced.verifying') : $t('advanced.verify') }}
        </button>
      </div>
      <div v-if="tokenVerificationStatus" :class="['mt-2 rounded px-2 py-1.5 text-[11px] font-medium', statusBoxClass(tokenVerificationStatus.type)]">
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
          <select v-model="tempThemeMode" class="select cursor-pointer">
            <option value="system">{{ $t('settings.followSystem') }}</option>
            <option value="light">{{ $t('settings.light') }}</option>
            <option value="dark">{{ $t('settings.dark') }}</option>
          </select>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.language') }}</label>
          <select v-model="tempLanguageMode" class="select cursor-pointer">
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

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.cacheManagement') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.cacheManagementDescription') }}</div>
      <div class="mb-3 flex flex-col gap-2 rounded-md border border-line bg-elevated p-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-fg-secondary">{{ $t('advanced.cacheSize') }}</span>
          <span class="font-mono font-semibold text-fg">{{ formatCacheSize(cacheStats.totalSize) }}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-fg-secondary">{{ $t('advanced.totalFiles') }}</span>
          <span class="font-mono font-semibold text-fg">{{ cacheStats.tempFiles }}</span>
        </div>
      </div>
      <div class="mb-2 flex flex-wrap gap-2">
        <button
          @click="refreshCacheStats"
          :disabled="isRefreshingCache"
          :class="[cacheBtnBase, 'border-line bg-elevated text-fg-secondary enabled:hover:border-accent enabled:hover:bg-hover enabled:hover:text-accent']"
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
          :class="[cacheBtnBase, 'border-[#ffc107] bg-[#ffc107] text-[#212529] enabled:hover:border-[#e0a800] enabled:hover:bg-[#e0a800] dark:border-[#f39c12] dark:bg-[#f39c12] dark:text-[#1a1a1a] dark:enabled:hover:border-[#e67e22] dark:enabled:hover:bg-[#e67e22]']"
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
          :class="[cacheBtnBase, 'border-[#dc3545] bg-[#dc3545] text-white enabled:hover:border-[#c82333] enabled:hover:bg-[#c82333] dark:border-[#e74c3c] dark:bg-[#e74c3c] dark:enabled:hover:border-[#c0392b] dark:enabled:hover:bg-[#c0392b]']"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="m2 17 10 5 10-5"/>
            <path d="m2 12 10 5 10-5"/>
          </svg>
          {{ isResettingData ? $t('advanced.resetting') : $t('advanced.resetAllData') }}
        </button>
      </div>
      <div v-if="cacheOperationStatus" :class="['rounded px-3 py-2 text-[11px] font-medium', statusBoxClass(cacheOperationStatus.type)]">
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

// Bootstrap-style status badge palette (token/cache feedback). Theme-aware.
const statusBoxClass = (type: 'success' | 'error' | 'warning' | string) => {
  switch (type) {
    case 'success':
      return 'border border-[#c3e6cb] bg-[#d4edda] text-[#155724] dark:border-[#2d5a3d] dark:bg-[#1b4332] dark:text-[#4caf50]'
    case 'warning':
      return 'border border-[#ffeaa7] bg-[#fff3cd] text-[#856404] dark:border-[#665c2a] dark:bg-[#3d3520] dark:text-[#f39c12]'
    case 'error':
    default:
      return 'border border-[#f5c6cb] bg-[#f8d7da] text-[#721c24] dark:border-[#5d2a2a] dark:bg-[#4a1e1e] dark:text-[#ff6b6b]'
  }
}

const cacheBtnBase =
  'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition-all disabled:cursor-not-allowed disabled:opacity-50'
</script>

