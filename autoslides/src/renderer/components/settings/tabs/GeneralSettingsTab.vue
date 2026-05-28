<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.authentication') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.token') }}</label>
      <div class="setting-description">{{ $t('advanced.tokenDescription') }}</div>
      <div class="token-input-group">
        <input
          v-model="manualToken"
          type="password"
          :placeholder="$t('advanced.tokenPlaceholder')"
          class="token-input"
          @input="onTokenInput"
        />
        <button @click="toggleTokenVisibility" class="token-toggle-btn" :title="showToken ? $t('advanced.hideToken') : $t('advanced.showToken')">
          <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button @click="verifyManualToken" :disabled="!manualToken || isVerifyingManualToken" class="verify-token-btn">
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
          <div class="theme-selector">
            <select v-model="tempThemeMode" class="theme-select">
              <option value="system">{{ $t('settings.followSystem') }}</option>
              <option value="light">{{ $t('settings.light') }}</option>
              <option value="dark">{{ $t('settings.dark') }}</option>
            </select>
          </div>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.language') }}</label>
          <div class="language-selector">
            <select v-model="tempLanguageMode" class="language-select">
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
      <div class="cache-stats">
        <div class="cache-stat-item">
          <span class="cache-stat-label">{{ $t('advanced.cacheSize') }}</span>
          <span class="cache-stat-value">{{ formatCacheSize(cacheStats.totalSize) }}</span>
        </div>
        <div class="cache-stat-item">
          <span class="cache-stat-label">{{ $t('advanced.totalFiles') }}</span>
          <span class="cache-stat-value">{{ cacheStats.tempFiles }}</span>
        </div>
      </div>
      <div class="cache-actions">
        <button
          @click="refreshCacheStats"
          :disabled="isRefreshingCache"
          class="cache-refresh-btn"
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
          class="cache-clear-btn"
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
          class="cache-reset-btn"
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
.two-col-row {
  display: flex;
  gap: 12px;
}

.two-col-item {
  flex: 1;
}

.two-col-item .setting-label {
  margin-bottom: 6px;
}

.theme-selector {
  width: 100%;
}

.theme-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.theme-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.language-selector {
  width: 100%;
}

.language-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.language-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.token-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.token-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  font-family: 'Courier New', monospace;
}

.token-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.token-toggle-btn {
  padding: 5px 8px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.token-toggle-btn:hover {
  background-color: #e9ecef;
}

.verify-token-btn {
  padding: 6px 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.verify-token-btn:hover:not(:disabled) {
  background-color: #218838;
}

.verify-token-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.token-status {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.token-status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.token-status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.cache-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.cache-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cache-stat-label {
  color: #666;
  font-weight: 500;
}

.cache-stat-value {
  color: #333;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.cache-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.cache-refresh-btn, .cache-clear-btn, .cache-reset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.cache-refresh-btn {
  background-color: #f8f9fa;
  border-color: #ddd;
  color: #666;
}

.cache-refresh-btn:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #007acc;
  color: #007acc;
}

.cache-clear-btn {
  background-color: #ffc107;
  border-color: #ffc107;
  color: #212529;
}

.cache-clear-btn:hover:not(:disabled) {
  background-color: #e0a800;
  border-color: #e0a800;
}

.cache-reset-btn {
  background-color: #dc3545;
  border-color: #dc3545;
  color: white;
}

.cache-reset-btn:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #c82333;
}

.cache-refresh-btn:disabled,
.cache-clear-btn:disabled,
.cache-reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cache-status {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.cache-status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.cache-status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.cache-status.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

@media (prefers-color-scheme: dark) {
  .theme-select,
  .language-select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .theme-select:focus,
  .language-select:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .token-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .token-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .token-toggle-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .token-toggle-btn:hover {
    background-color: #3d3d3d;
  }

  .verify-token-btn {
    background-color: #4caf50;
  }

  .verify-token-btn:hover:not(:disabled) {
    background-color: #45a049;
  }

  .verify-token-btn:disabled {
    background-color: #555;
  }

  .token-status.success {
    background-color: #1b4332;
    color: #4caf50;
    border-color: #2d5a3d;
  }

  .token-status.error {
    background-color: #4a1e1e;
    color: #ff6b6b;
    border-color: #5d2a2a;
  }

  .cache-stats {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .cache-stat-label {
    color: #b0b0b0;
  }

  .cache-stat-value {
    color: #e0e0e0;
  }

  .cache-refresh-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .cache-refresh-btn:hover:not(:disabled) {
    background-color: #3d3d3d;
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .cache-clear-btn {
    background-color: #f39c12;
    border-color: #f39c12;
    color: #1a1a1a;
  }

  .cache-clear-btn:hover:not(:disabled) {
    background-color: #e67e22;
    border-color: #e67e22;
  }

  .cache-reset-btn {
    background-color: #e74c3c;
    border-color: #e74c3c;
  }

  .cache-reset-btn:hover:not(:disabled) {
    background-color: #c0392b;
    border-color: #c0392b;
  }

  .cache-status.success {
    background-color: #1b4332;
    color: #4caf50;
    border-color: #2d5a3d;
  }

  .cache-status.error {
    background-color: #4a1e1e;
    color: #ff6b6b;
    border-color: #5d2a2a;
  }

  .cache-status.warning {
    background-color: #3d3520;
    color: #f39c12;
    border-color: #665c2a;
  }
}
</style>
