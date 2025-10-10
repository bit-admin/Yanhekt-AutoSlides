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
        <button class="login-btn" disabled>
          {{ $t('auth.signIn') }}
        </button>
      </div>

      <!-- Step 2: Show logged in state with demo user -->
      <div v-else class="user-info">
        <h3>{{ $t('auth.hiThere', { nickname: 'Kate' }) }}</h3>
        <p>{{ $t('auth.signInAs', { userId: '0000000000' }) }}</p>
        <p>{{ $t('auth.accessMessage') }}</p>
        <button class="logout-btn" disabled>{{ $t('auth.signOut') }}</button>
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
          <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
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
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <div class="theme-language-row">
            <div class="theme-language-item">
              <label class="setting-label">{{ $t('settings.theme') }}</label>
              <div class="theme-selector">
                <select class="theme-select" disabled>
                  <option value="system">{{ $t('settings.followSystem') }}</option>
                  <option value="light">{{ $t('settings.light') }}</option>
                  <option value="dark">{{ $t('settings.dark') }}</option>
                </select>
              </div>
            </div>
            <div class="theme-language-item">
              <label class="setting-label">{{ $t('settings.language') }}</label>
              <div class="language-selector">
                <select class="language-select" disabled>
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
      </div>
    </div>

    <div class="status-section">
      <div class="status-row">
        <span class="status-label">{{ $t('status.connection') }}</span>
        <span class="status-value internal">
          {{ $t('settings.internalNetwork') }}
        </span>
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

// Demo state - controls whether we show login form or logged in state
const isDemoLoggedIn = ref(false)

// Method to transition from login form to logged in state
const loginDemo = () => {
  isDemoLoggedIn.value = true
}

// Method to reset to login form
const resetDemo = () => {
  isDemoLoggedIn.value = false
}

// Expose methods for external control
defineExpose({
  loginDemo,
  resetDemo,
  isDemoLoggedIn
})
</script>

<style scoped>
/* Import all the styles from the original LeftPanel.vue */
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

.login-form, .user-info {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.user-info {
  padding: 8px 0;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.login-form h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.user-info h3 {
  margin: 5px 0 14px 20px;
  font-size: 24px;
  font-weight: 600;
}

.login-form p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.user-info p {
  margin: 0 20px 10px 20px;
  font-size: 15px;
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

.login-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: not-allowed;
  background-color: #ccc;
  color: white;
}

.logout-btn {
  border-radius: 4px;
  font-size: 12px;
  cursor: not-allowed;
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 16px;
  align-self: flex-start;
  margin: 4px 0 4px 20px;
  opacity: 0.6;
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

.audio-mode-selector, .theme-selector, .language-selector, .task-speed-selector {
  width: 100%;
}

.audio-mode-select, .theme-select, .language-select, .task-speed-select, .verification-count-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f8f9fa;
  font-size: 12px;
  cursor: not-allowed;
  color: #666;
}

.theme-language-row {
  display: flex;
  gap: 12px;
}

.theme-language-item {
  flex: 1;
}

.theme-language-item .setting-label {
  margin-bottom: 6px;
}

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.3;
  margin-top: 2px;
  margin-bottom: 6px;
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
  color: #666;
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

.status-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
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

.status-value.internal {
  color: #28a745;
}

/* Connection mode setting highlight for tour */
.connection-mode-setting {
  position: relative;
}

.connection-mode-setting .setting-label {
  font-weight: 600;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .left-panel {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .login-section {
    border-bottom-color: #404040;
    background-color: #2d2d2d;
  }

  .user-info {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .login-form h3, .user-info h3 {
    color: #e0e0e0;
  }

  .login-form p, .user-info p {
    color: #b0b0b0;
  }

  .input-field {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #888;
  }

  .login-btn {
    background-color: #555;
  }

  .logout-btn {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }

  .control-section {
    background-color: #2d2d2d;
  }

  .control-header h3 {
    color: #e0e0e0;
  }

  .advanced-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #888;
  }

  .setting-label {
    color: #e0e0e0;
  }

  .reset-btn {
    color: #888;
  }

  .setting-description {
    color: #b0b0b0;
  }

  .directory-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .browse-btn {
    background-color: #555;
  }

  .mode-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .mode-btn.active {
    background-color: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  .audio-mode-select, .theme-select, .language-select, .task-speed-select, .verification-count-select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .slide-interval-input-wrapper {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .slide-interval-input {
    color: #b0b0b0;
  }

  .interval-unit {
    background-color: #2d2d2d;
    border-left-color: #404040;
    color: #b0b0b0;
  }

  .verification-unified-control {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .checkbox-label {
    color: #b0b0b0;
  }

  .verification-count-control {
    background-color: rgba(45, 45, 45, 0.7);
    border-left-color: #404040;
  }

  .count-label {
    color: #b0b0b0;
  }

  .status-section {
    background-color: #2d2d2d;
    border-top-color: #404040;
  }

  .status-label {
    color: #e0e0e0;
  }

  .status-value {
    color: #b0b0b0;
  }

  .status-value.internal {
    color: #4caf50;
  }
}
</style>