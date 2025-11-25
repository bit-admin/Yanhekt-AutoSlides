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
        <button @click="login" :disabled="isLoading" class="login-btn">
          {{ isLoading ? $t('auth.signingIn') : $t('auth.signIn') }}
        </button>
      </div>
      <div v-else class="user-info">
        <h3>{{ $t('auth.hiThere', { nickname: isNicknameMasked ? 'ʕ•ᴥ•ʔ' : userNickname }) }}</h3>
        <p>{{ $t('auth.signInAs', { userId: isUserIdMasked ? '•••••••••••' : userId }) }}</p>
        <p>{{ $t('auth.accessMessage') }}</p>
        <button @click="logout" class="logout-btn">{{ $t('auth.signOut') }}</button>

        <!-- Hidden clickable areas for toggling mask -->
        <div
          v-if="isNicknameMasked"
          class="mask-toggle nickname-mask-toggle"
          @click="toggleNicknameMask"
        ></div>
        <div
          v-if="isUserIdMasked"
          class="mask-toggle userid-mask-toggle"
          @click="toggleUserIdMask"
        ></div>
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
          <label class="setting-label">{{ $t('settings.outputDirectory') }}</label>
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
                min="1000"
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
              <option v-for="i in 10" :key="i" :value="i">{{ i }}x</option>
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
                v-model="autoPostProcessing"
                @change="setAutoPostProcessing"
              />
              {{ $t('settings.enableAutoPostProcessing') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="status-section">
      <div class="status-row">
        <span class="status-label">{{ $t('status.connection') }}</span>
        <span :class="['status-value', connectionMode]">
          {{ connectionMode === 'internal' ? $t('settings.internalNetwork') : $t('settings.externalNetwork') }}
        </span>
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
                <div class="theme-language-row">
                  <div class="theme-language-item">
                    <label class="setting-label">{{ $t('settings.theme') }}</label>
                    <div class="theme-selector">
                      <select v-model="tempThemeMode" class="theme-select">
                        <option value="system">{{ $t('settings.followSystem') }}</option>
                        <option value="light">{{ $t('settings.light') }}</option>
                        <option value="dark">{{ $t('settings.dark') }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="theme-language-item">
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
                    @change="updateImageProcessingParams"
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
                        v-model="enableDownsampling"
                        type="checkbox"
                        @change="updateImageProcessingParams"
                      />
                      {{ $t('advanced.enableDownsampling') }}
                    </label>
                    <div v-if="enableDownsampling" class="downsampling-presets">
                      <button
                        v-for="preset in downsamplingPresets"
                        :key="preset.key"
                        @click="selectDownsamplingPreset(preset)"
                        :class="['preset-btn', { active: selectedDownsamplingPreset === preset.key }]"
                      >
                        {{ preset.label }}
                      </button>
                    </div>
                  </div>
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
                    @change="updateImageProcessingParams"
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
            </div>
            </div>

            <!-- Network Tab -->
            <div v-show="activeAdvancedTab === 'network'" class="tab-content">
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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { AuthService, TokenManager } from '../services/authService'
import { ApiClient } from '../services/apiClient'
import { DownloadService } from '../services/downloadService'
import { taskQueueState } from '../services/taskQueueService'
import { languageService } from '../services/languageService'
import { ssimThresholdService, type SsimPresetType } from '../services/ssimThresholdService'

const { t } = useI18n()

const isLoggedIn = ref(false)
const username = ref('')
const password = ref('')
const userNickname = ref('User')
const userId = ref('user123')

// Masking state for user info
const isNicknameMasked = ref(false)
const isUserIdMasked = ref(false)
let maskingTimer: NodeJS.Timeout | null = null

// Functions for masking user info
const startMaskingTimer = () => {
  // Clear any existing timer
  if (maskingTimer) {
    clearTimeout(maskingTimer)
  }

  // Reset masking state
  isNicknameMasked.value = false
  isUserIdMasked.value = false

  // Start 5-second timer to mask user info
  maskingTimer = setTimeout(() => {
    isNicknameMasked.value = true
    isUserIdMasked.value = true
  }, 5000)
}

const toggleNicknameMask = () => {
  isNicknameMasked.value = !isNicknameMasked.value
}

const toggleUserIdMask = () => {
  isUserIdMasked.value = !isUserIdMasked.value
}

const clearMaskingTimer = () => {
  if (maskingTimer) {
    clearTimeout(maskingTimer)
    maskingTimer = null
  }
  isNicknameMasked.value = false
  isUserIdMasked.value = false
}
const connectionMode = ref<'internal' | 'external'>('external')
const muteMode = ref<'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'>('normal')
const themeMode = ref<'system' | 'light' | 'dark'>('system')
const languageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')
const tempThemeMode = ref<'system' | 'light' | 'dark'>('system')
const tempLanguageMode = ref<'system' | 'en' | 'zh' | 'ja' | 'ko'>('system')

const taskStatus = computed(() => {
  const stats = taskQueueState.value
  const queued = stats.queuedCount
  const inProgress = stats.inProgressCount
  const completed = stats.completedCount
  const errors = stats.errorCount

  // Show most relevant status (similar to download status logic)
  if (stats.isProcessing && inProgress > 0) {
    const currentTask = stats.currentTask
    if (currentTask && currentTask.progress > 0) {
      return `Processing ${currentTask.progress}%, ${queued} queued`
    } else {
      return `${inProgress} processing, ${queued} queued`
    }
  } else if (queued > 0) {
    if (stats.isProcessing) {
      return `Starting tasks... ${queued} queued`
    } else {
      return `${queued} queued (paused)`
    }
  } else if (completed > 0 || errors > 0) {
    return `${completed} completed, ${errors} failed`
  } else {
    return t('status.noTasks')
  }
})

const downloadQueueStatus = computed(() => {
  const queued = DownloadService.queuedCount
  const active = DownloadService.activeCount
  const completed = DownloadService.completedCount
  const errors = DownloadService.errorCount

  // Show most relevant status
  if (active > 0) {
    return `${active} downloading, ${queued} queued`
  } else if (queued > 0) {
    return `${queued} queued`
  } else if (completed > 0 || errors > 0) {
    return `${completed} done, ${errors} failed`
  } else {
    return t('status.noDownloads')
  }
})
const showAdvancedModal = ref(false)

// Advanced settings tabs
type AdvancedTabId = 'general' | 'imageProcessing' | 'playback' | 'network'
const activeAdvancedTab = ref<AdvancedTabId>('general')
const advancedSettingsTabs = [
  { id: 'general' as AdvancedTabId },
  { id: 'imageProcessing' as AdvancedTabId },
  { id: 'playback' as AdvancedTabId },
  { id: 'network' as AdvancedTabId }
]

const isLoading = ref(false)
const isVerifyingToken = ref(false)
const outputDirectory = ref('')
const maxConcurrentDownloads = ref(5)
const tempMaxConcurrentDownloads = ref(5)
const videoRetryCount = ref(5)
const tempVideoRetryCount = ref(5)
const preventSystemSleep = ref(true)

// Slide extraction configuration
const slideCheckInterval = ref(2000)
const slideDoubleVerification = ref(true)
const slideVerificationCount = ref(2)

// Task configuration
const taskSpeed = ref(10)
const autoPostProcessing = ref(true)

// Advanced image processing parameters
const ssimThreshold = ref(0.9987)
const tempSsimThreshold = ref(0.9987)
const ssimPreset = ref<SsimPresetType>('adaptive')

// pHash threshold configuration
const pHashThreshold = ref(10)
const tempPHashThreshold = ref(10)

// Downsampling configuration
const enableDownsampling = ref(true)
const downsampleWidth = ref(480)
const downsampleHeight = ref(270)
const selectedDownsamplingPreset = ref('480x270')

// Downsampling presets
const downsamplingPresets = [
  { key: '320x180', label: '320×180', width: 320, height: 180 },
  { key: '480x270', label: '480×270', width: 480, height: 270 },
  { key: '640x360', label: '640×360', width: 640, height: 360 },
  { key: '800x450', label: '800×450', width: 800, height: 450 }
]

// pHash exclusion list configuration
interface PHashExclusionItem {
  id: string
  name: string
  pHash: string
  createdAt: number
  isPreset?: boolean
  isEnabled?: boolean
}

const pHashExclusionList = ref<PHashExclusionItem[]>([])
const isAddingExclusion = ref(false)

// Custom input dialog state
const showNameInputModal = ref(false)
const nameInputValue = ref('')
const nameInputCallback = ref<((name: string | null) => void) | null>(null)

// Manual token authentication
const manualToken = ref('')
const showToken = ref(false)
const isVerifyingManualToken = ref(false)
const tokenVerificationStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// Intranet mapping display
interface IntranetMapping {
  type: 'single' | 'loadbalance';
  ip?: string;
  ips?: string[];
  strategy?: 'round_robin' | 'random' | 'first_available';
  currentIndex?: number;
}

const intranetMappings = ref<{ [domain: string]: IntranetMapping }>({})
const expandedMappings = ref<{ [domain: string]: boolean }>({})

// Cache management state
interface CacheStats {
  totalSize: number;
  tempFiles: number;
}

const cacheStats = ref<CacheStats>({
  totalSize: 0,
  tempFiles: 0
})

const isRefreshingCache = ref(false)
const isClearingCache = ref(false)
const isResettingData = ref(false)
const cacheOperationStatus = ref<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

const tokenManager = new TokenManager()
const authService = new AuthService(tokenManager)
const apiClient = new ApiClient()

const login = async () => {
  if (!username.value || !password.value) return

  isLoading.value = true
  try {
    const result = await authService.loginAndGetToken(username.value, password.value)

    if (result.success && result.token) {
      const verificationResult = await apiClient.verifyToken(result.token)

      if (verificationResult.valid && verificationResult.userData) {
        isLoggedIn.value = true
        userNickname.value = verificationResult.userData.nickname || username.value
        userId.value = verificationResult.userData.badge || 'unknown'
        startMaskingTimer() // Start the 5-second masking timer
        console.log('Login successful')
      } else {
        console.error('Token verification failed after login')
        alert('Login failed: Token verification failed')
      }
    } else {
      console.error('Login failed:', result.error)
      alert(`Login failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Login error:', error)
    alert('Login failed: Network error or server exception')
  } finally {
    isLoading.value = false
  }
}

const logout = () => {
  tokenManager.clearToken()
  clearMaskingTimer() // Clear masking timer and reset state
  isLoggedIn.value = false
  username.value = ''
  password.value = ''
  userNickname.value = 'User'
  userId.value = 'user123'
}

const verifyExistingToken = async () => {
  const token = tokenManager.getToken()
  if (!token) return

  isVerifyingToken.value = true
  try {
    const result = await apiClient.verifyToken(token)
    if (result.valid && result.userData) {
      isLoggedIn.value = true
      userNickname.value = result.userData.nickname || 'User'
      userId.value = result.userData.badge || 'unknown'
      startMaskingTimer() // Start the 5-second masking timer
      console.log('Existing token verified successfully')
    } else {
      if (!result.networkError) {
        tokenManager.clearToken()
        console.log('Existing token is invalid, cleared')
      } else {
        console.log('Network error during token verification, keeping token')
      }
    }
  } catch (error) {
    console.error('Token verification error:', error)
    tokenManager.clearToken()
  } finally {
    isVerifyingToken.value = false
  }
}

const loadConfig = async () => {
  try {
    const config = await window.electronAPI.config.get()
    outputDirectory.value = config.outputDirectory
    connectionMode.value = config.connectionMode
    muteMode.value = config.muteMode || 'normal'
    maxConcurrentDownloads.value = config.maxConcurrentDownloads || 5
    tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
    // Initialize DownloadService with the configured max concurrent downloads
    DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)
    videoRetryCount.value = config.videoRetryCount || 5
    tempVideoRetryCount.value = videoRetryCount.value

    // Load slide extraction configuration
    const slideConfig = await window.electronAPI.config.getSlideExtractionConfig()
    slideCheckInterval.value = slideConfig.checkInterval || 2000
    // Validate loaded value to ensure it meets new requirements
    validateAndCorrectInterval()
    slideDoubleVerification.value = slideConfig.enableDoubleVerification !== false
    slideVerificationCount.value = slideConfig.verificationCount || 2

    // Load task configuration
    taskSpeed.value = config.taskSpeed || 10
    autoPostProcessing.value = config.autoPostProcessing !== undefined ? config.autoPostProcessing : true

    // Load theme configuration
    themeMode.value = config.themeMode || 'system'

    // Load language configuration
    languageMode.value = config.languageMode || 'system'
    // Initialize language service
    await languageService.initialize()

    // Load prevent system sleep configuration
    preventSystemSleep.value = config.preventSystemSleep !== undefined ? config.preventSystemSleep : true

    // Load advanced image processing parameters
    isUpdatingProgrammatically = true
    ssimThreshold.value = slideConfig.ssimThreshold || ssimThresholdService.getThresholdValue('adaptive')
    tempSsimThreshold.value = ssimThreshold.value
    isUpdatingProgrammatically = false

    // Load SSIM preset mode from config
    const savedPresetMode = slideConfig.ssimPresetMode || 'adaptive'
    ssimPreset.value = savedPresetMode

    // Load pHash threshold from config
    pHashThreshold.value = slideConfig.pHashThreshold || 10
    tempPHashThreshold.value = pHashThreshold.value

    // Load downsampling configuration from config
    enableDownsampling.value = slideConfig.enableDownsampling !== undefined ? slideConfig.enableDownsampling : true
    downsampleWidth.value = slideConfig.downsampleWidth || 480
    downsampleHeight.value = slideConfig.downsampleHeight || 270

    // Determine selected preset based on loaded values
    const currentPreset = downsamplingPresets.find(preset =>
      preset.width === downsampleWidth.value && preset.height === downsampleHeight.value
    )
    selectedDownsamplingPreset.value = currentPreset ? currentPreset.key : '480x270'

    // Load pHash exclusion list
    await loadPHashExclusionList()
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

const selectOutputDirectory = async () => {
  try {
    const result = await window.electronAPI.config.selectOutputDirectory()
    if (result) {
      outputDirectory.value = result.outputDirectory
    }
  } catch (error) {
    console.error('Failed to select output directory:', error)
  }
}

const setConnectionMode = async (mode: 'internal' | 'external') => {
  try {
    const result = await window.electronAPI.config.setConnectionMode(mode)
    connectionMode.value = result.connectionMode
  } catch (error) {
    console.error('Failed to set connection mode:', error)
  }
}

const setMuteMode = async () => {
  try {
    const result = await window.electronAPI.config.setMuteMode(muteMode.value)
    muteMode.value = result.muteMode
  } catch (error) {
    console.error('Failed to set mute mode:', error)
  }
}

// Slide extraction configuration methods
const validateAndCorrectInterval = () => {
  // Ensure the value is a valid number
  if (isNaN(slideCheckInterval.value) || slideCheckInterval.value === null || slideCheckInterval.value === undefined) {
    slideCheckInterval.value = 2000 // Default value
    return
  }

  // Convert to integer to avoid floating point issues
  let value = Math.round(slideCheckInterval.value)

  // Enforce minimum and maximum bounds
  if (value < 1000) {
    value = 1000
  } else if (value > 10000) {
    value = 10000
  }

  // Round to nearest 500 multiple
  const remainder = value % 500
  if (remainder !== 0) {
    // Round to nearest 500 multiple
    if (remainder <= 250) {
      value = value - remainder // Round down (including exactly 250)
    } else {
      value = value + (500 - remainder) // Round up
    }
  }

  // Ensure we don't go below minimum after rounding
  if (value < 1000) {
    value = 1000
  }

  // Update the value if it was corrected
  if (value !== slideCheckInterval.value) {
    slideCheckInterval.value = value
    console.log(`Slide check interval corrected to: ${value}ms`)
  }
}

const setSlideCheckInterval = async () => {
  try {
    // Validate and correct the value before saving
    validateAndCorrectInterval()

    const result = await window.electronAPI.config.setSlideCheckInterval(slideCheckInterval.value)
    slideCheckInterval.value = result.checkInterval
  } catch (error) {
    console.error('Failed to set slide check interval:', error)
  }
}

const setSlideDoubleVerification = async () => {
  try {
    const result = await window.electronAPI.config.setSlideDoubleVerification(
      slideDoubleVerification.value,
      slideVerificationCount.value
    )
    slideDoubleVerification.value = result.enableDoubleVerification
    slideVerificationCount.value = result.verificationCount
  } catch (error) {
    console.error('Failed to set slide double verification:', error)
  }
}

// Reset methods for slide settings
const resetSlideDetectionInterval = async () => {
  try {
    slideCheckInterval.value = 2000
    validateAndCorrectInterval()
    await setSlideCheckInterval()
  } catch (error) {
    console.error('Failed to reset slide detection interval:', error)
  }
}

const resetSlideStabilityVerification = async () => {
  try {
    slideDoubleVerification.value = true
    slideVerificationCount.value = 2
    await setSlideDoubleVerification()
  } catch (error) {
    console.error('Failed to reset slide stability verification:', error)
  }
}

const setTaskSpeed = async () => {
  try {
    const result = await window.electronAPI.config.setTaskSpeed(taskSpeed.value)
    taskSpeed.value = result.taskSpeed
  } catch (error) {
    console.error('Failed to set task speed:', error)
  }
}

const setAutoPostProcessing = async () => {
  try {
    const result = await window.electronAPI.config.setAutoPostProcessing(autoPostProcessing.value)
    autoPostProcessing.value = result.autoPostProcessing
  } catch (error) {
    console.error('Failed to set auto post-processing:', error)
  }
}

const setPreventSystemSleep = async () => {
  try {
    const result = await window.electronAPI.config.setPreventSystemSleep(preventSystemSleep.value)
    preventSystemSleep.value = result.preventSystemSleep

    // Also call the power management API to immediately apply the setting
    if (preventSystemSleep.value) {
      await window.electronAPI.powerManagement.preventSleep()
    } else {
      await window.electronAPI.powerManagement.allowSleep()
    }
  } catch (error) {
    console.error('Failed to set prevent system sleep:', error)
  }
}

onMounted(() => {
  verifyExistingToken()
  loadConfig()

  // Add event listener for adaptive threshold changes
  window.addEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
})

onUnmounted(() => {
  // Remove event listener for adaptive threshold changes
  window.removeEventListener('adaptiveThresholdChanged', onAdaptiveThresholdChanged as unknown as EventListener)
  // Clear masking timer to prevent memory leaks
  clearMaskingTimer()
})

const openAdvancedSettings = async () => {
  // Reset temp values to current values when opening modal
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  tempThemeMode.value = themeMode.value
  tempLanguageMode.value = languageMode.value

  // Set programmatic update flag to prevent mode switching during initialization
  isUpdatingProgrammatically = true
  tempSsimThreshold.value = ssimThreshold.value
  tempPHashThreshold.value = pHashThreshold.value
  isUpdatingProgrammatically = false

  // Don't reinitialize SSIM preset - it should already be correctly loaded from config
  // The ssimPreset.value should maintain the value loaded from config (adaptive, normal, etc.)
  // Only update the threshold display value, not the preset mode

  // Load manual token from localStorage
  loadManualToken()
  tokenVerificationStatus.value = null
  showToken.value = false

  // Load intranet mappings
  loadIntranetMappings()

  // Load cache statistics
  refreshCacheStats()
  cacheOperationStatus.value = null

  // Load pHash exclusion list
  await loadPHashExclusionList()

  showAdvancedModal.value = true
}

const closeAdvancedSettings = () => {
  // Reset temp values when canceling
  tempMaxConcurrentDownloads.value = maxConcurrentDownloads.value
  tempVideoRetryCount.value = videoRetryCount.value
  tempSsimThreshold.value = ssimThreshold.value
  tempPHashThreshold.value = pHashThreshold.value
  tempThemeMode.value = themeMode.value
  tempLanguageMode.value = languageMode.value
  showAdvancedModal.value = false
}

const updateMaxConcurrentDownloads = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const updateVideoRetryCount = () => {
  // This is called when the select changes, but we don't save until "Save" is clicked
}

const updateImageProcessingParams = () => {
  // This is called when the inputs change, but we don't save until "Save" is clicked
}

// Downsampling preset selection method
const selectDownsamplingPreset = (preset: { key: string; label: string; width: number; height: number }) => {
  selectedDownsamplingPreset.value = preset.key
  downsampleWidth.value = preset.width
  downsampleHeight.value = preset.height
  updateImageProcessingParams()
}

// SSIM preset handling methods
let isUpdatingProgrammatically = false

const onSsimPresetChange = () => {
  if (ssimPreset.value !== 'custom') {
    isUpdatingProgrammatically = true
    tempSsimThreshold.value = ssimThresholdService.getThresholdValue(ssimPreset.value)
    isUpdatingProgrammatically = false
    updateImageProcessingParams()
  }
}

const onSsimInputChange = () => {
  // Only update preset mode if this is a manual user input, not a programmatic update
  if (!isUpdatingProgrammatically) {
    const value = tempSsimThreshold.value
    const detectedPreset = ssimThresholdService.getPresetFromValue(value)

    // Special handling for adaptive mode:
    // If current mode is adaptive and the detected preset would be 'normal' or other non-adaptive,
    // only switch if the user explicitly changed the value to match another preset exactly
    if (ssimPreset.value === 'adaptive' && detectedPreset !== 'adaptive') {
      // Only switch away from adaptive if the value exactly matches another preset
      // This prevents automatic switching when adaptive mode dynamically adjusts the value
      if (detectedPreset !== 'custom') {
        ssimPreset.value = detectedPreset
      } else {
        // If it doesn't match any preset exactly, it's custom
        ssimPreset.value = 'custom'
      }
    } else {
      // For non-adaptive modes, use normal detection logic
      ssimPreset.value = detectedPreset
    }
  }
}

// Method to update threshold value programmatically (for adaptive mode dynamic updates)
const updateThresholdProgrammatically = (newValue: number) => {
  isUpdatingProgrammatically = true
  tempSsimThreshold.value = newValue
  isUpdatingProgrammatically = false
}

// Handle adaptive threshold changes from classroom rules
const onAdaptiveThresholdChanged = async (event: CustomEvent) => {
  const { newThreshold, classrooms } = event.detail

  // Only update if we're currently in adaptive mode
  if (ssimPreset.value === 'adaptive') {
    console.log('Adaptive SSIM threshold updated due to classroom rules:', {
      newThreshold,
      classrooms: classrooms?.map((c: { name: string }) => c.name).join(', ') || 'none'
    })

    // Update the threshold programmatically to avoid triggering preset mode changes
    updateThresholdProgrammatically(newThreshold)

    // Also update the main threshold value
    ssimThreshold.value = newThreshold

    // Immediately save the new threshold to config so slide extractor can use it
    try {
      const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
        ssimThreshold: newThreshold,
        ssimPresetMode: ssimPreset.value
      })
      console.log('Classroom-based SSIM threshold saved to config:', imageProcessingResult.ssimThreshold)
    } catch (error) {
      console.error('Failed to save classroom-based SSIM threshold to config:', error)
    }
  }
}

// Export for potential future use by other components
defineExpose({
  updateThresholdProgrammatically
})

const saveAdvancedSettings = async () => {
  try {
    // Save concurrent downloads setting
    const downloadResult = await window.electronAPI.config.setMaxConcurrentDownloads(tempMaxConcurrentDownloads.value)
    maxConcurrentDownloads.value = downloadResult.maxConcurrentDownloads

    // Save video retry count setting
    const retryResult = await window.electronAPI.config.setVideoRetryCount(tempVideoRetryCount.value)
    videoRetryCount.value = retryResult.videoRetryCount

    // Save image processing parameters
    const imageProcessingResult = await window.electronAPI.config.setSlideImageProcessingParams({
      ssimThreshold: tempSsimThreshold.value,
      ssimPresetMode: ssimPreset.value,
      pHashThreshold: tempPHashThreshold.value,
      enableDownsampling: enableDownsampling.value,
      downsampleWidth: downsampleWidth.value,
      downsampleHeight: downsampleHeight.value
    })
    ssimThreshold.value = imageProcessingResult.ssimThreshold
    pHashThreshold.value = imageProcessingResult.pHashThreshold || tempPHashThreshold.value

    // Save theme mode if changed
    if (tempThemeMode.value !== themeMode.value) {
      const themeResult = await window.electronAPI.config.setThemeMode(tempThemeMode.value)
      themeMode.value = themeResult.themeMode
    }

    // Save language mode if changed
    if (tempLanguageMode.value !== languageMode.value) {
      const langResult = await window.electronAPI.config.setLanguageMode(tempLanguageMode.value)
      languageMode.value = langResult.languageMode
      await languageService.setLanguageMode(tempLanguageMode.value)
    }

    // Also update the download service
    const { DownloadService } = await import('../services/downloadService')
    DownloadService.setMaxConcurrent(maxConcurrentDownloads.value)

    showAdvancedModal.value = false
  } catch (error) {
    console.error('Failed to save advanced settings:', error)
    alert('Failed to save settings')
  }
}

// Manual token authentication methods
const toggleTokenVisibility = () => {
  showToken.value = !showToken.value
  // Update input type dynamically
  const tokenInput = document.querySelector('.token-input') as HTMLInputElement
  if (tokenInput) {
    tokenInput.type = showToken.value ? 'text' : 'password'
  }
}

const onTokenInput = () => {
  // Clear previous verification status when user types
  tokenVerificationStatus.value = null
  // Save token to localStorage as user types
  if (manualToken.value.trim()) {
    tokenManager.saveToken(manualToken.value.trim())
  } else {
    tokenManager.clearToken()
  }
}

const verifyManualToken = async () => {
  if (!manualToken.value.trim()) return

  isVerifyingManualToken.value = true
  tokenVerificationStatus.value = null

  try {
    const result = await apiClient.verifyToken(manualToken.value.trim())

    if (result.valid && result.userData) {
      tokenVerificationStatus.value = {
        type: 'success',
        message: `Token verified successfully for ${result.userData.nickname || 'user'}`
      }

      // Update login state
      isLoggedIn.value = true
      userNickname.value = result.userData.nickname || 'User'
      userId.value = result.userData.badge || 'unknown'
      startMaskingTimer() // Start the 5-second masking timer

      // Save the verified token
      tokenManager.saveToken(manualToken.value.trim())

      console.log('Manual token verification successful')
    } else {
      tokenVerificationStatus.value = {
        type: 'error',
        message: result.networkError ? 'Network error during verification' : 'Invalid token'
      }

      if (!result.networkError) {
        // Clear invalid token
        tokenManager.clearToken()
        manualToken.value = ''
      }
    }
  } catch (error) {
    console.error('Token verification error:', error)
    tokenVerificationStatus.value = {
      type: 'error',
      message: 'Verification failed: Network error or server exception'
    }
  } finally {
    isVerifyingManualToken.value = false
  }
}

const loadManualToken = () => {
  // Load existing token from localStorage when opening advanced settings
  const existingToken = tokenManager.getToken()
  if (existingToken) {
    manualToken.value = existingToken
  }
}

// Intranet mapping methods
const loadIntranetMappings = async () => {
  try {
    const mappings = await window.electronAPI.intranet.getMappings()
    intranetMappings.value = mappings
  } catch (error) {
    console.error('Failed to load intranet mappings:', error)
  }
}

const toggleMappingExpanded = (domain: string) => {
  expandedMappings.value[domain] = !expandedMappings.value[domain]
}

const getStrategyDisplayName = (strategy?: string) => {
  switch (strategy) {
    case 'round_robin':
      return t('advanced.roundRobin')
    case 'random':
      return t('advanced.random')
    case 'first_available':
      return t('advanced.firstAvailable')
    default:
      return strategy || t('advanced.roundRobin')
  }
}

// Cache management methods
const formatCacheSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const refreshCacheStats = async () => {
  isRefreshingCache.value = true
  cacheOperationStatus.value = null

  try {
    const stats = await window.electronAPI.cache?.getStats?.()
    if (stats) {
      cacheStats.value = {
        totalSize: stats.totalSize || 0,
        tempFiles: stats.tempFiles || 0
      }
    }
  } catch (error) {
    console.error('Failed to refresh cache stats:', error)
    cacheOperationStatus.value = {
      type: 'error',
      message: t('advanced.cacheStatsError')
    }
  } finally {
    isRefreshingCache.value = false
  }
}

const clearCache = async () => {
  // Show confirmation dialog
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('advanced.cancel'), t('advanced.clearCache')],
    defaultId: 1,
    cancelId: 0,
    title: t('advanced.clearCacheTitle'),
    message: t('advanced.clearCacheMessage'),
    detail: t('advanced.clearCacheDetail')
  })

  if (confirmed?.response !== 1) {
    return // User cancelled
  }

  isClearingCache.value = true
  cacheOperationStatus.value = null

  try {
    const result = await window.electronAPI.cache?.clear?.()
    if (result?.success) {
      cacheOperationStatus.value = {
        type: 'success',
        message: t('advanced.cacheClearSuccess')
      }
      // Refresh stats after clearing
      await refreshCacheStats()
    } else {
      throw new Error(result?.error || 'Unknown error')
    }
  } catch (error) {
    console.error('Failed to clear cache:', error)
    cacheOperationStatus.value = {
      type: 'error',
      message: t('advanced.cacheClearError')
    }
  } finally {
    isClearingCache.value = false
  }
}

const resetAllData = async () => {
  // Show confirmation dialog with strong warning
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('advanced.cancel'), t('advanced.resetAllData')],
    defaultId: 0,
    cancelId: 0,
    title: t('advanced.resetAllDataTitle'),
    message: t('advanced.resetAllDataMessage'),
    detail: t('advanced.resetAllDataDetail')
  })

  if (confirmed?.response !== 1) {
    return // User cancelled
  }

  // Second confirmation for safety
  const doubleConfirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'error',
    buttons: [t('advanced.cancel'), t('advanced.confirmReset')],
    defaultId: 0,
    cancelId: 0,
    title: t('advanced.finalConfirmation'),
    message: t('advanced.finalConfirmationMessage'),
    detail: t('advanced.finalConfirmationDetail')
  })

  if (doubleConfirmed?.response !== 1) {
    return // User cancelled
  }

  isResettingData.value = true
  cacheOperationStatus.value = null

  try {
    const result = await window.electronAPI.cache?.resetAllData?.()
    if (result?.success) {
      cacheOperationStatus.value = {
        type: 'success',
        message: t('advanced.resetSuccess')
      }

      // Show restart dialog
      const shouldRestart = await window.electronAPI.dialog?.showMessageBox?.({
        type: 'info',
        buttons: [t('advanced.restartLater'), t('advanced.restartNow')],
        defaultId: 1,
        title: t('advanced.restartRequired'),
        message: t('advanced.restartRequiredMessage'),
        detail: t('advanced.restartRequiredDetail')
      })

      if (shouldRestart?.response === 1) {
        // Restart the application
        await window.electronAPI.app?.restart?.()
      }
    } else {
      throw new Error(result?.error || 'Unknown error')
    }
  } catch (error) {
    console.error('Failed to reset all data:', error)
    cacheOperationStatus.value = {
      type: 'error',
      message: t('advanced.resetError')
    }
  } finally {
    isResettingData.value = false
  }
}

// pHash exclusion list management methods
const loadPHashExclusionList = async () => {
  try {
    const exclusionList = await window.electronAPI.config.getPHashExclusionList()
    pHashExclusionList.value = exclusionList || []
  } catch (error) {
    console.error('Failed to load pHash exclusion list:', error)
    pHashExclusionList.value = []
  }
}

const addExclusionItem = async () => {
  if (isAddingExclusion.value) return

  isAddingExclusion.value = true
  try {
    // Select image file
    const result = await window.electronAPI.config.selectImageForExclusion()

    if (!result.success) {
      if (!result.canceled) {
        console.error('Failed to select image:', result.error)
        alert('Failed to select image: ' + (result.error || 'Unknown error'))
      }
      return
    }

    // Check if required data is available
    if (!result.imageBuffer || !result.fileName) {
      console.error('Missing image data or filename')
      alert('Failed to process selected image: Missing data')
      return
    }

    // Convert array back to Uint8Array
    const imageBuffer = new Uint8Array(result.imageBuffer)

    // Create image from buffer for pHash calculation
    const blob = new Blob([imageBuffer])
    const imageUrl = URL.createObjectURL(blob)

    try {
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      // Create canvas and get ImageData
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)

      // Calculate pHash using the postProcessor worker
      const pHash = await calculatePHashWithWorker(imageData)

      // Prompt for name using custom dialog
      const defaultName = result.fileName.replace(/\.[^/.]+$/, '')
      const name = await showNameInputDialog(defaultName)
      if (!name || !name.trim()) {
        return // User canceled or entered empty name
      }

      // Add to exclusion list
      await window.electronAPI.config.addPHashExclusionItem(name.trim(), pHash)

      // Reload the list
      await loadPHashExclusionList()

      console.log('Added exclusion item:', { name: name.trim(), pHash })
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  } catch (error) {
    console.error('Failed to add exclusion item:', error)
    alert('Failed to add exclusion item: ' + (error instanceof Error ? error.message : 'Unknown error'))
  } finally {
    isAddingExclusion.value = false
  }
}

const calculatePHashWithWorker = (imageData: ImageData): Promise<string> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/postProcessor.worker.ts', import.meta.url), { type: 'module' })

    const messageId = `phash_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('pHash calculation timeout'))
    }, 30000) // 30 second timeout

    worker.onmessage = (e) => {
      clearTimeout(timeout)
      worker.terminate()

      const { id, success, result, error } = e.data
      if (id === messageId) {
        if (success) {
          resolve(result)
        } else {
          reject(new Error(error || 'pHash calculation failed'))
        }
      }
    }

    worker.onerror = (error) => {
      clearTimeout(timeout)
      worker.terminate()
      reject(error)
    }

    worker.postMessage({
      id: messageId,
      type: 'calculatePHash',
      data: { imageData }
    })
  })
}

const removeExclusionItem = async (id: string) => {
  try {
    const success = await window.electronAPI.config.removePHashExclusionItem(id)
    if (success) {
      await loadPHashExclusionList()
    } else {
      console.error('Failed to remove exclusion item')
    }
  } catch (error) {
    console.error('Failed to remove exclusion item:', error)
  }
}

const editExclusionItemName = async (item: PHashExclusionItem) => {
  const newName = await showNameInputDialog(item.name)
  if (newName && newName.trim() && newName.trim() !== item.name) {
    try {
      const success = await window.electronAPI.config.updatePHashExclusionItemName(item.id, newName.trim())
      if (success) {
        await loadPHashExclusionList()
      } else {
        console.error('Failed to update exclusion item name')
      }
    } catch (error) {
      console.error('Failed to update exclusion item name:', error)
    }
  }
}

const clearExclusionList = async () => {
  try {
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'question',
      buttons: [t('advanced.cancel'), t('advanced.clearAll')],
      defaultId: 1,
      cancelId: 0,
      title: t('advanced.clearExclusionListTitle'),
      message: t('advanced.clearExclusionListMessage'),
      detail: t('advanced.clearExclusionListDetail')
    })

    if (confirmed?.response === 1) {
      await window.electronAPI.config.clearPHashExclusionList()
      await loadPHashExclusionList()
    }
  } catch (error) {
    console.error('Failed to clear exclusion list:', error)
  }
}


// Custom input dialog methods
const showNameInputDialog = (defaultValue: string = ''): Promise<string | null> => {
  return new Promise((resolve) => {
    nameInputValue.value = defaultValue
    nameInputCallback.value = resolve
    showNameInputModal.value = true

    // Focus the input field after the modal is shown
    nextTick(() => {
      const inputField = document.querySelector('.name-input-field') as HTMLInputElement
      if (inputField) {
        inputField.focus()
        inputField.select()
      }
    })
  })
}

const confirmNameInput = () => {
  const callback = nameInputCallback.value
  if (callback) {
    callback(nameInputValue.value.trim() || null)
  }
  closeNameInputDialog()
}

const cancelNameInput = () => {
  const callback = nameInputCallback.value
  if (callback) {
    callback(null)
  }
  closeNameInputDialog()
}

const closeNameInputDialog = () => {
  showNameInputModal.value = false
  nameInputValue.value = ''
  nameInputCallback.value = null
}
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

.login-form h3, .verifying-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.user-info h3 {
  margin: 5px 0 14px 20px;
  font-size: 24px;
  font-weight: 600;
}

.login-form p, .verifying-state p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
}

.user-info p {
  margin: 0 20px 10px 20px;
  font-size: 15px;
  color: #666;
}

/* Mask toggle styles */
.user-info {
  position: relative;
}

.mask-toggle {
  position: absolute;
  cursor: pointer;
  background-color: transparent;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  z-index: 10;
}

.mask-toggle:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nickname-mask-toggle {
  /* Position over the nickname area in h3 */
  top: 5px;
  left: 20px;
  right: 20px;
  height: 32px;
}

.userid-mask-toggle {
  /* Position over the userId area in first p tag */
  top: 47px;
  left: 20px;
  right: 20px;
  height: 25px;
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

.login-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn {
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
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

.logout-btn {
  width: auto;
  background-color: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 6px 16px;
  align-self: flex-start;
  margin: 4px 0 4px 20px;
}

.logout-btn:hover {
  background-color: #dc3545;
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
  align-items: center;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
  height: 35px;
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
  flex: 1;
}

.auto-post-processing-control .checkbox-label input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #007bff;
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

.setting-description {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.3;
}

/* General setting description for main settings */
.setting-item .setting-description {
  margin-top: 2px;
  margin-bottom: 6px;
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
  padding: 6px 8px;
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

  .login-form h3, .verifying-state h3, .user-info h3 {
    color: #e0e0e0;
  }

  .login-form p, .verifying-state p, .user-info p {
    color: #b0b0b0;
  }

  .mask-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
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
}

/* Intranet mapping styles - Compact version */
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
</style>