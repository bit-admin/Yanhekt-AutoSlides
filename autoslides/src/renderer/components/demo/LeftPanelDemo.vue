<template>
  <div class="left-panel">
    <div class="login-section">
      <!-- Step 1: Show login form (not logged in state) -->
      <div v-if="!isDemoLoggedIn" class="login-form">
        <h3>{{ $t('auth.signIn') }}</h3>
        <p>{{ $t('auth.signInMessage') }}</p>
        <div class="input-group">
          <input
            type="text"
            :placeholder="$t('auth.username')"
            class="input-field"
            readonly
            value=""
          />
          <input
            type="password"
            :placeholder="$t('auth.password')"
            class="input-field"
            readonly
            value=""
          />
        </div>
        <div class="login-buttons">
          <button class="login-btn" disabled>
            {{ $t('auth.signIn') }}
          </button>
          <button class="browser-login-btn" disabled>
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>

      <!-- Step 2: Show logged in state with user-banner -->
      <div v-else class="user-info" ref="userInfoRef">
        <button type="button" class="user-banner open" disabled>
          <span class="user-avatar">K</span>
          <span class="user-banner-name">Kate</span>
          <svg
            class="user-banner-chevron open"
            width="16"
            height="16"
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
        <div class="user-menu">
          <p class="user-menu-username">{{ $t('auth.signInAs', { userId: '0000000000' }) }}</p>
          <p class="user-menu-message">{{ $t('auth.accessMessage') }}</p>
          <button class="logout-btn user-menu-signout" disabled>{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>{{ $t('settings.settings') }}</h3>
        <button class="advanced-btn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ $t('settings.advancedSettings') }}
        </button>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
            <button class="reset-btn" disabled :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="directory-input-group">
            <input
              type="text"
              readonly
              class="directory-input"
              value="/Users/Kate/Documents/AutoSlides"
            />
            <button class="browse-btn" disabled>{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <div class="setting-item connection-mode-setting">
          <label class="setting-label">{{ $t('settings.connectionMode') }}</label>
          <div class="mode-toggle">
            <button class="mode-btn active" disabled>
              {{ $t('settings.internalNetwork') }}
            </button>
            <button class="mode-btn" disabled>
              {{ $t('settings.externalNetwork') }}
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.audioMode') }}</label>
          <div class="audio-mode-selector">
            <select class="audio-mode-select" disabled>
              <option value="normal">{{ $t('settings.normal') }}</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideDetectionInterval') }}</label>
            <button class="reset-btn" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="setting-description">{{ $t('settings.slideDetectionDescription') }}</div>
          <div class="slide-interval-group">
            <div class="slide-interval-input-wrapper">
              <input
                type="number"
                class="slide-interval-input"
                value="2000"
                readonly
              />
              <span class="interval-unit">{{ $t('settings.milliseconds') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideStabilityVerification') }}</label>
            <button class="reset-btn" disabled>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div class="setting-description">{{ $t('settings.slideStabilityDescription') }}</div>
          <div class="verification-unified-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked
                disabled
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="verification-count-control">
              <select class="verification-count-select" disabled>
                <option value="2" selected>2</option>
              </select>
              <span class="count-label">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.taskSpeed') }}</label>
          <div class="setting-description">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="task-speed-selector">
            <select class="task-speed-select" disabled>
              <option value="10" selected>10x</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.autoPostProcessing') }}</label>
          <div class="setting-description">{{ $t('settings.autoPostProcessingDescription') }}</div>
          <div class="auto-post-processing-control">
            <label class="checkbox-label">
              <input type="checkbox" disabled />
              {{ $t('settings.enableAutoPostProcessingLive') }}
            </label>
            <label class="checkbox-label">
              <input type="checkbox" checked disabled />
              {{ $t('settings.enableAutoPostProcessingRecorded') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <div id="tour-tools-launchers" class="tools-launchers">
        <div class="tools-dropdown">
          <button class="tools-trigger" disabled>
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
            </svg>
            <span>{{ $t('tools.openTools') }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
              <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>

        <div class="tools-dropdown addons-dropdown">
          <button class="tools-trigger" disabled>
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            <span>{{ $t('addons.openAddons') }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
              <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="status-row">
        <span class="status-label">{{ $t('status.taskStatus') }}</span>
        <span class="status-value">{{ $t('status.noTasks') }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">{{ $t('status.downloadQueue') }}</span>
        <span class="status-value">{{ $t('status.noDownloads') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isDemoLoggedIn = ref(false)

const loginDemo = () => {
  isDemoLoggedIn.value = true
}

const resetDemo = () => {
  isDemoLoggedIn.value = false
}

defineExpose({
  loginDemo,
  resetDemo,
  isDemoLoggedIn
})
</script>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.login-section {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.login-form {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.login-form h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.login-form p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.input-field {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: #f8f9fa;
  color: #999;
}

.login-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100%;
}

.login-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: not-allowed;
  background-color: #ccc;
  color: white;
}

.browser-login-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  font-size: 13px;
  cursor: not-allowed;
  background-color: transparent;
  color: #007acc;
  white-space: nowrap;
  opacity: 0.6;
}

/* User banner (logged-in state) */
.user-info {
  position: relative;
}

.user-banner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #d5d9de;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  padding: 5px 8px;
  background-color: #ffffff;
  cursor: default;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-banner-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-banner-chevron {
  width: 14px;
  height: 14px;
  color: #6b7280;
}

.user-banner-chevron.open {
  transform: rotate(180deg);
}

.user-menu {
  border: 1px solid #d5d9de;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background-color: #ffffff;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  padding: 8px;
}

.user-menu-username {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

.user-menu-message {
  margin: 4px 0 8px 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.35;
}

.logout-btn {
  border-radius: 4px;
  font-size: 12px;
  cursor: not-allowed;
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 10px;
  opacity: 0.6;
}

.user-menu-signout {
  width: 100%;
  text-align: center;
}

.control-section {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.control-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.advanced-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: not-allowed;
  color: #999;
  opacity: 0.6;
}

.settings-content {
  padding: 0;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item:last-child {
  margin-bottom: 0;
  margin-top: 6px;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.setting-label-with-reset {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.reset-btn {
  background: none;
  border: none;
  cursor: not-allowed;
  padding: 2px;
  border-radius: 3px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.directory-input-group {
  display: flex;
  gap: 8px;
}

.directory-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: #f8f9fa;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browse-btn {
  padding: 6px 12px;
  background-color: #ccc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: not-allowed;
}

.mode-toggle {
  display: flex;
  gap: 4px;
}

.mode-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  background-color: #f8f9fa;
  color: #666;
  font-size: 11px;
  border-radius: 4px;
  cursor: not-allowed;
}

.mode-btn.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.audio-mode-selector, .task-speed-selector {
  width: 100%;
}

.audio-mode-select, .task-speed-select, .verification-count-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f8f9fa;
  font-size: 12px;
  cursor: not-allowed;
  color: #666;
}

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
  line-height: 1.3;
  margin-top: 2px;
}

.slide-interval-group {
  display: flex;
  align-items: center;
}

.slide-interval-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.slide-interval-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
  color: #666;
}

.interval-unit {
  padding: 6px 8px;
  font-size: 11px;
  color: #666;
  background-color: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  white-space: nowrap;
}

.verification-unified-control {
  display: flex;
  align-items: stretch;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  height: 35px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: not-allowed;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  user-select: none;
  flex: 1;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: not-allowed;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

.verification-count-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.7);
  border-left: 1px solid #ddd;
}

.count-label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.verification-count-select {
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f8f9fa;
  font-size: 11px;
  cursor: not-allowed;
  min-width: 50px;
  color: #666;
}

/* Auto post-processing control */
.auto-post-processing-control {
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.auto-post-processing-control .checkbox-label {
  cursor: not-allowed;
  padding: 8px 12px;
  color: #333;
}

.auto-post-processing-control .checkbox-label:not(:last-child) {
  border-bottom: 1px solid #ddd;
}

.auto-post-processing-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: not-allowed;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

.status-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

/* Tools & Add-ons launcher buttons */
.tools-dropdown {
  margin-bottom: 10px;
}

.tools-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #ffffff;
  color: #333;
  font-size: 11px;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.6;
}

.tools-trigger svg:first-child {
  flex-shrink: 0;
  opacity: 0.7;
}

.tools-chevron {
  margin-left: auto;
  opacity: 0.45;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.status-row:last-child {
  margin-bottom: 0;
}

.status-label {
  font-weight: 500;
  color: #333;
}

.status-value {
  color: #666;
}

/* Connection mode setting highlight for tour */
.connection-mode-setting {
  position: relative;
}

.connection-mode-setting .setting-label {
  font-weight: 600;
}
</style>
