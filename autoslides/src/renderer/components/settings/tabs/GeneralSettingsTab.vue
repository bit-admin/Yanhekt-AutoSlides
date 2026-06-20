<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.tabs.general') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
      <div class="input-group">
        <input
          :value="outputDirectory"
          type="text"
          readonly
          class="text-input directory-input"
          :title="outputDirectory"
        />
        <button @click="selectOutputDirectory" class="btn btn--primary">{{ $t('settings.browse') }}</button>
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('settings.connectionMode') }}</label>
      <div class="mode-toggle">
        <button
          @click="tempConnectionMode = 'internal'"
          :class="['mode-btn', { active: tempConnectionMode === 'internal' }]"
        >
          {{ $t('settings.internalNetwork') }}
        </button>
        <button
          @click="tempConnectionMode = 'external'"
          :class="['mode-btn', { active: tempConnectionMode === 'external' }]"
        >
          {{ $t('settings.externalNetwork') }}
        </button>
      </div>
    </div>

    <div class="setting-item">
      <div class="two-col-row">
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.audioMode') }}</label>
          <select v-model="tempMuteMode" class="select-field">
            <option value="normal">{{ $t('settings.normal') }}</option>
            <option value="mute_all">{{ $t('settings.muteAll') }}</option>
            <option value="mute_live">{{ $t('settings.muteLive') }}</option>
            <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
          </select>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.taskSpeed') }}</label>
          <select v-model="tempTaskSpeed" class="select-field">
            <option v-for="n in 16" :key="n" :value="n">{{ n }}x</option>
          </select>
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="two-col-row">
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.parallelTasks') }}</label>
          <select v-model.number="tempParallelTasks" class="select-field">
            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
          </select>
          <div class="setting-description">{{ $t('settings.parallelTasksDescription') }}</div>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.maxManualTabs') }}</label>
          <select v-model.number="tempMaxManualTabs" class="select-field">
            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
          </select>
          <div class="setting-description">{{ $t('settings.maxManualTabsDescription') }}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.authentication') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.token') }}</label>
      <div class="setting-description">{{ $t('advanced.tokenDescription') }}</div>
      <div class="input-group">
        <input
          v-model="manualToken"
          type="password"
          :placeholder="$t('advanced.tokenPlaceholder')"
          class="text-input token-input"
          @input="onTokenInput"
        />
        <button @click="toggleTokenVisibility" class="btn btn--adornment" :title="showToken ? $t('advanced.hideToken') : $t('advanced.showToken')">
          <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button @click="verifyManualToken" :disabled="!manualToken || isVerifyingManualToken" class="btn btn--success">
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
            <select v-model="tempThemeMode" class="select-field">
              <option value="system">{{ $t('settings.followSystem') }}</option>
              <option value="light">{{ $t('settings.light') }}</option>
              <option value="dark">{{ $t('settings.dark') }}</option>
            </select>
          </div>
        </div>
        <div class="two-col-item">
          <label class="setting-label">{{ $t('settings.language') }}</label>
          <div class="language-selector">
            <select v-model="tempLanguageMode" class="select-field">
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
          class="btn"
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
          class="btn btn--warning"
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
          class="btn btn--danger"
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

const { auth, settings, advanced, cache } = useSettingsContext()

const {
  outputDirectory,
  selectOutputDirectory,
} = settings

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
  tempConnectionMode,
  tempMuteMode,
  tempTaskSpeed,
  tempParallelTasks,
  tempMaxManualTabs,
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
.directory-input {
  flex: 1;
  min-width: 0;
}

.mode-toggle {
  display: flex;
  gap: 4px;
}

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

.theme-selector,
.language-selector {
  width: 100%;
}

.token-input {
  flex: 1;
  font-family: 'Courier New', monospace;
}

.token-status {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.token-status.success {
  background-color: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.token-status.error {
  background-color: var(--danger-bg);
  color: var(--danger-bright);
  border: 1px solid var(--danger-border);
}

.cache-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.cache-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cache-stat-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.cache-stat-value {
  color: var(--text-primary);
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.cache-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.cache-actions .btn {
  flex: 1;
  min-width: 0;
}

.cache-status {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.cache-status.success {
  background-color: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.cache-status.error {
  background-color: var(--danger-bg);
  color: var(--danger-bright);
  border: 1px solid var(--danger-border);
}

.cache-status.warning {
  background-color: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}
</style>
