<template>
  <div class="left-panel">
    <div class="login-section">
      <div v-if="isVerifyingToken" class="verifying-state">
        <h3>{{ $t('auth.verifying') }}</h3>
        <p>{{ $t('auth.verifyingMessage') }}</p>
        <div class="loading-spinner"></div>
      </div>
      <div v-else-if="!isLoggedIn" class="login-form">
        <h3>{{ $t('auth.signIn') }}</h3>
        <p>{{ $t('auth.signInMessage') }}</p>
        <div class="input-group">
          <input
            v-model="username"
            type="text"
            :placeholder="$t('auth.username')"
            class="input-field"
          />
          <input
            v-model="password"
            type="password"
            :placeholder="$t('auth.password')"
            class="input-field"
          />
        </div>
        <div class="login-buttons">
          <button @click="login" :disabled="isLoading" class="login-btn">
            {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
          </button>
          <button @click="openBrowserLogin" class="browser-login-btn">
            {{ $t('auth.signInWithBrowser') }}
          </button>
        </div>
      </div>
      <div v-else ref="userInfoRef" class="user-info">
        <button type="button" class="user-banner" :class="{ open: showUserMenu }" @click="toggleUserMenu">
          <span class="user-avatar">{{ userInitial }}</span>
          <span class="user-banner-name">{{
            showUserMenu && isChineseName
              ? `${displayNickname} (${userNickname})`
              : displayNickname
          }}</span>
          <svg
            class="user-banner-chevron"
            :class="{ open: showUserMenu }"
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

        <div v-if="showUserMenu" class="user-menu">
          <p class="user-menu-username">{{ $t('auth.signInAs', { userId }) }}</p>
          <p class="user-menu-message">{{ $t('auth.accessMessage') }}</p>
          <button class="logout-btn user-menu-signout" @click="handleSignOut">{{ $t('auth.signOut') }}</button>
        </div>
      </div>
    </div>

    <div class="control-section">
      <div class="control-header">
        <h3>{{ $t('settings.settings') }}</h3>
        <button @click="openAdvancedSettings" class="advanced-btn">
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
            <button @click="openOutputDirectory" class="reset-btn" :title="$t('settings.openFolder')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          <div class="directory-input-group">
            <input
              v-model="outputDirectory"
              type="text"
              readonly
              class="directory-input"
              :title="outputDirectory"
            />
            <button @click="selectOutputDirectory" class="browse-btn">{{ $t('settings.browse') }}</button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.connectionMode') }}</label>
          <div class="mode-toggle">
            <button
              @click="setConnectionMode('internal')"
              :class="['mode-btn', { active: connectionMode === 'internal' }]"
            >
              {{ $t('settings.internalNetwork') }}
            </button>
            <button
              @click="setConnectionMode('external')"
              :class="['mode-btn', { active: connectionMode === 'external' }]"
            >
              {{ $t('settings.externalNetwork') }}
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.audioMode') }}</label>
          <div class="audio-mode-selector">
            <select v-model="muteMode" @change="setMuteMode" class="audio-mode-select">
              <option value="normal">{{ $t('settings.normal') }}</option>
              <option value="mute_all">{{ $t('settings.muteAll') }}</option>
              <option value="mute_live">{{ $t('settings.muteLive') }}</option>
              <option value="mute_recorded">{{ $t('settings.muteRecorded') }}</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideDetectionInterval') }}</label>
            <button @click="resetSlideDetectionInterval" class="reset-btn" :title="$t('settings.resetToDefault')">
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
                v-model.number="slideCheckInterval"
                type="number"
                min="500"
                max="10000"
                step="500"
                class="slide-interval-input"
                @change="setSlideCheckInterval"
                @blur="validateAndCorrectInterval"
              />
              <span class="interval-unit">{{ $t('settings.milliseconds') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label-with-reset">
            <label class="setting-label">{{ $t('settings.slideStabilityVerification') }}</label>
            <button @click="resetSlideStabilityVerification" class="reset-btn" :title="$t('settings.resetToDefault')">
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
                v-model="slideDoubleVerification"
                @change="setSlideDoubleVerification"
              />
              {{ $t('settings.enableChecks') }}
            </label>
            <div class="verification-count-control" v-if="slideDoubleVerification">
              <select
                v-model="slideVerificationCount"
                @change="setSlideDoubleVerification"
                class="verification-count-select"
              >
                <option v-for="i in 5" :key="i" :value="i">{{ i }}</option>
              </select>
              <span class="count-label">{{ $t('settings.counts') }}</span>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.taskSpeed') }}</label>
          <div class="setting-description">{{ $t('settings.taskSpeedDescription') }}</div>
          <div class="task-speed-selector">
            <select v-model="taskSpeed" @change="setTaskSpeed" class="task-speed-select">
              <option :value="1">1x</option>
              <option :value="2">2x</option>
              <option :value="3">3x</option>
              <option :value="4">4x</option>
              <option :value="5">5x</option>
              <option :value="6">6x</option>
              <option :value="7">7x</option>
              <option :value="8">8x</option>
              <option :value="9">9x</option>
              <option :value="10">10x</option>
              <option :value="11">11x</option>
              <option :value="12">12x</option>
              <option :value="13">13x</option>
              <option :value="14">14x</option>
              <option :value="15">15x</option>
              <option :value="16">16x</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('settings.autoPostProcessing') }}</label>
          <div class="setting-description">{{ $t('settings.autoPostProcessingDescription') }}</div>
          <div class="auto-post-processing-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="autoPostProcessingLive"
                @change="setAutoPostProcessingLive"
              />
              {{ $t('settings.enableAutoPostProcessingLive') }}
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="autoPostProcessing"
                @change="setAutoPostProcessing"
              />
              {{ $t('settings.enableAutoPostProcessingRecorded') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <!-- Action Buttons Row -->
      <!-- Tools Launcher -->
      <div class="tools-dropdown">
        <button class="tools-trigger" @click="openToolsWindow()">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M1 3h4v4H1V3zm5 0h4v4H6V3zm5 0h4v4h-4V3zM1 9h4v4H1V9zm5 0h4v4H6V9zm5 0h4v4h-4V9z" fill="currentColor"/>
          </svg>
          <span>{{ $t('tools.openTools') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <!-- Add-ons Launcher -->
      <div class="tools-dropdown addons-dropdown">
        <button class="tools-trigger" @click="openAddonsWindow()">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
          </svg>
          <span>{{ $t('addons.openAddons') }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" class="tools-chevron">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      <div class="status-row">
        <span class="status-label">{{ $t('status.taskStatus') }}</span>
        <span class="status-value">{{ taskStatus }}</span>
      </div>
      <div class="status-row">
        <span class="status-label">{{ $t('status.downloadQueue') }}</span>
        <span class="status-value">{{ downloadQueueStatus }}</span>
      </div>
    </div>

    <div v-if="showAdvancedModal" class="modal-overlay" @click="closeAdvancedSettings">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('settings.advancedSettings') }}</h3>
          <button @click="closeAdvancedSettings" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Tab Navigation -->
          <div class="advanced-tabs">
            <button
              v-for="tab in advancedSettingsTabs"
              :key="tab.id"
              @click="activeAdvancedTab = tab.id"
              :class="['tab-btn', { active: activeAdvancedTab === tab.id }]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path v-if="tab.id === 'general'" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle v-if="tab.id === 'general'" cx="12" cy="12" r="3"/>
                <path v-if="tab.id === 'imageProcessing'" d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle v-if="tab.id === 'imageProcessing'" cx="12" cy="13" r="3"/>
                <polygon v-if="tab.id === 'playback'" points="5 3 19 12 5 21 5 3"/>
                <path v-if="tab.id === 'network'" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                <path v-if="tab.id === 'network'" d="M2 12h20"/>
                <path v-if="tab.id === 'network'" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <!-- AI tab icon (brain/chip) -->
                <rect v-if="tab.id === 'ai'" x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <path v-if="tab.id === 'ai'" d="M9 9h.01"/>
                <path v-if="tab.id === 'ai'" d="M15 9h.01"/>
                <path v-if="tab.id === 'ai'" d="M9 15h.01"/>
                <path v-if="tab.id === 'ai'" d="M15 15h.01"/>
                <path v-if="tab.id === 'ai'" d="M12 9v6"/>
                <path v-if="tab.id === 'ai'" d="M9 12h6"/>
              </svg>
              {{ $t(`advanced.tabs.${tab.id}`) }}
            </button>
          </div>

          <div class="advanced-settings-content">
            <!-- General Tab -->
            <div v-show="activeAdvancedTab === 'general'" class="tab-content">
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
            </div>

            <!-- Image Processing Tab -->
            <div v-show="activeAdvancedTab === 'imageProcessing'" class="tab-content">
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.imageOutput') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.enablePngColorReduction') }}</label>
                <div class="setting-description">{{ $t('advanced.pngColorReductionDescription') }}</div>
                <div class="image-output-options">
                  <label class="image-output-toggle-item">
                    <input
                      type="checkbox"
                      v-model="tempEnablePngColorReduction"
                    />
                    <span class="image-output-toggle-text">{{ $t('advanced.enablePngColorReduction') }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.imageProcessing') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.ssimThreshold') }}</label>
                <div class="setting-description">{{ $t('advanced.ssimDescription') }}</div>
                <div class="ssim-input-group">
                  <input
                    v-model.number="tempSsimThreshold"
                    type="number"
                    min="0.9"
                    max="1.0"
                    step="0.0001"
                    class="ssim-input"
                    @input="onSsimInputChange"
                  />
                  <select
                    v-model="ssimPreset"
                    @change="onSsimPresetChange"
                    class="ssim-preset-select"
                  >
                    <option value="adaptive">{{ $t('advanced.ssimPresets.adaptive') }}</option>
                    <option value="strict">{{ $t('advanced.ssimPresets.strict') }}</option>
                    <option value="normal">{{ $t('advanced.ssimPresets.normal') }}</option>
                    <option value="loose">{{ $t('advanced.ssimPresets.loose') }}</option>
                    <option value="custom">{{ $t('advanced.ssimPresets.custom') }}</option>
                  </select>
                </div>
                <div class="setting-description">{{ $t('advanced.ssimWarning') }}</div>

                <!-- Classroom Rules Information -->
                <div class="classroom-rules-info">
                  <div class="rules-title">{{ $t('advanced.classroomRules.title') }}</div>
                  <div class="rules-description">{{ $t('advanced.classroomRules.description') }}</div>
                  <ul class="rules-list">
                    <li class="rule-item">
                      <span class="rule-condition">{{ $t('advanced.classroomRules.rule1.condition') }}</span>
                      <span class="rule-arrow">→</span>
                      <span class="rule-action">{{ $t('advanced.classroomRules.rule1.action') }}</span>
                    </li>
                    <li class="rule-item">
                      <span class="rule-condition">{{ $t('advanced.classroomRules.rule2.condition') }}</span>
                      <span class="rule-arrow">→</span>
                      <span class="rule-action">{{ $t('advanced.classroomRules.rule2.action') }}</span>
                    </li>
                    <li class="rule-item">
                      <span class="rule-condition">{{ $t('advanced.classroomRules.rule3.condition') }}</span>
                      <span class="rule-arrow">→</span>
                      <span class="rule-action">{{ $t('advanced.classroomRules.rule3.action') }}</span>
                    </li>
                  </ul>
                  <div class="rules-reason">{{ $t('advanced.classroomRules.reason') }}</div>
                </div>
              </div>

              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.enableDownsampling') }}</label>
                <div class="setting-description">{{ $t('advanced.downsamplingDescription') }}</div>
                <div class="downsampling-controls">
                  <div class="downsampling-control">
                    <label class="checkbox-label">
                      <input
                        v-model="tempEnableDownsampling"
                        type="checkbox"
                      />
                      {{ $t('advanced.enableDownsampling') }}
                    </label>
                    <div v-if="tempEnableDownsampling" class="downsampling-presets">
                      <button
                        v-for="preset in downsamplingPresets"
                        :key="preset.key"
                        @click="selectDownsamplingPreset(preset)"
                        :class="['preset-btn', { active: tempSelectedDownsamplingPreset === preset.key }]"
                      >
                        {{ preset.label }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.postProcessing') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.postProcessingPhases') }}</label>
                <div class="post-processing-phases-list">
                  <label class="phase-toggle-item">
                    <input
                      type="checkbox"
                      v-model="tempEnableDuplicateRemoval"
                    />
                    <span class="phase-toggle-text">{{ $t('advanced.enableDuplicateRemoval') }}</span>
                  </label>
                  <label class="phase-toggle-item">
                    <input
                      type="checkbox"
                      v-model="tempEnableExclusionList"
                    />
                    <span class="phase-toggle-text">{{ $t('advanced.enableExclusionList') }}</span>
                  </label>
                  <label class="phase-toggle-item">
                    <input
                      type="checkbox"
                      v-model="tempEnableAIFiltering"
                    />
                    <span class="phase-toggle-text">{{ $t('advanced.enableAIFiltering') }}</span>
                  </label>
                </div>
                <div v-if="tempEnableAIFiltering" class="setting-description ai-reminder">
                  {{ $t('advanced.aiFilteringReminder') }}
                </div>
              </div>

              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.pHashThreshold') }}</label>
                <div class="setting-description">{{ $t('advanced.pHashDescription') }}</div>
                <div class="phash-threshold-input-wrapper">
                  <input
                    v-model.number="tempPHashThreshold"
                    type="number"
                    min="0"
                    max="256"
                    step="1"
                    class="phash-threshold-input"
                  />
                  <span class="threshold-unit">{{ $t('advanced.hammingDistance') }}</span>
                </div>
              </div>

              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.pHashExclusionList') }}</label>
                <div class="setting-description">{{ $t('advanced.pHashExclusionDescription') }}</div>

                <!-- Exclusion list display -->
                <div class="exclusion-list-container">
                  <div v-if="pHashExclusionList.length === 0" class="exclusion-list-empty">
                    {{ $t('advanced.noExclusionItems') }}
                  </div>
                  <div v-else class="exclusion-list">
                    <div
                      v-for="item in pHashExclusionList"
                      :key="item.id"
                      :class="['exclusion-item', {
                        'preset-item': item.isPreset,
                        'disabled-item': item.isPreset && !item.isEnabled
                      }]"
                    >
                      <div class="exclusion-item-info">
                        <div class="exclusion-item-name">
                          <span v-if="item.isPreset" class="preset-badge">{{ $t('advanced.presetLabel') }}</span>
                          {{ item.name }}
                        </div>
                        <div class="exclusion-item-hash" :title="item.pHash">{{ item.pHash }}</div>
                      </div>
                      <div class="exclusion-item-actions">
                        <button
                          v-if="!item.isPreset"
                          @click="editExclusionItemName(item)"
                          class="exclusion-edit-btn"
                          :title="$t('advanced.editName')"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          @click="removeExclusionItem(item.id)"
                          :class="item.isPreset ? 'exclusion-toggle-btn' : 'exclusion-remove-btn'"
                          :title="item.isPreset ? (item.isEnabled ? $t('advanced.disableItem') : $t('advanced.enableItem')) : $t('advanced.removeItem')"
                        >
                          <svg v-if="item.isPreset" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <template v-if="item.isEnabled">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M9 12l2 2 4-4"/>
                            </template>
                            <template v-else>
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </template>
                          </svg>
                          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Add new exclusion item -->
                <div class="exclusion-actions">
                  <button
                    @click="addExclusionItem"
                    :disabled="isAddingExclusion"
                    class="exclusion-add-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {{ isAddingExclusion ? $t('advanced.processing') : $t('advanced.addExclusionItem') }}
                  </button>
                  <button
                    v-if="pHashExclusionList.length > 0"
                    @click="clearExclusionList"
                    class="exclusion-clear-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    {{ $t('advanced.clearAll') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.autoCrop.title') }}</h4>
              <div class="setting-description">{{ $t('advanced.autoCrop.description') }}</div>

              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.autoCrop.detectorMode') }}</label>
                <div class="setting-description">{{ $t('advanced.autoCrop.detectorModeDescription') }}</div>
                <select v-model="tempAutoCropDetectorMode" class="concurrent-select">
                  <option value="canny_then_yolo">{{ $t('advanced.autoCrop.cannyThenYolo') }}</option>
                  <option value="canny_only">{{ $t('advanced.autoCrop.cannyOnly') }}</option>
                  <option value="yolo_only">{{ $t('advanced.autoCrop.yoloOnly') }}</option>
                </select>
              </div>

              <div v-if="tempAutoCropDetectorMode !== 'yolo_only'" class="advanced-setting-subsection">
                <h5>{{ $t('advanced.autoCrop.canny.title') }}</h5>

                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.autoCrop.aspectTolerance') }}</label>
                  <div class="setting-description">{{ $t('advanced.autoCrop.aspectToleranceDescription') }}</div>
                  <div class="slide-interval-input-wrapper">
                    <input v-model.number="tempAutoCropAspectTolerance" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
                  </div>
                </div>

                <div class="auto-crop-grid">
                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.blackThreshold') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.blackThresholdDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropBlackThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
                      <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.maxBorderFrac') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.maxBorderFracDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropMaxBorderFrac" type="number" min="0" max="0.5" step="0.01" class="slide-interval-input" />
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.cannyLowThreshold') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.cannyLowThresholdDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropCannyLowThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
                      <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.cannyHighThreshold') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.cannyHighThresholdDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropCannyHighThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
                      <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMin') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMinDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropAreaRatioMin" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMax') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMaxDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropAreaRatioMax" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.marginFrac') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.marginFracDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropMarginFrac" type="number" min="0" max="0.5" step="0.005" class="slide-interval-input" />
                    </div>
                  </div>

                  <div class="setting-item">
                    <label class="setting-label">{{ $t('advanced.autoCrop.fillRatioMin') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.fillRatioMinDescription') }}</div>
                    <div class="slide-interval-input-wrapper">
                      <input v-model.number="tempAutoCropFillRatioMin" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="tempAutoCropDetectorMode !== 'canny_only'" class="advanced-setting-subsection">
                <h5>{{ $t('advanced.autoCrop.yolo.title') }}</h5>

                <div class="auto-crop-grid">
                  <div class="setting-item full-width">
                    <label class="setting-label">{{ $t('advanced.autoCrop.yolo.confidenceThreshold') }}</label>
                    <div class="setting-description">{{ $t('advanced.autoCrop.yolo.confidenceThresholdDescription') }}</div>
                    <div class="slide-interval-group">
                      <div class="slide-interval-input-wrapper">
                        <input
                          v-model.number="tempAutoCropYoloConfidenceThreshold"
                          type="number"
                          min="0.05"
                          max="0.95"
                          step="0.05"
                          class="slide-interval-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="setting-item full-width">
                    <div class="two-col-row">
                      <div class="two-col-item">
                        <label class="setting-label">{{ $t('advanced.autoCrop.yolo.iouThreshold') }}</label>
                        <div class="setting-description">{{ $t('advanced.autoCrop.yolo.iouThresholdDescription') }}</div>
                        <div class="slide-interval-group">
                          <div class="slide-interval-input-wrapper">
                            <input
                              v-model.number="tempAutoCropYoloIouThreshold"
                              type="number"
                              min="0.1"
                              max="0.9"
                              step="0.05"
                              class="slide-interval-input"
                            />
                          </div>
                        </div>
                      </div>

                      <div class="two-col-item">
                        <label class="setting-label">{{ $t('advanced.autoCrop.yolo.inputSize') }}</label>
                        <div class="setting-description">{{ $t('advanced.autoCrop.yolo.inputSizeDescription') }}</div>
                        <div class="slide-interval-group">
                          <div class="slide-interval-input-wrapper">
                            <select v-model.number="tempAutoCropYoloInputSize" class="slide-interval-select">
                              <option v-for="s in autoCropYoloInputSizes" :key="s" :value="s">{{ s }}</option>
                            </select>
                            <span class="interval-unit">px</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.autoCrop.yolo.model.title') }}</label>
                  <div class="setting-description">{{ $t('advanced.autoCrop.yolo.model.hint') }}</div>
                  <div class="model-row" v-if="autoCropModelInfo">
                    <div class="model-info" v-if="autoCropModelInfo.active === 'custom' && autoCropModelInfo.customExists">
                      <strong>{{ $t('advanced.autoCrop.yolo.model.customLabel') }}:</strong>
                      {{ autoCropModelInfo.customName || '—' }}
                      <span v-if="autoCropModelInfo.customSizeBytes" class="model-size">
                        ({{ formatCacheSize(autoCropModelInfo.customSizeBytes) }})
                      </span>
                    </div>
                    <div class="model-info" v-else>
                      <strong>{{ $t('advanced.autoCrop.yolo.model.builtinLabel') }}:</strong>
                      {{ autoCropModelInfo.builtinVersion }}
                      <span v-if="autoCropModelInfo.builtinSizeBytes" class="model-size">
                        ({{ formatCacheSize(autoCropModelInfo.builtinSizeBytes) }})
                      </span>
                    </div>
                    <div class="model-actions">
                      <button type="button" class="secondary-btn" @click="selectAutoCropCustomModel">
                        {{ $t('advanced.autoCrop.yolo.model.selectButton') }}
                      </button>
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!autoCropModelInfo.customExists"
                        @click="deleteAutoCropCustomModel"
                      >
                        {{ $t('advanced.autoCrop.yolo.model.deleteButton') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>


            </div>
            </div>

            <!-- Playback Tab -->
            <div v-show="activeAdvancedTab === 'playback'" class="tab-content">
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.videoPlayback') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.videoErrorRetryCount') }}</label>
                <div class="setting-description">{{ $t('advanced.videoErrorDescription') }}</div>
                <select
                  v-model="tempVideoRetryCount"
                  class="concurrent-select"
                  @change="updateVideoRetryCount"
                >
                  <option v-for="i in 6" :key="i" :value="i + 4">{{ i + 4 }}</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.showMorePlaybackSpeed') }}</label>
                <div class="setting-description">{{ $t('advanced.showMorePlaybackSpeedDescription') }}</div>
                <div class="prevent-sleep-control">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      v-model="showMorePlaybackSpeed"
                      @change="setShowMorePlaybackSpeed"
                    />
                    {{ $t('advanced.enableShowMorePlaybackSpeed') }}
                  </label>
                </div>
              </div>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.preventSystemSleep') }}</label>
                <div class="setting-description">{{ $t('advanced.preventSystemSleepDescription') }}</div>
                <div class="prevent-sleep-control">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      v-model="preventSystemSleep"
                      @change="setPreventSystemSleep"
                    />
                    {{ $t('advanced.enablePreventSleep') }}
                  </label>
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.download') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.concurrentDownloadLimit') }}</label>
                <div class="setting-description">{{ $t('advanced.concurrentDownloadDescription') }}</div>
                <select
                  v-model="tempMaxConcurrentDownloads"
                  class="concurrent-select"
                  @change="updateMaxConcurrentDownloads"
                >
                  <option v-for="i in 10" :key="i" :value="i">{{ i }}</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.downloadMaxWorkers') }}</label>
                <div class="setting-description">{{ $t('advanced.downloadMaxWorkersDescription') }}</div>
                <select
                  v-model="tempDownloadMaxWorkers"
                  class="concurrent-select"
                  @change="updateDownloadMaxWorkers"
                >
                  <option v-for="v in [1, 2, 4, 8, 16, 32]" :key="v" :value="v">{{ v }}</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.downloadNumRetries') }}</label>
                <select
                  v-model="tempDownloadNumRetries"
                  class="concurrent-select"
                  @change="updateDownloadNumRetries"
                >
                  <option v-for="v in [5, 10, 15, 20, 30]" :key="v" :value="v">{{ v }}</option>
                </select>
              </div>
            </div>
            </div>

            <!-- Network Tab -->
            <div v-show="activeAdvancedTab === 'network'" class="tab-content">
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.intranetInterface') }}</h4>
              <div class="setting-item">
                <div class="setting-description">{{ $t('advanced.intranetInterfaceDescription') }}</div>
                <div class="intranet-interface-row">
                  <select v-model="tempIntranetInterfaceIp" class="intranet-interface-select">
                    <option value="">{{ $t('advanced.intranetInterfaceSystemDefault') }}</option>
                    <option
                      v-for="iface in availableNetworkInterfaces"
                      :key="iface.name + '-' + iface.address"
                      :value="iface.address"
                    >
                      {{ iface.name }} — {{ iface.address }}
                    </option>
                    <option
                      v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
                      :value="tempIntranetInterfaceIp"
                    >
                      {{ tempIntranetInterfaceIp }}
                    </option>
                  </select>
                  <button type="button" class="refresh-button" @click="refreshNetworkInterfaces">
                    {{ $t('advanced.intranetInterfaceRefresh') }}
                  </button>
                </div>
                <div
                  v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
                  class="intranet-interface-warning"
                >
                  {{ $t('advanced.intranetInterfaceNotFound') }}
                </div>
              </div>
            </div>
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.intranetMapping') }}</h4>
              <div class="setting-item">
                <div class="setting-description">{{ $t('advanced.intranetMappingDescription') }}</div>
                <div class="intranet-mapping-list">
                  <div v-for="(mapping, domain) in intranetMappings" :key="String(domain)" class="mapping-item">
                    <div class="mapping-header" @click="toggleMappingExpanded(String(domain))">
                      <div class="mapping-domain">{{ domain }}</div>
                      <div class="mapping-type">
                        <span class="type-badge" :class="mapping.type">
                          {{ mapping.type === 'single' ? $t('advanced.singleIP') : $t('advanced.loadBalance') }}
                        </span>
                      </div>
                      <div class="mapping-expand-icon" :class="{ expanded: expandedMappings[String(domain)] }">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                      </div>
                    </div>
                    <div v-if="expandedMappings[String(domain)]" class="mapping-details">
                      <div v-if="mapping.type === 'single'" class="single-ip-details">
                        <div class="detail-row">
                          <span class="detail-label">{{ $t('advanced.ipAddresses') }}:</span>
                          <span class="detail-value">{{ mapping.ip }}</span>
                        </div>
                      </div>
                      <div v-else class="load-balance-details">
                        <div class="detail-row">
                          <span class="detail-label">{{ $t('advanced.strategy') }}:</span>
                          <span class="detail-value">
                            {{ getStrategyDisplayName(mapping.strategy) }}
                          </span>
                        </div>
                        <div class="detail-row">
                          <span class="detail-label">{{ $t('advanced.ipAddresses') }}:</span>
                          <div class="ip-list">
                            <span v-for="ip in mapping.ips" :key="ip" class="ip-item">
                              {{ ip }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <!-- AI Tab -->
            <div v-show="activeAdvancedTab === 'ai'" class="tab-content">

            <!-- Classifier Mode Toggle -->
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.ai.ml.classifierMode') }}</h4>
              <div class="setting-item">
                <div class="setting-description">{{ $t('advanced.ai.ml.classifierModeDescription') }}</div>
                <div class="ai-service-type-selector">
                  <button
                    @click="tempAiClassifierMode = 'llm'"
                    :class="['mode-btn', { active: tempAiClassifierMode === 'llm' }]"
                  >
                    {{ $t('advanced.ai.ml.modeLlm') }}
                  </button>
                  <button
                    @click="tempAiClassifierMode = 'ml'"
                    :class="['mode-btn', { active: tempAiClassifierMode === 'ml' }]"
                  >
                    {{ $t('advanced.ai.ml.modeMl') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- ML Classifier Panel (shown only in ML mode) -->
            <template v-if="tempAiClassifierMode === 'ml'">
              <div class="advanced-setting-section">
                <h4>{{ $t('advanced.ai.ml.modelTitle') }}</h4>
                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.ai.ml.modelLabel') }}</label>
                  <div class="setting-description">{{ $t('advanced.ai.ml.modelHint') }}</div>
                  <div class="model-row" v-if="mlModelInfo">
                    <div class="model-info" v-if="mlModelInfo.active === 'custom' && mlModelInfo.customExists">
                      <strong>{{ $t('advanced.autoCrop.yolo.model.customLabel') }}:</strong>
                      {{ mlModelInfo.customName || '—' }}
                      <span v-if="mlModelInfo.customSizeBytes" class="model-size">
                        ({{ formatCacheSize(mlModelInfo.customSizeBytes) }})
                      </span>
                    </div>
                    <div class="model-info" v-else>
                      <strong>{{ $t('advanced.autoCrop.yolo.model.builtinLabel') }}:</strong>
                      {{ mlModelInfo.builtinVersion }}
                      <span v-if="mlModelInfo.builtinSizeBytes" class="model-size">
                        ({{ formatCacheSize(mlModelInfo.builtinSizeBytes) }})
                      </span>
                    </div>
                    <div class="model-actions">
                      <button type="button" class="secondary-btn" @click="importCustomMlModel">
                        {{ $t('advanced.autoCrop.yolo.model.selectButton') }}
                      </button>
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!mlModelInfo.customExists"
                        @click="deleteCustomMlModel"
                      >
                        {{ $t('advanced.autoCrop.yolo.model.deleteButton') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="advanced-setting-section">
                <h4>{{ $t('advanced.ai.ml.thresholdsTitle') }}</h4>
                <div class="setting-description">{{ $t('advanced.ai.ml.thresholdsHint') }}</div>
                <div class="setting-item">
                  <MlThresholdSlider
                    :trustLow="tempMlThresholds.trustLow"
                    :trustHigh="tempMlThresholds.trustHigh"
                    :slideCheckLow="tempMlThresholds.slideCheckLow"
                    @update:trustLow="v => tempMlThresholds = { ...tempMlThresholds, trustLow: v }"
                    @update:trustHigh="v => tempMlThresholds = { ...tempMlThresholds, trustHigh: v }"
                    @update:slideCheckLow="v => tempMlThresholds = { ...tempMlThresholds, slideCheckLow: v }"
                  />
                </div>
              </div>
            </template>

            <!-- LLM Service Settings (hidden in ML mode) -->
            <template v-if="tempAiClassifierMode === 'llm'">
            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.ai.serviceSettings') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.ai.serviceType') }}</label>
                <div class="setting-description">
                  {{ $t('advanced.ai.serviceTypeDescription') }}
                  <a href="#" @click.prevent="openCustomServiceDocs" class="external-link">{{ $t('advanced.ai.customServiceDocsLink') }}</a>
                </div>
                <div class="ai-service-type-selector">
                  <button
                    @click="tempAiServiceType = 'builtin'"
                    :class="['mode-btn', { active: tempAiServiceType === 'builtin' }]"
                  >
                    {{ $t('advanced.ai.builtin') }}
                  </button>
                  <button
                    @click="tempAiServiceType = 'copilot'"
                    :class="['mode-btn', { active: tempAiServiceType === 'copilot' }]"
                  >
                    {{ $t('advanced.ai.copilot') }}
                  </button>
                  <button
                    @click="tempAiServiceType = 'custom'"
                    :class="['mode-btn', { active: tempAiServiceType === 'custom' }]"
                  >
                    {{ $t('advanced.ai.custom') }}
                  </button>
                </div>
              </div>

              <!-- Built-in Model Info (shown only when builtin is selected) -->
              <div v-if="tempAiServiceType === 'builtin'" class="builtin-model-info">
                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.ai.builtinModel') }}</label>
                  <div class="builtin-model-display">
                    <div v-if="isLoadingBuiltinModel" class="model-loading">
                      <div class="loading-spinner-small"></div>
                      <span>{{ $t('advanced.ai.loadingModel') }}</span>
                    </div>
                    <div v-else-if="builtinModelError === 'notLoggedIn'" class="model-error">
                      <span>{{ $t('advanced.ai.modelNotLoggedIn') }}</span>
                    </div>
                    <div v-else-if="builtinModelError === 'cloudflareBlocked'" class="model-error cloudflare-error">
                      <span>{{ $t('advanced.ai.modelCloudflareBlocked') }}</span>
                      <button @click="refreshBuiltinModel" class="refresh-btn" :title="$t('advanced.ai.refreshModel')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M3 21v-5h5"/>
                        </svg>
                      </button>
                    </div>
                    <div v-else-if="builtinModelError === 'fetchFailed'" class="model-error">
                      <span>{{ $t('advanced.ai.modelFetchFailed') }}</span>
                      <button @click="refreshBuiltinModel" class="refresh-btn" :title="$t('advanced.ai.refreshModel')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M3 21v-5h5"/>
                        </svg>
                      </button>
                    </div>
                    <div v-else class="model-name-display">
                      <span class="model-name">{{ builtinModelName || $t('advanced.ai.modelUnknown') }}</span>
                      <button @click="refreshBuiltinModel" class="refresh-btn" :title="$t('advanced.ai.refreshModel')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M3 21v-5h5"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <!-- Cloudflare warning hint -->
                  <div v-if="builtinModelError === 'cloudflareBlocked'" class="cloudflare-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>{{ $t('advanced.ai.cloudflareHint') }}</span>
                  </div>
                </div>
                <!-- Built-in service disclaimer -->
                <div class="builtin-disclaimer">
                  {{ $t('advanced.ai.builtinDisclaimer') }}
                </div>
              </div>

              <!-- Copilot Settings (shown only when copilot is selected) -->
              <div v-if="tempAiServiceType === 'copilot'" class="copilot-settings">
                <!-- Authenticated state -->
                <div v-if="copilotOAuthStep === 'success'" class="copilot-user-info">
                  <div class="copilot-user-row">
                    <img v-if="copilotAvatarUrl" :src="copilotAvatarUrl" class="copilot-avatar" alt="" />
                    <span class="copilot-username">{{ copilotUsername }}</span>
                    <button @click="disconnectCopilot" class="copilot-disconnect-btn">
                      {{ $t('advanced.ai.copilotDisconnect') }}
                    </button>
                  </div>
                </div>

                <!-- Idle / Error state -->
                <div v-else-if="copilotOAuthStep === 'idle' || copilotOAuthStep === 'error'" class="copilot-auth-section">
                  <button @click="startCopilotOAuth" class="copilot-oauth-btn" :disabled="isCopilotLoading">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    {{ $t('advanced.ai.copilotSignInWithGitHub') }}
                  </button>

                  <div class="copilot-or-divider">
                    <span>{{ $t('advanced.ai.or') }}</span>
                  </div>

                  <div class="copilot-manual-token">
                    <div class="api-key-input-group">
                      <input
                        v-model="tempCopilotGhoToken"
                        :type="showCopilotToken ? 'text' : 'password'"
                        class="api-key-input"
                        :placeholder="$t('advanced.ai.copilotTokenPlaceholder')"
                      />
                      <button @click="showCopilotToken = !showCopilotToken" class="api-key-toggle-btn">
                        <svg v-if="showCopilotToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                      <button
                        @click="validateCopilotToken(tempCopilotGhoToken)"
                        class="copilot-verify-btn"
                        :disabled="!tempCopilotGhoToken || isCopilotLoading"
                      >
                        <div v-if="isCopilotLoading" class="loading-spinner-small"></div>
                        <span v-else>{{ $t('advanced.ai.copilotAuth') }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Error messages -->
                  <div v-if="copilotOAuthError" class="copilot-error">
                    <span v-if="copilotOAuthError === 'expired_token'">{{ $t('advanced.ai.copilotDeviceCodeExpired') }}</span>
                    <span v-else-if="copilotOAuthError === 'access_denied'">{{ $t('advanced.ai.copilotAccessDenied') }}</span>
                    <span v-else-if="copilotOAuthError === 'invalid_token'">{{ $t('advanced.ai.copilotInvalidToken') }}</span>
                    <span v-else>{{ copilotOAuthError }}</span>
                  </div>
                </div>

                <!-- Waiting / Polling state -->
                <div v-else-if="copilotOAuthStep === 'waiting' || copilotOAuthStep === 'polling'" class="copilot-waiting">
                  <div class="copilot-enter-code-label">
                    {{ $t('advanced.ai.copilotEnterCode') }}
                    <a class="copilot-verification-url" @click.prevent="openCopilotVerificationUrl" :title="copilotVerificationUri">{{ copilotVerificationUri }}</a>
                  </div>
                  <div class="copilot-user-code" @click="copyUserCode" :title="$t('advanced.ai.copilotClickToCopy')">
                    <span>{{ copilotUserCode }}</span>
                    <span class="copilot-code-copied" v-if="copilotCodeCopied">{{ $t('advanced.ai.copilotCopied') }}</span>
                  </div>
                  <div class="copilot-waiting-status">
                    <div class="loading-spinner-small"></div>
                    <span>{{ $t('advanced.ai.copilotWaitingForAuth') }}</span>
                    <button class="copilot-cancel-btn" @click="cancelCopilotOAuth" :title="$t('advanced.ai.copilotCancel')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Model name input (always visible in copilot mode) -->
                <div class="setting-item copilot-model-setting">
                  <label class="setting-label">{{ $t('advanced.ai.modelName') }}</label>
                  <div class="model-name-input-group">
                    <input
                      v-model="tempCopilotModelName"
                      type="text"
                      class="model-name-input"
                      :placeholder="$t('advanced.ai.copilotModelPlaceholder')"
                    />
                    <select v-model="selectedCopilotModelPreset" @change="onCopilotModelPresetChange" class="model-preset-select">
                      <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
                      <option v-for="preset in copilotModelPresets" :key="preset.name" :value="preset.name">
                        {{ preset.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Custom API Settings (shown only when custom is selected) -->
              <div v-if="tempAiServiceType === 'custom'" class="custom-api-settings">
                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.ai.apiBaseUrl') }}</label>
                  <div class="api-url-input-group">
                    <input
                      v-model="tempAiCustomApiBaseUrl"
                      type="text"
                      class="api-url-input"
                      :placeholder="$t('advanced.ai.apiBaseUrlPlaceholder')"
                    />
                    <select v-model="selectedApiUrlPreset" @change="onApiUrlPresetChange" class="api-url-preset-select">
                      <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
                      <option v-for="preset in apiUrlPresets" :key="preset.url" :value="preset.url">
                        {{ preset.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">{{ $t('advanced.ai.apiKey') }}</label>
                  <div class="api-key-input-group">
                    <input
                      v-model="tempAiCustomApiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      class="api-key-input"
                      :placeholder="$t('advanced.ai.apiKeyPlaceholder')"
                    />
                    <button @click="showApiKey = !showApiKey" class="api-key-toggle-btn" :title="showApiKey ? $t('advanced.hideToken') : $t('advanced.showToken')">
                      <svg v-if="showApiKey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="setting-item" v-if="currentCustomProvider !== 'modelscope'">
                  <label class="setting-label">{{ $t('advanced.ai.modelName') }}</label>
                  <div class="model-name-input-group">
                    <input
                      v-model="tempAiCustomModelName"
                      type="text"
                      class="model-name-input"
                      :placeholder="$t('advanced.ai.modelNamePlaceholder')"
                    />
                    <select v-model="selectedModelPreset" @change="onModelPresetChange" class="model-preset-select">
                      <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
                      <option v-for="preset in modelPresets" :key="preset.name" :value="preset.name">
                        {{ preset.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="setting-item" v-else>
                  <label class="setting-label">{{ $t('advanced.ai.modelChain') }}</label>
                  <div class="model-chain-hint">{{ $t('advanced.ai.modelChainHint') }}</div>

                  <ul v-if="tempCustomModelChain.length > 0" class="model-chain-list">
                    <li
                      v-for="(model, idx) in tempCustomModelChain"
                      :key="idx"
                      class="model-chain-row"
                      :class="{ 'is-exhausted': exhaustedModels.includes(model) }"
                    >
                      <div class="model-chain-index">{{ idx + 1 }}</div>
                      <input
                        type="text"
                        class="model-chain-input"
                        :value="model"
                        @input="updateModelAt(idx, ($event.target as HTMLInputElement).value)"
                      />
                      <div class="model-chain-badges">
                        <span v-if="idx === 0" class="model-chain-badge primary">
                          {{ $t('advanced.ai.modelChainPrimary') }}
                        </span>
                        <span v-if="exhaustedModels.includes(model)" class="model-chain-badge exhausted">
                          {{ $t('advanced.ai.modelChainExhausted') }}
                        </span>
                      </div>
                      <div class="model-chain-actions">
                        <button
                          type="button"
                          class="model-chain-move-btn"
                          :disabled="idx === 0"
                          @click="moveModelUp(idx)"
                          :title="$t('advanced.ai.modelChainMoveUp')"
                          aria-label="Move up"
                        >↑</button>
                        <button
                          type="button"
                          class="model-chain-move-btn"
                          :disabled="idx >= tempCustomModelChain.length - 1"
                          @click="moveModelDown(idx)"
                          :title="$t('advanced.ai.modelChainMoveDown')"
                          aria-label="Move down"
                        >↓</button>
                        <button
                          type="button"
                          class="model-chain-remove-btn"
                          @click="removeModelAt(idx)"
                          :title="$t('advanced.ai.modelChainRemove')"
                          aria-label="Remove"
                        >×</button>
                      </div>
                    </li>
                  </ul>
                  <div v-else class="model-chain-empty">{{ $t('advanced.ai.modelChainEmpty') }}</div>

                  <div class="model-chain-add-row">
                    <input
                      v-model="newModelInput"
                      type="text"
                      class="model-chain-add-input"
                      :placeholder="$t('advanced.ai.modelChainAddPlaceholder')"
                      @keydown.enter.prevent="addPendingModel"
                    />
                    <select
                      v-model="selectedAddPreset"
                      @change="onAddPresetSelect"
                      class="model-chain-preset-select"
                    >
                      <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
                      <option
                        v-for="preset in modelPresetsByProvider.modelscope"
                        :key="preset.name"
                        :value="preset.name"
                        :disabled="tempCustomModelChain.includes(preset.name)"
                      >
                        {{ preset.label }}
                      </option>
                    </select>
                    <button
                      type="button"
                      class="model-chain-add-btn"
                      :disabled="!newModelInput.trim()"
                      @click="addPendingModel"
                    >
                      {{ $t('advanced.ai.modelChainAdd') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.ai.requestSettings') }}</h4>
              <div v-if="tempAiServiceType === 'builtin'" class="rate-limit-hint">
                {{ $t('advanced.ai.rateLimitBuiltinHint') }}
              </div>
              <div v-else-if="tempAiServiceType === 'copilot'" class="rate-limit-hint">
                {{ $t('advanced.ai.rateLimitCopilotHint') }}
              </div>
              <div v-else class="rate-limit-hint">
                {{ $t('advanced.ai.rateLimitCustomHint') }}
              </div>

              <div class="setting-item">
                <div class="two-col-row">
                  <!-- Rate Limit Setting -->
                  <div class="two-col-item">
                    <label class="setting-label">{{ $t('advanced.ai.rateLimit') }}</label>
                    <div class="slide-interval-group">
                      <div class="slide-interval-input-wrapper">
                        <input
                          v-model.number="tempAiRateLimit"
                          type="number"
                          min="1"
                          :max="maxAiRateLimit"
                          class="slide-interval-input"
                        />
                        <span class="interval-unit">{{ $t('advanced.ai.rateLimitUnit') }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Max Concurrent Requests Setting -->
                  <div class="two-col-item">
                    <label class="setting-label">{{ $t('advanced.ai.maxConcurrent') }}</label>
                    <div class="slide-interval-group">
                      <div class="slide-interval-input-wrapper">
                        <input
                          v-model.number="tempAiMaxConcurrent"
                          type="number"
                          min="1"
                          max="10"
                          class="slide-interval-input"
                        />
                        <span class="interval-unit">{{ $t('advanced.ai.maxConcurrentUnit') }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="setting-item">
                <div class="two-col-row">
                  <!-- Min Time Between Requests Setting -->
                  <div class="two-col-item">
                    <label class="setting-label">{{ $t('advanced.ai.minTime') }}</label>
                    <div class="slide-interval-group">
                      <div class="slide-interval-input-wrapper">
                        <input
                          v-model.number="tempAiMinTime"
                          type="number"
                          min="0"
                          max="60000"
                          step="100"
                          class="slide-interval-input"
                        />
                        <span class="interval-unit">{{ $t('advanced.ai.minTimeUnit') }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Batch Size Setting -->
                  <div class="two-col-item">
                    <label class="setting-label">{{ $t('advanced.ai.batchSize') }}</label>
                    <div class="slide-interval-group">
                      <div class="slide-interval-input-wrapper">
                        <input
                          v-model.number="tempAiBatchSize"
                          type="number"
                          min="1"
                          max="10"
                          class="slide-interval-input"
                          @change="updateAiBatchSize"
                        />
                        <span class="interval-unit">{{ $t('advanced.ai.batchSizeUnit') }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Image Resize Setting -->
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.ai.imageResize') }}</label>
                <div class="downsampling-controls">
                  <div class="downsampling-control">
                    <div class="downsampling-presets no-border-top">
                      <button
                        v-for="preset in imageResizePresets"
                        :key="preset.key"
                        @click="selectedImageResizePreset = preset.key; onImageResizePresetChange()"
                        :class="['preset-btn', { active: selectedImageResizePreset === preset.key }]"
                      >
                        {{ preset.label }}
                      </button>
                    </div>
                  </div>
                </div>
                <div class="setting-description">{{ $t('advanced.ai.requestSettingsHint') }}</div>
              </div>
            </div>
            </template>

            <div class="advanced-setting-section">
              <h4>{{ $t('advanced.aiBehaviour.title') }}</h4>
              <div class="setting-item">
                <label class="setting-label">{{ $t('advanced.aiBehaviour.distinguishLabel') }}</label>
                <div class="setting-description">{{ $t('advanced.aiBehaviour.distinguishDescription') }}</div>
                <div class="prevent-sleep-control">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="tempDistinguishMaybeSlide" />
                    {{ $t('advanced.aiBehaviour.distinguishToggle') }}
                  </label>
                </div>
              </div>
            </div>

            <div v-if="tempAiClassifierMode === 'llm'" class="advanced-setting-section">
              <h4 class="ai-prompts-header">
                {{ $t('advanced.ai.prompts') }}
                <span
                  class="variant-badge"
                  :class="{ 'variant-badge-distinguish': tempDistinguishMaybeSlide }"
                >
                  {{ tempDistinguishMaybeSlide
                    ? $t('advanced.ai.variantDistinguish')
                    : $t('advanced.ai.variantSimple') }}
                </span>
              </h4>
              <div class="setting-description ai-prompts-variant-hint">
                {{ tempDistinguishMaybeSlide
                  ? $t('advanced.ai.variantDistinguishHint')
                  : $t('advanced.ai.variantSimpleHint') }}
              </div>

              <!-- Simple variant: slide / not_slide -->
              <template v-if="!tempDistinguishMaybeSlide">
                <div class="setting-item">
                  <div class="setting-label-with-reset">
                    <label class="setting-label">{{ $t('advanced.ai.promptLive') }}</label>
                    <button @click="resetAiPrompt('live', 'simple')" class="reset-btn" :title="$t('settings.resetToDefault')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </button>
                  </div>
                  <div class="setting-description">
                    {{ $t('advanced.ai.promptLiveDescription') }}
                    <code class="json-example">{"classification": "slide"}</code> {{ $t('advanced.ai.or') }} <code class="json-example">{"classification": "not_slide"}</code>
                  </div>
                  <textarea
                    v-model="tempAiPromptLive"
                    class="ai-prompt-textarea"
                    rows="6"
                    :placeholder="$t('advanced.ai.promptPlaceholder')"
                  ></textarea>
                </div>

                <div class="setting-item">
                  <div class="setting-label-with-reset">
                    <label class="setting-label">{{ $t('advanced.ai.promptRecorded') }}</label>
                    <button @click="resetAiPrompt('recorded', 'simple')" class="reset-btn" :title="$t('settings.resetToDefault')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </button>
                  </div>
                  <div class="setting-description">
                    {{ $t('advanced.ai.promptRecordedDescription') }}
                    <code class="json-example">{"image_0": "slide", "image_1": "not_slide", ...}</code>
                  </div>
                  <textarea
                    v-model="tempAiPromptRecorded"
                    class="ai-prompt-textarea"
                    rows="6"
                    :placeholder="$t('advanced.ai.promptPlaceholder')"
                  ></textarea>
                </div>
              </template>

              <!-- Distinguish variant: slide / not_slide / may_be_slide_edit -->
              <template v-else>
                <div class="setting-item">
                  <div class="setting-label-with-reset">
                    <label class="setting-label">{{ $t('advanced.ai.promptLive') }}</label>
                    <button @click="resetAiPrompt('live', 'distinguish')" class="reset-btn" :title="$t('settings.resetToDefault')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </button>
                  </div>
                  <div class="setting-description">
                    {{ $t('advanced.ai.promptLiveDescription') }}
                    <code class="json-example">{"classification": "slide"}</code>,
                    <code class="json-example">{"classification": "not_slide"}</code> {{ $t('advanced.ai.or') }}
                    <code class="json-example">{"classification": "may_be_slide_edit"}</code>
                  </div>
                  <textarea
                    v-model="tempAiPromptLiveDistinguish"
                    class="ai-prompt-textarea"
                    rows="6"
                    :placeholder="$t('advanced.ai.promptPlaceholder')"
                  ></textarea>
                </div>

                <div class="setting-item">
                  <div class="setting-label-with-reset">
                    <label class="setting-label">{{ $t('advanced.ai.promptRecorded') }}</label>
                    <button @click="resetAiPrompt('recorded', 'distinguish')" class="reset-btn" :title="$t('settings.resetToDefault')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </button>
                  </div>
                  <div class="setting-description">
                    {{ $t('advanced.ai.promptRecordedDescription') }}
                    <code class="json-example">{"image_0": "slide", "image_1": "not_slide", "image_2": "may_be_slide_edit", ...}</code>
                  </div>
                  <textarea
                    v-model="tempAiPromptRecordedDistinguish"
                    class="ai-prompt-textarea"
                    rows="6"
                    :placeholder="$t('advanced.ai.promptPlaceholder')"
                  ></textarea>
                </div>
              </template>
            </div>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="closeAdvancedSettings" class="cancel-btn">{{ $t('advanced.cancel') }}</button>
            <button @click="saveAdvancedSettings" class="save-btn">{{ $t('advanced.save') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Name Input Dialog -->
    <div v-if="showNameInputModal" class="modal-overlay" @click="cancelNameInput">
      <div class="modal-content name-input-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('advanced.enterExclusionName') }}</h3>
          <button @click="cancelNameInput" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="name-input-content">
            <label class="setting-label">{{ $t('advanced.exclusionItemName') }}</label>
            <input
              v-model="nameInputValue"
              type="text"
              class="name-input-field"
              :placeholder="$t('advanced.enterNamePlaceholder')"
              @keyup.enter="confirmNameInput"
              @keyup.escape="cancelNameInput"
              ref="nameInputField"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button @click="cancelNameInput" class="cancel-btn">{{ $t('advanced.cancel') }}</button>
          <button @click="confirmNameInput" :disabled="!nameInputValue.trim()" class="save-btn">{{ $t('advanced.confirm') }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePinyinName } from '../composables/usePinyinName'
import { useAuth } from '../composables/useAuth'
import { useSettings } from '../composables/useSettings'
import { useAdvancedSettings } from '../composables/useAdvancedSettings'
import { useCacheManagement } from '../composables/useCacheManagement'
import { useAISettings } from '../composables/useAISettings'
import { usePHashExclusion } from '../composables/usePHashExclusion'
import MlThresholdSlider from './MlThresholdSlider.vue'

const { t } = useI18n()

// Initialize composables
const auth = useAuth(() => {
  // On login success, refresh the built-in model
  aiSettings.refreshBuiltinModel()
})

const settings = useSettings()

const cacheManagement = useCacheManagement()

const pHashExclusion = usePHashExclusion()

const aiSettings = useAISettings({
  tokenManager: auth.tokenManager
})

const advancedSettings = useAdvancedSettings(
  {
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    downloadMaxWorkers: settings.downloadMaxWorkers,
    downloadNumRetries: settings.downloadNumRetries,
    videoRetryCount: settings.videoRetryCount,
    themeMode: settings.themeMode,
    languageMode: settings.languageMode,
    preventSystemSleep: settings.preventSystemSleep,
    enableAIFiltering: settings.enableAIFiltering,
    tempEnableAIFiltering: settings.tempEnableAIFiltering
  },
  // onOpenModal callback
  async () => {
    auth.loadManualToken()
    auth.tokenVerificationStatus.value = null
    auth.showToken.value = false
    cacheManagement.refreshCacheStats()
    cacheManagement.resetOperationStatus()
    await pHashExclusion.loadPHashExclusionList()
    await aiSettings.loadAISettings()
    aiSettings.refreshMlModelInfo()
    aiSettings.resetTempValues()
    settings.resetTempEnableAIFiltering()
  },
  // onSaveSettings callback
  async () => {
    await aiSettings.saveAISettings()
    await settings.saveEnableAIFiltering()
  },
  t
)

// Destructure for template usage
// Auth
const {
  isLoggedIn,
  username,
  password,
  userNickname,
  userId,
  isLoading,
  isVerifyingToken,
  manualToken,
  showToken,
  isVerifyingManualToken,
  tokenVerificationStatus,
  login,
  logout,
  toggleTokenVisibility,
  onTokenInput,
  verifyManualToken,
  openBrowserLogin
} = auth

const showUserMenu = ref(false)
const userInfoRef = ref<HTMLElement | null>(null)

const { isChineseName, displayNickname, nameInitial: userInitial } = usePinyinName(userNickname)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleSignOut = () => {
  closeUserMenu()
  logout()
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!showUserMenu.value || !userInfoRef.value) {
    return
  }

  const target = event.target as Node | null
  if (target && !userInfoRef.value.contains(target)) {
    closeUserMenu()
  }
}

// Settings
const {
  outputDirectory,
  connectionMode,
  muteMode,
  slideCheckInterval,
  slideDoubleVerification,
  slideVerificationCount,
  taskSpeed,
  showMorePlaybackSpeed,
  autoPostProcessing,
  autoPostProcessingLive,
  enableAIFiltering: _enableAIFiltering,
  tempEnableAIFiltering,
  preventSystemSleep,
  taskStatus,
  downloadQueueStatus,
  selectOutputDirectory,
  setConnectionMode,
  setMuteMode,
  setSlideCheckInterval,
  validateAndCorrectInterval,
  setSlideDoubleVerification,
  resetSlideDetectionInterval,
  resetSlideStabilityVerification,
  setTaskSpeed,
  setShowMorePlaybackSpeed,
  setAutoPostProcessing,
  setAutoPostProcessingLive,
  setEnableAIFiltering: _setEnableAIFiltering,
  resetTempEnableAIFiltering: _resetTempEnableAIFiltering,
  saveEnableAIFiltering: _saveEnableAIFiltering,
  setPreventSystemSleep
} = settings

// Advanced Settings
const {
  showAdvancedModal,
  activeAdvancedTab,
  advancedSettingsTabs,
  tempMaxConcurrentDownloads,
  tempDownloadMaxWorkers,
  tempDownloadNumRetries,
  tempVideoRetryCount,
  tempThemeMode,
  tempLanguageMode,
  ssimThreshold: _ssimThreshold,
  tempSsimThreshold,
  ssimPreset,
  pHashThreshold: _pHashThreshold,
  tempPHashThreshold,
  enableDuplicateRemoval: _enableDuplicateRemoval,
  tempEnableDuplicateRemoval,
  enableExclusionList: _enableExclusionList,
  tempEnableExclusionList,
  enableDownsampling: _enableDownsampling,
  tempEnableDownsampling,
  downsampleWidth: _downsampleWidth,
  tempDownsampleWidth: _tempDownsampleWidth,
  downsampleHeight: _downsampleHeight,
  tempDownsampleHeight: _tempDownsampleHeight,
  selectedDownsamplingPreset: _selectedDownsamplingPreset,
  tempSelectedDownsamplingPreset,
  downsamplingPresets,
  enablePngColorReduction: _enablePngColorReduction,
  tempEnablePngColorReduction,
  tempAutoCropAspectTolerance,
  tempAutoCropBlackThreshold,
  tempAutoCropMaxBorderFrac,
  tempAutoCropCannyLowThreshold,
  tempAutoCropCannyHighThreshold,
  tempAutoCropAreaRatioMin,
  tempAutoCropAreaRatioMax,
  tempAutoCropMarginFrac,
  tempAutoCropFillRatioMin,
  tempAutoCropDetectorMode,
  tempAutoCropYoloConfidenceThreshold,
  tempAutoCropYoloIouThreshold,
  tempAutoCropYoloInputSize,
  autoCropYoloInputSizes,
  autoCropModelInfo,
  selectAutoCropCustomModel,
  deleteAutoCropCustomModel,
  distinguishMaybeSlide: _distinguishMaybeSlide,
  tempDistinguishMaybeSlide,
  intranetMappings,
  expandedMappings,
  availableNetworkInterfaces,
  tempIntranetInterfaceIp,
  refreshNetworkInterfaces,
  openAdvancedSettings,
  closeAdvancedSettings,
  saveAdvancedSettings,
  updateImageProcessingParams: _updateImageProcessingParams,
  updatePostProcessingPhases: _updatePostProcessingPhases,
  selectDownsamplingPreset,
  onSsimPresetChange,
  onSsimInputChange,
  updateThresholdProgrammatically,
  onAdaptiveThresholdChanged,
  toggleMappingExpanded,
  getStrategyDisplayName,
  updateMaxConcurrentDownloads,
  updateDownloadMaxWorkers,
  updateDownloadNumRetries,
  updateVideoRetryCount
} = advancedSettings

// Cache Management
const {
  cacheStats,
  isRefreshingCache,
  isClearingCache,
  isResettingData,
  cacheOperationStatus,
  refreshCacheStats,
  clearCache,
  resetAllData,
  formatCacheSize
} = cacheManagement

// AI Settings
const {
  tempAiServiceType,
  tempAiCustomApiBaseUrl,
  tempAiCustomApiKey,
  tempAiCustomModelName,
  showApiKey,
  tempAiRateLimit,
  tempAiBatchSize,
  maxAiRateLimit,
  tempAiMaxConcurrent,
  tempAiMinTime,
  selectedImageResizePreset,
  imageResizePresets,
  onImageResizePresetChange,
  tempAiPromptLive,
  tempAiPromptRecorded,
  tempAiPromptLiveDistinguish,
  tempAiPromptRecordedDistinguish,
  builtinModelName,
  isLoadingBuiltinModel,
  builtinModelError,
  apiUrlPresets,
  modelPresets,
  modelPresetsByProvider,
  selectedApiUrlPreset,
  selectedModelPreset,
  currentCustomProvider,
  tempCustomModelChain,
  exhaustedModels,
  refreshExhaustedModels,
  moveModelUp,
  moveModelDown,
  updateModelAt,
  removeModelAt,
  newModelInput,
  selectedAddPreset,
  onAddPresetSelect,
  addPendingModel,
  refreshBuiltinModel,
  onApiUrlPresetChange,
  onModelPresetChange,
  resetAiPrompt,
  updateAiBatchSize,
  openCustomServiceDocs,
  // Copilot
  tempCopilotGhoToken,
  tempCopilotModelName,
  copilotUsername,
  copilotAvatarUrl,
  showCopilotToken,
  copilotOAuthStep,
  copilotUserCode,
  copilotVerificationUri,
  copilotOAuthError,
  isCopilotLoading,
  copilotModelPresets,
  selectedCopilotModelPreset,
  startCopilotOAuth,
  validateCopilotToken,
  cancelCopilotOAuth,
  disconnectCopilot,
  onCopilotModelPresetChange,
  // ML classifier
  tempAiClassifierMode,
  tempMlThresholds,
  mlModelInfo,
  refreshMlModelInfo,
  importCustomMlModel,
  deleteCustomMlModel
} = aiSettings

// pHash Exclusion
const {
  pHashExclusionList,
  isAddingExclusion,
  showNameInputModal,
  nameInputValue,
  addExclusionItem,
  removeExclusionItem,
  editExclusionItemName,
  clearExclusionList,
  confirmNameInput,
  cancelNameInput
} = pHashExclusion

// Tools Window
const openToolsWindow = async (tab?: string) => {
  try {
    await window.electronAPI.tools.openWindow(tab)
  } catch (error) {
    console.error('Failed to open tools window:', error)
  }
}

// Add-ons Window
const openAddonsWindow = async (tab?: string) => {
  try {
    await window.electronAPI.addons.openWindow(tab)
  } catch (error) {
    console.error('Failed to open addons window:', error)
  }
}

// Copy Copilot user code to clipboard
const copilotCodeCopied = ref(false)
const copyUserCode = async () => {
  if (!copilotUserCode.value) return
  try {
    await navigator.clipboard.writeText(copilotUserCode.value)
    copilotCodeCopied.value = true
    setTimeout(() => { copilotCodeCopied.value = false }, 2000)
  } catch {
    // Clipboard API may not be available
  }
}

const openCopilotVerificationUrl = () => {
  if (copilotVerificationUri.value) {
    window.electronAPI.shell.openExternal(copilotVerificationUri.value)
  }
}

// Open Output Directory
const openOutputDirectory = async () => {
  try {
    if (outputDirectory.value) {
      await window.electronAPI.shell.openPath(outputDirectory.value)
    }
  } catch (error) {
    console.error('Failed to open output directory:', error)
  }
}

// Lifecycle hooks
onMounted(async () => {
  auth.verifyExistingToken()
  await settings.loadConfig()
  await advancedSettings.loadImageProcessingConfig()

  // Load built-in model name in background (non-blocking)
  aiSettings.refreshBuiltinModel()
  // Load session-exhausted model list for ModelScope chain UI (non-blocking)
  aiSettings.refreshExhaustedModels()

  // Add event listener for adaptive threshold changes
  window.addEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  // Remove event listener for adaptive threshold changes
  window.removeEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  document.removeEventListener('click', handleDocumentClick)
})

// Export for potential future use by other components
defineExpose({
  updateThresholdProgrammatically
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

.user-info {
  position: relative;
  min-height: 36px;
}

.login-form h3, .verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.login-form p, .verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.user-banner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 6px;
  padding: 3px 2px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.user-banner:hover {
  background-color: #eef1f4;
}

.user-banner.open {
  gap: 10px;
  padding: 5px 8px;
  border: 1px solid #d5d9de;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background-color: #ffffff;
}

.user-banner.open:hover {
  background-color: #ffffff;
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
  transition: transform 0.2s ease;
}

.user-banner-chevron.open {
  transform: rotate(180deg);
}

.user-menu {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  z-index: 20;
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

.verifying-state {
  text-align: center;
  padding: 20px 0;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
}

.logout-btn {
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.login-btn {
  background-color: #007acc;
  color: white;
}

.login-btn:hover:not(:disabled) {
  background-color: #005a9e;
}

.login-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
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
  cursor: pointer;
  transition: background-color 0.2s;
}

.browser-login-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: transparent;
  color: #007acc;
  white-space: nowrap;
}

.browser-login-btn:hover {
  background-color: #007acc;
  color: white;
}

.logout-btn {
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 10px;
  align-self: flex-start;
  margin: 0;
}

.user-menu-signout {
  width: 100%;
  margin: 0;
  text-align: center;
}

.logout-btn:hover {
  background-color: #dc3545;
  border-color: #dc3545;
  color: white;
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
  cursor: pointer;
  transition: background-color 0.2s;
  color: #333;
}

.advanced-btn:hover {
  background-color: #e9ecef;
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

.setting-label-with-reset .reset-btn {
  margin-bottom: 6px;
}

.setting-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.reset-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  color: #666;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.reset-btn:hover {
  background-color: #f0f0f0;
  color: #333;
  opacity: 1;
}

.reset-btn svg {
  width: 12px;
  height: 12px;
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
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.browse-btn:hover {
  background-color: #0056b3;
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
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background-color: #e9ecef;
}

.mode-btn.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.audio-mode-selector {
  width: 100%;
}

.audio-mode-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.audio-mode-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
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

/* Slide extraction settings styles */
.slide-interval-group {
  display: flex;
  align-items: center;
}

.slide-interval-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.slide-interval-input-wrapper:focus-within {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.slide-interval-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
}

.slide-interval-select {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
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
  transition: all 0.2s ease;
  height: 35px;
}

.verification-unified-control:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: none;
  user-select: none;
  flex: 1;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
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
  background-color: white;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 50px;
}

.verification-count-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.task-speed-selector {
  width: 100%;
}

.task-speed-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.task-speed-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

/* Auto post-processing control styles */
.auto-post-processing-control {
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.auto-post-processing-control:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.auto-post-processing-control .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: none;
  user-select: none;
}

.auto-post-processing-control .checkbox-label:not(:last-child) {
  border-bottom: 1px solid #ddd;
}

.auto-post-processing-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

/* Post-processing phases list styles */
.post-processing-phases-list,
.image-output-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.phase-toggle-item,
.image-output-toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.phase-toggle-item:hover,
.image-output-toggle-item:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.phase-toggle-item input[type="checkbox"],
.image-output-toggle-item input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: #007bff;
}

.phase-toggle-text,
.image-output-toggle-text {
  font-size: 12px;
  color: #333;
}

.status-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.action-buttons-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #ffffff;
  color: #333;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.action-btn svg {
  flex-shrink: 0;
  opacity: 0.7;
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

.status-value.external {
  color: #ffc107;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #333;
}

/* Advanced Settings Tabs */
.advanced-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fafafa;
  flex-shrink: 0;
}

.advanced-tabs .tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #666;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.advanced-tabs .tab-btn:hover {
  color: #333;
  background-color: rgba(0, 0, 0, 0.04);
}

.advanced-tabs .tab-btn.active {
  color: #007acc;
  border-bottom-color: #007acc;
  background-color: white;
}

.advanced-tabs .tab-btn svg {
  flex-shrink: 0;
}

.tab-content {
  display: flex;
  flex-direction: column;
}

.advanced-settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  margin-bottom: 0;
}

.advanced-setting-section {
  margin-bottom: 24px;
}

.advanced-setting-section h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.advanced-setting-section .setting-item {
  margin-bottom: 20px;
}

.advanced-setting-section .setting-item:last-child {
  margin-bottom: 0;
}

.auto-crop-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 0;
  margin-bottom: 20px;
}

.auto-crop-grid .setting-item {
  margin-bottom: 16px;
}

.auto-crop-grid .setting-item:last-child {
  margin-top: 0;
}

.auto-crop-grid .setting-item.full-width {
  grid-column: 1 / -1;
}

.auto-crop-grid .setting-item .slide-interval-input-wrapper {
  width: 100%;
  box-sizing: border-box;
}

.advanced-setting-subsection {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.advanced-setting-subsection h5 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #222);
}

.model-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
}

.model-row .model-info {
  font-size: 12px;
  color: var(--text-primary, #222);
  word-break: break-all;
}

.model-row .model-size {
  color: #666;
  margin-left: 4px;
}

.model-row .model-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.secondary-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.15));
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.secondary-btn:hover:not(:disabled) {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  border-color: var(--border-color-strong, rgba(0, 0, 0, 0.25));
}

.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.3;
}

.setting-description .json-example {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10px;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 3px;
  color: #333;
  white-space: nowrap;
}

/* General setting description for main settings */
.setting-item .setting-description {
  margin-top: 2px;
  margin-bottom: 6px;
}

/* Setting description after controls needs more top margin */
.downsampling-controls + .setting-description {
  margin-top: 8px;
}

.external-link {
  color: #007acc;
  text-decoration: none;
  cursor: pointer;
}

.external-link:hover {
  text-decoration: underline;
}

.concurrent-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.concurrent-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.ssim-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  margin-bottom: 4px;
}

.ssim-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.ssim-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.ssim-preset-select {
  flex: 0 0 auto;
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.ssim-preset-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.ssim-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.ssim-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

/* pHash threshold input styles */
.phash-threshold-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.phash-threshold-input-wrapper:focus-within {
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.phash-threshold-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
}

.threshold-unit {
  padding: 6px 8px;
  font-size: 11px;
  color: #666;
  background-color: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  white-space: nowrap;
}

/* Downsampling controls styles */
.downsampling-controls {
  margin-top: 8px;
}

.downsampling-resolution {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.resolution-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.resolution-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resolution-label {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

.resolution-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.resolution-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.resolution-separator {
  font-size: 14px;
  font-weight: bold;
  color: #666;
  margin-top: 18px;
}

/* Classroom Rules Styles */
.classroom-rules-info {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 11px;
}

.rules-title {
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
  font-size: 12px;
}

.rules-description {
  color: #6c757d;
  margin-bottom: 8px;
  line-height: 1.4;
}

.rules-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding: 4px 0;
}

.rule-condition {
  color: #495057;
  font-weight: 500;
  background-color: #e3f2fd;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.rule-arrow {
  margin: 0 8px;
  color: #6c757d;
  font-weight: bold;
}

.rule-action {
  color: #28a745;
  font-weight: 500;
  background-color: #d4edda;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.rules-reason {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #dee2e6;
  color: #6c757d;
  font-style: italic;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #f8f9fa;
  color: #666;
}

.cancel-btn:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.save-btn {
  background-color: #007acc;
  color: white;
  border-color: #007acc;
}

.save-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

/* Authentication section styles */
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

/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.control-section,
.advanced-settings-content {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.control-section:hover,
.advanced-settings-content:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.control-section::-webkit-scrollbar,
.advanced-settings-content::-webkit-scrollbar {
  width: 6px;
}

.control-section::-webkit-scrollbar-track,
.advanced-settings-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.control-section::-webkit-scrollbar-thumb,
.advanced-settings-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.control-section:hover::-webkit-scrollbar-thumb,
.advanced-settings-content:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.control-section::-webkit-scrollbar-thumb:hover,
.advanced-settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

/* Tools Flyout */
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
  cursor: pointer;
  transition: all 0.2s;
}

.tools-trigger:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.tools-trigger svg:first-child {
  flex-shrink: 0;
  opacity: 0.7;
}

.tools-chevron {
  margin-left: auto;
  opacity: 0.45;
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

  .login-form h3, .verifying-state h3 {
    color: #e0e0e0;
  }

  .login-form p, .verifying-state p {
    color: #b0b0b0;
  }

  .user-banner {
    background-color: transparent;
  }

  .user-banner:hover {
    background-color: #383838;
  }

  .user-banner.open {
    border-color: #4a4a4a;
    background-color: #2d2d2d;
  }

  .user-banner.open:hover {
    background-color: #2d2d2d;
  }

  .user-avatar {
    background-color: #3b82f6;
  }

  .user-banner-name {
    color: #e0e0e0;
  }

  .user-banner-chevron {
    color: #a0a0a0;
  }

  .user-menu {
    background-color: #2d2d2d;
    border-color: #4a4a4a;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  .user-menu-username {
    color: #e0e0e0;
  }

  .user-menu-message {
    color: #b0b0b0;
  }

  .loading-spinner {
    border-color: #404040;
    border-top-color: #4a9eff;
  }

  .input-field {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .input-field::placeholder {
    color: #888;
  }

  .login-btn {
    background-color: #2563eb;
  }

  .login-btn:hover:not(:disabled) {
    background-color: #1d4ed8;
  }

  .login-btn:disabled {
    background-color: #555;
  }

  .browser-login-btn {
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .browser-login-btn:hover {
    background-color: #4a9eff;
    color: white;
  }

  .logout-btn {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }

  .logout-btn:hover {
    background-color: #ff6b6b;
    color: white;
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
    color: #e0e0e0;
  }

  .advanced-btn:hover {
    background-color: #3d3d3d;
  }

  .setting-label {
    color: #e0e0e0;
  }

  .reset-btn {
    color: #b0b0b0;
  }

  .reset-btn:hover {
    background-color: #3d3d3d;
    color: #e0e0e0;
  }

  .setting-description {
    color: #b0b0b0;
  }

  .setting-description .json-example {
    background-color: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .directory-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .browse-btn {
    background-color: #2563eb;
  }

  .browse-btn:hover {
    background-color: #1d4ed8;
  }

  .mode-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .mode-btn:hover {
    background-color: #3d3d3d;
  }

  .mode-btn.active {
    background-color: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  .audio-mode-select, .theme-select, .language-select, .task-speed-select, .verification-count-select, .concurrent-select, .ssim-select, .ssim-preset-select, .ssim-input, .phash-threshold-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .audio-mode-select:focus, .theme-select:focus, .language-select:focus, .task-speed-select:focus, .verification-count-select:focus, .concurrent-select:focus, .ssim-select:focus, .ssim-preset-select:focus, .ssim-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  /* pHash threshold input dark mode */
  .phash-threshold-input-wrapper {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .phash-threshold-input-wrapper:focus-within {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .phash-threshold-input {
    color: #e0e0e0;
  }

  .threshold-unit {
    background-color: #2d2d2d;
    border-left-color: #404040;
    color: #b0b0b0;
  }

  /* Downsampling controls dark mode */
  .downsampling-resolution {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .resolution-label {
    color: #b0b0b0;
  }

  .resolution-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .resolution-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .resolution-separator {
    color: #b0b0b0;
  }

  /* Classroom Rules Dark Theme */
  .classroom-rules-info {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .rules-title {
    color: #e0e0e0;
  }

  .rules-description {
    color: #b0b0b0;
  }

  .rule-condition {
    color: #e0e0e0;
    background-color: #1a2332;
  }

  .rule-arrow {
    color: #b0b0b0;
  }

  .rule-action {
    color: #4caf50;
    background-color: #1b2e1b;
  }

  .rules-reason {
    border-top-color: #404040;
    color: #b0b0b0;
  }

  .slide-interval-input-wrapper {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .slide-interval-input-wrapper:focus-within {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .slide-interval-input {
    color: #e0e0e0;
  }

  .slide-interval-select {
    color: #e0e0e0;
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

  .verification-unified-control:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }

  .checkbox-label {
    color: #e0e0e0;
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

  .action-btn {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .action-btn:hover {
    background-color: #404040;
    border-color: #666;
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

  .status-value.external {
    color: #ffc107;
  }

  .modal-overlay {
    background-color: rgba(0, 0, 0, 0.7);
  }

  .modal-content {
    background-color: #2d2d2d;
  }

  .modal-header {
    border-bottom-color: #404040;
  }

  .modal-header h3 {
    color: #e0e0e0;
  }

  .close-btn {
    color: #e0e0e0;
  }

  .close-btn:hover {
    background-color: #3d3d3d;
  }

  .modal-body {
    color: #e0e0e0;
  }

  .advanced-tabs {
    background-color: #252525;
    border-bottom-color: #404040;
  }

  .advanced-tabs .tab-btn {
    color: #999;
  }

  .advanced-tabs .tab-btn:hover {
    color: #e0e0e0;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .advanced-tabs .tab-btn.active {
    color: #4a9eff;
    border-bottom-color: #4a9eff;
    background-color: #2d2d2d;
  }

  .advanced-settings-content {
    background-color: #2d2d2d;
  }

  .advanced-setting-section h4 {
    color: #e0e0e0;
    border-bottom-color: #404040;
  }

  .advanced-setting-subsection {
    border-top-color: #404040;
  }

  .advanced-setting-subsection h5 {
    color: #e0e0e0;
  }

  .model-row {
    border-color: #404040;
    background: #252525;
  }

  .model-row .model-info {
    color: #e0e0e0;
  }

  .model-row .model-size {
    color: #b0b0b0;
  }

  .secondary-btn {
    background: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .secondary-btn:hover:not(:disabled) {
    background: #3d3d3d;
    border-color: #4a9eff;
  }

  .modal-actions {
    background-color: #2d2d2d;
    border-top-color: #404040;
  }

  .cancel-btn {
    background-color: #2d2d2d;
    color: #b0b0b0;
    border-color: #404040;
  }

  .cancel-btn:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  .save-btn {
    background-color: #4a9eff;
    border-color: #4a9eff;
  }

  .save-btn:hover {
    background-color: #3a8eef;
    border-color: #3a8eef;
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

  .control-section,
  .advanced-settings-content {
    scrollbar-color: transparent transparent;
  }

  .control-section:hover,
  .advanced-settings-content:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .control-section::-webkit-scrollbar-track,
  .advanced-settings-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .control-section::-webkit-scrollbar-thumb,
  .advanced-settings-content::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .control-section:hover::-webkit-scrollbar-thumb,
  .advanced-settings-content:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }

  .control-section::-webkit-scrollbar-thumb:hover,
  .advanced-settings-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3) !important;
  }
}

/* Prevent sleep control styles */
.prevent-sleep-control {
  display: flex;
  align-items: center;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
  height: 35px;
}

.prevent-sleep-control:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.prevent-sleep-control .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: none;
  user-select: none;
  flex: 1;
}

.prevent-sleep-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

/* Downsampling control styles - modified to accommodate presets */
.downsampling-control {
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
  min-height: 35px;
}

.downsampling-control:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.downsampling-control .checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  padding: 8px 12px;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: none;
  user-select: none;
  height: 35px;
}

.downsampling-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
}

/* Downsampling presets styles */
.downsampling-presets {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  background-color: rgba(255, 255, 255, 0.7);
}

.downsampling-presets.no-border-top {
  border-top: none;
}

.preset-btn {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #666;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.preset-btn:hover {
  background-color: #f8f9fa;
  border-color: #007bff;
  color: #007bff;
}

.preset-btn.active {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
}

/* Dark mode support for prevent sleep control */
@media (prefers-color-scheme: dark) {
  .prevent-sleep-control {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .prevent-sleep-control:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }

  .prevent-sleep-control .checkbox-label {
    color: #e0e0e0;
  }

  /* Dark mode support for downsampling control */
  .downsampling-control {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .downsampling-control:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }

  .downsampling-control .checkbox-label {
    color: #e0e0e0;
  }

  .downsampling-presets {
    border-top-color: #404040;
    background-color: rgba(45, 45, 45, 0.7);
  }

  .preset-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .preset-btn:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
    color: #4a9eff;
  }

  .preset-btn.active {
    background-color: #4a9eff;
    border-color: #4a9eff;
    color: white;
  }

  /* Dark mode support for auto post-processing control */
  .auto-post-processing-control {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .auto-post-processing-control:hover {
    background-color: #3d3d3d;
    border-color: #4a9eff;
  }

  .auto-post-processing-control .checkbox-label {
    color: #e0e0e0;
  }

  .auto-post-processing-control .checkbox-label:not(:last-child) {
    border-bottom-color: #404040;
  }

  /* Dark mode support for post-processing phases list */
  .phase-toggle-item,
  .image-output-toggle-item {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .phase-toggle-item:hover,
  .image-output-toggle-item:hover {
    background-color: #3d3d3d;
    border-color: #505050;
  }

  .phase-toggle-text,
  .image-output-toggle-text {
    color: #e0e0e0;
  }
}

/* Intranet mapping styles - Compact version */
.intranet-interface-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 6px;
}

.intranet-interface-select {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background-color: white;
}

.intranet-interface-row .refresh-button {
  box-sizing: border-box;
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 1;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
}

.intranet-interface-row .refresh-button:hover {
  background-color: #f3f4f6;
}

.intranet-interface-warning {
  margin-top: 4px;
  font-size: 11px;
  color: #b45309;
}

.intranet-mapping-list {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f8f9fa;
  font-size: 11px;
}

.mapping-item {
  border-bottom: 1px solid #e0e0e0;
}

.mapping-item:last-child {
  border-bottom: none;
}

.mapping-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  background-color: white;
  min-height: 28px;
}

.mapping-header:hover {
  background-color: #f8f9fa;
}

.mapping-domain {
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  color: #333;
  font-family: 'Courier New', monospace;
  line-height: 1.2;
}

.mapping-type {
  margin-right: 8px;
}

.type-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1;
}

.type-badge.single {
  background-color: #e3f2fd;
  color: #1976d2;
}

.type-badge.loadbalance {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.mapping-expand-icon {
  transition: transform 0.2s ease;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.mapping-expand-icon.expanded {
  transform: rotate(180deg);
}

.mapping-expand-icon svg {
  width: 10px;
  height: 10px;
}

.mapping-details {
  padding: 8px 10px;
  background-color: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
  font-size: 10px;
  line-height: 1.3;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 500;
  color: #666;
  min-width: 60px;
  margin-right: 8px;
  flex-shrink: 0;
}

.detail-value {
  color: #333;
  font-family: 'Courier New', monospace;
  font-size: 10px;
}

.ip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: flex-start;
}

.ip-item {
  padding: 2px 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  font-size: 9px;
  font-family: 'Courier New', monospace;
  color: #495057;
  display: inline-block;
  white-space: nowrap;
  line-height: 1.2;
}

/* Dark mode support for intranet mapping - Compact version */
@media (prefers-color-scheme: dark) {
  .intranet-interface-select {
    border-color: #404040;
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .intranet-interface-select option {
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .intranet-interface-row .refresh-button {
    border-color: #404040;
    background-color: #2d2d2d;
    color: #e0e0e0;
  }

  .intranet-interface-row .refresh-button:hover {
    background-color: #3d3d3d;
  }

  .intranet-interface-warning {
    color: #f5b971;
  }

  .intranet-mapping-list {
    border-color: #404040;
    background-color: #2d2d2d;
  }

  .mapping-item {
    border-bottom-color: #404040;
  }

  .mapping-header {
    background-color: #2d2d2d;
    min-height: 28px;
  }

  .mapping-header:hover {
    background-color: #3d3d3d;
  }

  .mapping-domain {
    color: #e0e0e0;
    font-size: 11px;
  }

  .type-badge.single {
    background-color: #1a2332;
    color: #64b5f6;
  }

  .type-badge.loadbalance {
    background-color: #2d1b2e;
    color: #ba68c8;
  }

  .mapping-expand-icon {
    color: #b0b0b0;
  }

  .mapping-details {
    background-color: #2d2d2d;
    border-top-color: #404040;
    padding: 8px 10px;
  }

  .detail-label {
    color: #b0b0b0;
    font-size: 10px;
  }

  .detail-value {
    color: #e0e0e0;
    font-size: 10px;
  }

  .ip-item {
    background-color: #404040;
    color: #e0e0e0;
    font-size: 9px;
    padding: 2px 6px;
    white-space: nowrap;
  }
}

/* Cache management styles */
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

/* Dark mode support for cache management */
@media (prefers-color-scheme: dark) {
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

/* pHash exclusion list styles */
.exclusion-list-container {
  margin-bottom: 12px;
}

.exclusion-list-empty {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 11px;
  font-style: italic;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.exclusion-list {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background-color: #f8f9fa;
  max-height: 200px;
  overflow-y: auto;
}

.exclusion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e9ecef;
  background-color: white;
  transition: background-color 0.2s;
}

.exclusion-item:last-child {
  border-bottom: none;
}

.exclusion-item:hover {
  background-color: #f8f9fa;
}

.exclusion-item.preset-item {
  border-left: 3px solid #007acc;
}

.exclusion-item.disabled-item {
  opacity: 0.6;
  background-color: #f8f9fa;
}

.exclusion-item.disabled-item .exclusion-item-name,
.exclusion-item.disabled-item .exclusion-item-hash {
  color: #999;
}

.exclusion-item-info {
  flex: 1;
  min-width: 0;
}

.exclusion-item-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-badge {
  font-size: 9px;
  font-weight: 600;
  color: #007acc;
  background-color: #e3f2fd;
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.exclusion-item-hash {
  font-size: 10px;
  color: #666;
  font-family: 'Courier New', monospace;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}


.exclusion-item-actions {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.exclusion-edit-btn, .exclusion-remove-btn, .exclusion-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background-color: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s;
}

.exclusion-edit-btn {
  color: #007acc;
}

.exclusion-edit-btn:hover {
  background-color: #007acc;
  color: white;
  border-color: #007acc;
}

.exclusion-remove-btn {
  color: #dc3545;
}

.exclusion-remove-btn:hover {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
}

.exclusion-toggle-btn {
  color: #28a745;
}

.exclusion-toggle-btn:hover {
  background-color: #28a745;
  color: white;
  border-color: #28a745;
}

.exclusion-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.exclusion-add-btn, .exclusion-clear-btn {
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

.exclusion-add-btn {
  background-color: #28a745;
  border-color: #28a745;
  color: white;
}

.exclusion-add-btn:hover:not(:disabled) {
  background-color: #218838;
  border-color: #218838;
}

.exclusion-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.exclusion-clear-btn {
  background-color: #ffc107;
  border-color: #ffc107;
  color: #212529;
}

.exclusion-clear-btn:hover {
  background-color: #e0a800;
  border-color: #e0a800;
}

/* Dark mode support for pHash exclusion list */
@media (prefers-color-scheme: dark) {
  .exclusion-list-empty {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #b0b0b0;
  }

  .exclusion-list {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .exclusion-item {
    background-color: #2d2d2d;
    border-bottom-color: #404040;
  }

  .exclusion-item:hover {
    background-color: #3d3d3d;
  }

  .exclusion-item-name {
    color: #e0e0e0;
  }

  .preset-badge {
    color: #4a9eff;
    background-color: #1a2332;
  }

  .exclusion-item.preset-item {
    border-left-color: #4a9eff;
  }

  .exclusion-item.disabled-item .exclusion-item-name,
  .exclusion-item.disabled-item .exclusion-item-hash {
    color: #666;
  }

  .exclusion-item-hash {
    color: #b0b0b0;
  }


  .exclusion-edit-btn, .exclusion-remove-btn, .exclusion-toggle-btn {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .exclusion-edit-btn {
    color: #4a9eff;
  }

  .exclusion-edit-btn:hover {
    background-color: #4a9eff;
    color: white;
    border-color: #4a9eff;
  }

  .exclusion-remove-btn {
    color: #ff6b6b;
  }

  .exclusion-remove-btn:hover {
    background-color: #ff6b6b;
    color: white;
    border-color: #ff6b6b;
  }

  .exclusion-toggle-btn {
    color: #4caf50;
  }

  .exclusion-toggle-btn:hover {
    background-color: #4caf50;
    color: white;
    border-color: #4caf50;
  }

  .exclusion-add-btn {
    background-color: #4caf50;
    border-color: #4caf50;
  }

  .exclusion-add-btn:hover:not(:disabled) {
    background-color: #45a049;
    border-color: #45a049;
  }

  .exclusion-clear-btn {
    background-color: #f39c12;
    border-color: #f39c12;
    color: #1a1a1a;
  }

  .exclusion-clear-btn:hover {
    background-color: #e67e22;
    border-color: #e67e22;
  }
}

/* Custom name input dialog styles */
.name-input-modal {
  width: 400px;
  max-width: 90vw;
}

.name-input-content {
  padding: 16px;
}

.name-input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  margin-top: 8px;
}

.name-input-field:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

/* Dark mode support for name input dialog */
@media (prefers-color-scheme: dark) {
  .name-input-field {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .name-input-field:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .name-input-field::placeholder {
    color: #888;
  }
}

/* AI Settings Tab Styles */
.ai-service-type-selector {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.custom-api-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

/* Copilot settings */
.copilot-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.copilot-user-info {
  margin-bottom: 12px;
}

.copilot-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: #f0f9f0;
  border: 1px solid #c3e6c3;
  border-radius: 4px;
}

.copilot-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.copilot-username {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.copilot-disconnect-btn {
  padding: 4px 10px;
  border: 1px solid #dc3545;
  background-color: transparent;
  color: #dc3545;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.copilot-disconnect-btn:hover {
  background-color: #dc3545;
  color: white;
}

.copilot-auth-section {
  margin-bottom: 12px;
}

.copilot-oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 7px 14px;
  border: 1px solid #24292e;
  background-color: #24292e;
  color: white;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copilot-oauth-btn:hover:not(:disabled) {
  background-color: #3b434b;
}

.copilot-oauth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copilot-or-divider {
  display: flex;
  align-items: center;
  margin: 12px 0;
  gap: 8px;
}

.copilot-or-divider::before,
.copilot-or-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #ddd;
}

.copilot-or-divider span {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
}

.copilot-manual-token .api-key-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.copilot-manual-token .api-key-input {
  padding: 6px 8px;
  font-size: 12px;
}

.copilot-verify-btn {
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid #007acc;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copilot-verify-btn:hover:not(:disabled) {
  background-color: #005ea6;
}

.copilot-verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copilot-error {
  margin-top: 8px;
  padding: 8px 10px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  font-size: 12px;
  color: #dc2626;
}

.copilot-waiting {
  text-align: center;
  padding: 16px 0;
}

.copilot-enter-code-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.copilot-user-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 700;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  letter-spacing: 4px;
  color: #24292e;
  padding: 12px;
  background-color: #f6f8fa;
  border: 2px dashed #d0d7de;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s, border-color 0.15s;
}

.copilot-user-code:hover {
  background-color: #eef1f5;
  border-color: #0969da;
}

.copilot-code-copied {
  position: absolute;
  right: 10px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  color: #1a7f37;
}

.copilot-waiting-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.copilot-verification-url {
  color: #0969da;
  cursor: pointer;
  text-decoration: underline;
  word-break: break-all;
}

.copilot-verification-url:hover {
  color: #0550ae;
}

.copilot-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
}

.copilot-cancel-btn:hover {
  background-color: #f0f0f0;
  color: #dc2626;
}

.copilot-model-setting {
  margin-top: 12px;
}

.api-url-input-group,
.api-key-input-group,
.model-name-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}

.api-url-input,
.api-key-input,
.model-name-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background-color: white;
  min-width: 0;
}

.api-url-input:focus,
.api-key-input:focus,
.model-name-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.api-url-preset-select,
.model-preset-select {
  flex: 0 0 auto;
  min-width: 130px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
}

.model-chain-hint {
  font-size: 11px;
  color: #666;
  line-height: 1.4;
  margin-bottom: 8px;
}

.model-chain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  background: #fafafa;
}

.model-chain-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 4px;
  border-bottom: 1px solid #eee;
}

.model-chain-row:last-child {
  border-bottom: none;
}

.model-chain-row.is-exhausted .model-chain-input {
  opacity: 0.6;
}

.model-chain-index {
  flex: 0 0 auto;
  min-width: 14px;
  text-align: center;
  font-size: 11px;
  color: #999;
  font-variant-numeric: tabular-nums;
}

.model-chain-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: white;
}

.model-chain-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.model-chain-badges {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
}

.model-chain-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.model-chain-badge.primary {
  background: #e7f3ff;
  color: #0366d6;
}

.model-chain-badge.exhausted {
  background: #fff4e5;
  color: #b26a00;
}

.model-chain-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 2px;
}

.model-chain-move-btn,
.model-chain-remove-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #555;
  cursor: pointer;
  font-size: 12px;
}

.model-chain-move-btn:hover:not(:disabled),
.model-chain-remove-btn:hover:not(:disabled) {
  background: #f0f0f0;
  color: #333;
}

.model-chain-remove-btn {
  font-size: 16px;
  line-height: 1;
  color: #888;
}

.model-chain-remove-btn:hover:not(:disabled) {
  background: #fee;
  color: #c00;
  border-color: #fcc;
}

.model-chain-move-btn:disabled,
.model-chain-remove-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.model-chain-empty {
  padding: 10px;
  font-size: 11px;
  color: #888;
  text-align: center;
  border: 1px dashed #ddd;
  border-radius: 4px;
  background: #fafafa;
}

.model-chain-add-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.model-chain-add-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: white;
}

.model-chain-add-input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.model-chain-preset-select {
  flex: 0 0 auto;
  min-width: 130px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 12px;
  cursor: pointer;
}

.model-chain-add-btn {
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background: #007acc;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.model-chain-add-btn:hover:not(:disabled) {
  background: #0066a8;
  border-color: #0066a8;
}

.model-chain-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.api-key-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  color: #666;
  box-sizing: border-box;
  flex: 0 0 auto;
}

.api-key-toggle-btn:hover {
  background-color: #f5f5f5;
  color: #333;
}

.rate-limit-hint {
  font-size: 11px;
  color: #e67700;
  line-height: 1.4;
  margin-bottom: 16px;
}

.ai-prompts-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.variant-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background-color: #e3f2fd;
  color: #0d47a1;
  border: 1px solid #bbdefb;
}

.variant-badge-distinguish {
  background-color: #fff3d6;
  color: #955800;
  border-color: #ffd99c;
}

.ai-prompts-variant-hint {
  margin-bottom: 12px;
}

.ai-prompt-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  background-color: white;
  resize: vertical;
  min-height: 100px;
  margin-top: 8px;
  line-height: 1.5;
}

.ai-prompt-textarea:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

/* Built-in model display styles */
.builtin-model-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.builtin-model-display {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 10px 12px;
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  min-height: 20px;
}

.model-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
}

.loading-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid #e0e0e0;
  border-top: 2px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.model-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #dc3545;
  font-size: 13px;
}

.model-name-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #666;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.refresh-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.cloudflare-error {
  flex-wrap: wrap;
}

.cloudflare-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 12px;
  color: #856404;
  line-height: 1.4;
}

.cloudflare-hint svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.builtin-disclaimer {
  margin-top: 12px;
  padding: 10px 12px;
  font-size: 10px;
  color: #888;
  line-height: 1.5;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

/* Dark mode support for AI settings */
@media (prefers-color-scheme: dark) {
  .custom-api-settings {
    border-top-color: #404040;
  }

  .api-url-input,
  .api-key-input,
  .model-name-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .api-url-input:focus,
  .api-key-input:focus,
  .model-name-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .api-url-preset-select,
  .model-preset-select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .api-key-toggle-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #aaa;
  }

  .api-key-toggle-btn:hover {
    background-color: #3a3a3a;
    color: #e0e0e0;
  }

  .ai-prompt-textarea {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .ai-prompt-textarea:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.1);
  }

  .variant-badge {
    background-color: #1b3a5c;
    color: #a6c8ff;
    border-color: #2d5985;
  }

  .variant-badge-distinguish {
    background-color: #3d2f14;
    color: #f4c67a;
    border-color: #6a4c1d;
  }

  .ai-prompt-textarea::placeholder {
    color: #888;
  }

  .builtin-model-info {
    border-top-color: #404040;
  }

  .builtin-model-display {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .model-loading {
    color: #aaa;
  }

  .loading-spinner-small {
    border-color: #404040;
    border-top-color: #4a9eff;
  }

  .model-error {
    color: #ff6b6b;
  }

  .model-name {
    color: #e0e0e0;
  }

  .refresh-btn {
    color: #aaa;
  }

  .refresh-btn:hover {
    background-color: #404040;
    color: #e0e0e0;
  }

  .cloudflare-hint {
    background-color: #4a3f00;
    border-color: #6b5a00;
    color: #ffd54f;
  }

  .builtin-disclaimer {
    background-color: rgba(255, 255, 255, 0.05);
    color: #888;
  }

  /* Copilot dark mode */
  .copilot-settings {
    border-top-color: #404040;
  }

  .copilot-user-row {
    background-color: #1a2e1a;
    border-color: #2d5a2d;
  }

  .copilot-username {
    color: #e0e0e0;
  }

  .copilot-oauth-btn {
    background-color: #f0f6fc;
    border-color: #d0d7de;
    color: #24292e;
  }

  .copilot-oauth-btn:hover:not(:disabled) {
    background-color: #e6edf5;
  }

  .copilot-or-divider::before,
  .copilot-or-divider::after {
    border-top-color: #404040;
  }

  .copilot-or-divider span {
    color: #666;
  }

  .copilot-error {
    background-color: #3a1a1a;
    border-color: #5a2d2d;
    color: #ff6b6b;
  }

  .copilot-user-code {
    background-color: #2d2d2d;
    border-color: #555;
    color: #e0e0e0;
  }

  .copilot-user-code:hover {
    background-color: #363636;
    border-color: #58a6ff;
  }

  .copilot-code-copied {
    color: #3fb950;
  }

  .copilot-verification-url {
    color: #58a6ff;
  }

  .copilot-verification-url:hover {
    color: #79c0ff;
  }

  .copilot-cancel-btn {
    color: #aaa;
  }

  .copilot-cancel-btn:hover {
    background-color: #404040;
    color: #ff6b6b;
  }

  .copilot-enter-code-label,
  .copilot-waiting-status {
    color: #aaa;
  }

  /* Tools Dropdown Dark Mode */
  .tools-trigger {
    background-color: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  .tools-trigger:hover {
    background-color: #404040;
    border-color: #666;
  }

}
</style>
