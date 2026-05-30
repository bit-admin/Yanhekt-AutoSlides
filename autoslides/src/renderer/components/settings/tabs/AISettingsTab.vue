<template>
  <!-- Classifier Mode Toggle -->
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.ai.ml.classifierMode') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.ai.ml.classifierModeDescription') }}</div>
      <div class="ai-service-type-selector flex gap-2 mt-2">
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
      <div class="ai-service-type-selector flex gap-2 mt-2">
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
    <div v-if="tempAiServiceType === 'builtin'" class="builtin-model-info mt-4 pt-4 border-t border-border">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.builtinModel') }}</label>
        <div class="builtin-model-display flex items-center mt-2 p-2.5 bg-elevated border border-border rounded min-h-5">
          <div v-if="isLoadingBuiltinModel" class="model-loading flex items-center gap-2 text-text-secondary text-[13px]">
            <div class="loading-spinner-small h-3.5 w-3.5 rounded-full border-2 border-border border-t-accent animate-spin"></div>
            <span>{{ $t('advanced.ai.loadingModel') }}</span>
          </div>
          <div v-else-if="builtinModelError === 'notLoggedIn'" class="model-error flex items-center gap-2 text-danger text-[13px]">
            <span>{{ $t('advanced.ai.modelNotLoggedIn') }}</span>
          </div>
          <div v-else-if="builtinModelError === 'cloudflareBlocked'" class="model-error cloudflare-error flex items-center gap-2 text-danger text-[13px] flex-wrap">
            <span>{{ $t('advanced.ai.modelCloudflareBlocked') }}</span>
            <button @click="refreshBuiltinModel" class="refresh-btn flex items-center justify-center p-1 border-none bg-transparent cursor-pointer text-text-secondary rounded transition-colors hover:bg-border hover:text-text" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else-if="builtinModelError === 'temporarilyUnavailable'" class="model-error model-error-warning flex items-center gap-2 text-warning text-[13px]">
            <span>{{ $t('advanced.ai.modelTemporarilyUnavailable') }}</span>
            <button @click="refreshBuiltinModel" class="refresh-btn flex items-center justify-center p-1 border-none bg-transparent cursor-pointer text-text-secondary rounded transition-colors hover:bg-border hover:text-text" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else-if="builtinModelError === 'fetchFailed'" class="model-error flex items-center gap-2 text-danger text-[13px]">
            <span>{{ $t('advanced.ai.modelFetchFailed') }}</span>
            <button @click="refreshBuiltinModel" class="refresh-btn flex items-center justify-center p-1 border-none bg-transparent cursor-pointer text-text-secondary rounded transition-colors hover:bg-border hover:text-text" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else class="model-name-display flex items-center justify-between w-full">
            <span class="model-name text-[13px] font-medium text-text font-['Menlo','Monaco','Consolas',monospace]">{{ builtinModelName || $t('advanced.ai.modelUnknown') }}</span>
            <button @click="refreshBuiltinModel" class="refresh-btn flex items-center justify-center p-1 border-none bg-transparent cursor-pointer text-text-secondary rounded transition-colors hover:bg-border hover:text-text" :title="$t('advanced.ai.refreshModel')">
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
        <div v-if="builtinModelError === 'cloudflareBlocked'" class="cloudflare-hint flex items-start gap-2 mt-2.5 p-2.5 bg-warning-bg border border-text-warning rounded text-xs text-warning leading-snug dark:bg-[#4a3f00] dark:border-[#6b5a00] dark:text-[#ffd54f]">
          <svg class="shrink-0 mt-px" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ $t('advanced.ai.cloudflareHint') }}</span>
        </div>
      </div>
      <!-- Built-in service disclaimer -->
      <div class="builtin-disclaimer mt-3 p-2.5 text-[10px] text-text-muted leading-relaxed bg-black/3 rounded dark:bg-white/5">
        {{ $t('advanced.ai.builtinDisclaimer') }}
      </div>
    </div>

    <!-- Copilot Settings (shown only when copilot is selected) -->
    <div v-if="tempAiServiceType === 'copilot'" class="copilot-settings mt-4 pt-4 border-t border-border">
      <!-- Authenticated state -->
      <div v-if="copilotOAuthStep === 'success'" class="copilot-user-info mb-3">
        <div class="copilot-user-row flex items-center gap-2.5 p-2.5 bg-[#f0f9f0] border border-[#c3e6c3] rounded dark:bg-[#1a2e1a] dark:border-[#2d5a2d]">
          <img v-if="copilotAvatarUrl" :src="copilotAvatarUrl" class="copilot-avatar h-7 w-7 rounded-full" alt="" />
          <span class="copilot-username flex-1 text-[13px] font-medium text-text">{{ copilotUsername }}</span>
          <button @click="disconnectCopilot" class="copilot-disconnect-btn px-2.5 py-1 border border-danger bg-transparent text-danger text-[11px] rounded cursor-pointer transition-all hover:bg-danger hover:text-white">
            {{ $t('advanced.ai.copilotDisconnect') }}
          </button>
        </div>
      </div>

      <!-- Idle / Error state -->
      <div v-else-if="copilotOAuthStep === 'idle' || copilotOAuthStep === 'error'" class="copilot-auth-section mb-3">
        <button @click="startCopilotOAuth" class="copilot-oauth-btn flex items-center justify-center gap-2 w-full py-[7px] px-3.5 border border-bg-surface bg-bg-surface text-white text-xs font-medium rounded-[6px] cursor-pointer transition-colors hover:bg-[#3b434b] disabled:opacity-60 disabled:cursor-not-allowed" :disabled="isCopilotLoading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          {{ $t('advanced.ai.copilotSignInWithGitHub') }}
        </button>

        <div class="copilot-or-divider flex items-center my-3 gap-2">
          <span class="text-[11px] text-text-muted uppercase">{{ $t('advanced.ai.or') }}</span>
        </div>

        <div class="copilot-manual-token">
          <div class="api-key-input-group flex gap-2 items-center mt-2">
            <input
              v-model="tempCopilotGhoToken"
              :type="showCopilotToken ? 'text' : 'password'"
              class="api-key-input flex-1 py-1.5 px-2 border border-border-input rounded text-[13px] bg-surface min-w-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
              :placeholder="$t('advanced.ai.copilotTokenPlaceholder')"
            />
            <button @click="showCopilotToken = !showCopilotToken" class="api-key-toggle-btn flex items-center justify-center w-[30px] h-[30px] p-0 border border-border-input rounded bg-surface cursor-pointer text-text-secondary box-border shrink-0 hover:bg-hover hover:text-text">
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
              class="copilot-verify-btn shrink-0 py-1.5 px-3 border border-accent bg-accent text-white text-xs rounded cursor-pointer transition-colors min-w-[60px] flex items-center justify-center hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="!tempCopilotGhoToken || isCopilotLoading"
            >
              <div v-if="isCopilotLoading" class="loading-spinner-small h-3.5 w-3.5 rounded-full border-2 border-border border-t-accent animate-spin"></div>
              <span v-else>{{ $t('advanced.ai.copilotAuth') }}</span>
            </button>
          </div>
        </div>

        <!-- Error messages -->
        <div v-if="copilotOAuthError" class="copilot-error mt-2 p-2 bg-[#fef2f2] border border-[#fecaca] rounded text-xs text-[#dc2626] dark:bg-[#3a1a1a] dark:border-[#5a2d2d] dark:text-text-danger">
          <span v-if="copilotOAuthError === 'expired_token'">{{ $t('advanced.ai.copilotDeviceCodeExpired') }}</span>
          <span v-else-if="copilotOAuthError === 'access_denied'">{{ $t('advanced.ai.copilotAccessDenied') }}</span>
          <span v-else-if="copilotOAuthError === 'invalid_token'">{{ $t('advanced.ai.copilotInvalidToken') }}</span>
          <span v-else>{{ copilotOAuthError }}</span>
        </div>
      </div>

      <!-- Waiting / Polling state -->
      <div v-else-if="copilotOAuthStep === 'waiting' || copilotOAuthStep === 'polling'" class="copilot-waiting text-center py-4">
        <div class="copilot-enter-code-label text-xs text-text-secondary mb-2">
          {{ $t('advanced.ai.copilotEnterCode') }}
          <a class="copilot-verification-url text-accent cursor-pointer underline break-all hover:text-accent-hover" @click.prevent="openCopilotVerificationUrl" :title="copilotVerificationUri">{{ copilotVerificationUri }}</a>
        </div>
        <div class="copilot-user-code flex items-center justify-center gap-2 text-2xl font-bold font-['Menlo','Monaco','Consolas',monospace] tracking-[4px] text-text p-3 bg-elevated border-2 border-dashed border-border-strong rounded-lg mb-3 cursor-pointer relative transition-colors hover:bg-hover hover:border-accent" @click="copyUserCode" :title="$t('advanced.ai.copilotClickToCopy')">
          <span>{{ copilotUserCode }}</span>
          <span class="copilot-code-copied absolute right-2.5 text-[11px] font-normal tracking-normal text-success" v-if="copilotCodeCopied">{{ $t('advanced.ai.copilotCopied') }}</span>
        </div>
        <div class="copilot-waiting-status flex items-center justify-center gap-2 text-xs text-text-secondary">
          <div class="loading-spinner-small h-3.5 w-3.5 rounded-full border-2 border-border border-t-accent animate-spin"></div>
          <span>{{ $t('advanced.ai.copilotWaitingForAuth') }}</span>
          <button class="copilot-cancel-btn flex items-center justify-center w-[22px] h-[22px] border-none bg-transparent text-text-secondary cursor-pointer rounded p-0 shrink-0 hover:bg-hover hover:text-danger" @click="cancelCopilotOAuth" :title="$t('advanced.ai.copilotCancel')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Model name input (always visible in copilot mode) -->
      <div class="setting-item copilot-model-setting mt-3">
        <label class="setting-label">{{ $t('advanced.ai.modelName') }}</label>
        <div class="model-name-input-group flex gap-2 items-center mt-2">
          <input
            v-model="tempCopilotModelName"
            type="text"
            class="model-name-input flex-1 py-1.5 px-3 border border-border-input rounded text-[13px] bg-surface min-w-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
            :placeholder="$t('advanced.ai.copilotModelPlaceholder')"
          />
          <select v-model="selectedCopilotModelPreset" @change="onCopilotModelPresetChange" class="model-preset-select shrink-0 min-w-[130px] py-1.5 px-3 border border-border-input rounded bg-surface text-xs cursor-pointer">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in copilotModelPresets" :key="preset.name" :value="preset.name">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Custom API Settings (shown only when custom is selected) -->
    <div v-if="tempAiServiceType === 'custom'" class="custom-api-settings mt-4 pt-4 border-t border-border">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.apiBaseUrl') }}</label>
        <div class="api-url-input-group flex gap-2 items-center mt-2">
          <input
            v-model="tempAiCustomApiBaseUrl"
            type="text"
            class="api-url-input flex-1 py-1.5 px-3 border border-border-input rounded text-[13px] bg-surface min-w-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
            :placeholder="$t('advanced.ai.apiBaseUrlPlaceholder')"
          />
          <select v-model="selectedApiUrlPreset" @change="onApiUrlPresetChange" class="api-url-preset-select shrink-0 min-w-[130px] py-1.5 px-3 border border-border-input rounded bg-surface text-xs cursor-pointer">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in apiUrlPresets" :key="preset.url" :value="preset.url">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.apiKey') }}</label>
        <div class="api-key-input-group flex gap-2 items-center mt-2">
          <input
            v-model="tempAiCustomApiKey"
            :type="showApiKey ? 'text' : 'password'"
            class="api-key-input flex-1 py-1.5 px-2 border border-border-input rounded text-[13px] bg-surface min-w-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
            :placeholder="$t('advanced.ai.apiKeyPlaceholder')"
          />
          <button @click="showApiKey = !showApiKey" class="api-key-toggle-btn flex items-center justify-center w-[30px] h-[30px] p-0 border border-border-input rounded bg-surface cursor-pointer text-text-secondary box-border shrink-0 hover:bg-hover hover:text-text" :title="showApiKey ? $t('advanced.hideToken') : $t('advanced.showToken')">
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
        <div class="model-name-input-group flex gap-2 items-center mt-2">
          <input
            v-model="tempAiCustomModelName"
            type="text"
            class="model-name-input flex-1 py-1.5 px-3 border border-border-input rounded text-[13px] bg-surface min-w-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
            :placeholder="$t('advanced.ai.modelNamePlaceholder')"
          />
          <select v-model="selectedModelPreset" @change="onModelPresetChange" class="model-preset-select shrink-0 min-w-[130px] py-1.5 px-3 border border-border-input rounded bg-surface text-xs cursor-pointer">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in modelPresets" :key="preset.name" :value="preset.name">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-item" v-else>
        <label class="setting-label">{{ $t('advanced.ai.modelChain') }}</label>
        <div class="model-chain-hint text-[11px] text-text-secondary leading-snug mb-2">{{ $t('advanced.ai.modelChainHint') }}</div>

        <ul v-if="tempCustomModelChain.length > 0" class="model-chain-list list-none m-0 p-0 border border-border rounded bg-subtle">
          <li
            v-for="(model, idx) in tempCustomModelChain"
            :key="idx"
            class="model-chain-row flex items-center gap-1.5 py-1.5 px-2 pl-1 border-b border-border last:border-b-none [&.is-exhausted_input]:opacity-60"
            :class="{ 'is-exhausted': exhaustedModels.includes(model) }"
          >
            <div class="model-chain-index shrink-0 min-w-3.5 text-center text-[11px] text-text-muted tabular-nums">{{ idx + 1 }}</div>
            <input
              type="text"
              class="model-chain-input flex-1 min-w-0 py-1.5 px-2 border border-border-input rounded text-xs font-['ui-monospace','SFMono-Regular','Menlo',monospace] bg-surface focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
              :value="model"
              @input="updateModelAt(idx, ($event.target as HTMLInputElement).value)"
            />
            <div class="model-chain-badges shrink-0 flex gap-1">
              <span v-if="idx === 0" class="model-chain-badge primary inline-block text-[10px] py-px px-1.5 rounded-[10px] font-medium whitespace-nowrap bg-accent/10 text-[#0366d6] dark:bg-[#1b3a5c] dark:text-bg-accent/30">
                {{ $t('advanced.ai.modelChainPrimary') }}
              </span>
              <span v-if="exhaustedModels.includes(model)" class="model-chain-badge exhausted inline-block text-[10px] py-px px-1.5 rounded-[10px] font-medium whitespace-nowrap bg-[#fff4e5] text-[#b26a00] dark:bg-[#4a3400] dark:text-bg-warning-bg">
                {{ $t('advanced.ai.modelChainExhausted') }}
              </span>
            </div>
            <div class="model-chain-actions shrink-0 flex gap-0.5">
              <button
                type="button"
                class="model-chain-move-btn w-6 h-6 p-0 border border-border-input rounded bg-surface text-text-secondary cursor-pointer text-xs hover:not-disabled:bg-hover hover:not-disabled:text-text disabled:opacity-35 disabled:cursor-not-allowed"
                :disabled="idx === 0"
                @click="moveModelUp(idx)"
                :title="$t('advanced.ai.modelChainMoveUp')"
                aria-label="Move up"
              >↑</button>
              <button
                type="button"
                class="model-chain-move-btn w-6 h-6 p-0 border border-border-input rounded bg-surface text-text-secondary cursor-pointer text-xs hover:not-disabled:bg-hover hover:not-disabled:text-text disabled:opacity-35 disabled:cursor-not-allowed"
                :disabled="idx >= tempCustomModelChain.length - 1"
                @click="moveModelDown(idx)"
                :title="$t('advanced.ai.modelChainMoveDown')"
                aria-label="Move down"
              >↓</button>
              <button
                type="button"
                class="model-chain-remove-btn w-6 h-6 p-0 border border-border-input rounded bg-surface text-[#888] cursor-pointer text-base leading-none hover:not-disabled:bg-[#fee] hover:not-disabled:text-[#c00] hover:not-disabled:border-[#fcc] disabled:opacity-35 disabled:cursor-not-allowed"
                @click="removeModelAt(idx)"
                :title="$t('advanced.ai.modelChainRemove')"
                aria-label="Remove"
              >×</button>
            </div>
          </li>
        </ul>
        <div v-else class="model-chain-empty p-2.5 text-[11px] text-text-muted text-center border border-dashed border-border-input rounded bg-subtle dark:bg-white/2">{{ $t('advanced.ai.modelChainEmpty') }}</div>

        <div class="model-chain-add-row flex gap-1.5 mt-2">
          <input
            v-model="newModelInput"
            type="text"
            class="model-chain-add-input flex-1 min-w-0 py-1.5 px-2 border border-border-input rounded text-xs font-['ui-monospace','SFMono-Regular','Menlo',monospace] bg-surface focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
            :placeholder="$t('advanced.ai.modelChainAddPlaceholder')"
            @keydown.enter.prevent="addPendingModel"
          />
          <select
            v-model="selectedAddPreset"
            @change="onAddPresetSelect"
            class="model-chain-preset-select shrink-0 min-w-[130px] py-1.5 px-2 border border-border-input rounded bg-surface text-xs cursor-pointer"
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
            class="model-chain-add-btn shrink-0 py-1.5 px-3 border border-accent rounded bg-accent text-white text-xs cursor-pointer hover:not-disabled:bg-accent-hover hover:not-disabled:border-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
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
    <div v-if="tempAiServiceType === 'builtin'" class="rate-limit-hint text-[11px] text-warning leading-snug mb-4">
      {{ $t('advanced.ai.rateLimitBuiltinHint') }}
    </div>
    <div v-else-if="tempAiServiceType === 'copilot'" class="rate-limit-hint text-[11px] text-warning leading-snug mb-4">
      {{ $t('advanced.ai.rateLimitCopilotHint') }}
    </div>
    <div v-else class="rate-limit-hint text-[11px] text-warning leading-snug mb-4">
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
    <h4 class="ai-prompts-header flex items-center gap-2">
      {{ $t('advanced.ai.prompts') }}
      <span
        class="variant-badge inline-flex items-center py-0.5 px-2 rounded-[10px] text-[11px] font-semibold bg-accent/10 text-[#0d47a1] border border-bg-accent/20 dark:bg-[#1b3a5c] dark:text-bg-accent/30 dark:border-[#2d5985]"
        :class="tempDistinguishMaybeSlide
          ? 'variant-badge-distinguish dark:!bg-[#3d2f14] dark:!text-bg-warning-bg dark:!border-[#6a4c1d]'
          : ''"
      >
        {{ tempDistinguishMaybeSlide
          ? $t('advanced.ai.variantDistinguish')
          : $t('advanced.ai.variantSimple') }}
      </span>
    </h4>
    <div class="setting-description ai-prompts-variant-hint mb-3">
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
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"classification": "slide"}</code> {{ $t('advanced.ai.or') }} <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"classification": "not_slide"}</code>
        </div>
        <textarea
          v-model="tempAiPromptLive"
          class="ai-prompt-textarea w-full p-2.5 border border-border-input rounded text-xs font-['Menlo','Monaco','Consolas',monospace] bg-surface resize-y min-h-[100px] mt-2 leading-relaxed focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
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
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"image_0": "slide", "image_1": "not_slide", ...}</code>
        </div>
        <textarea
          v-model="tempAiPromptRecorded"
          class="ai-prompt-textarea w-full p-2.5 border border-border-input rounded text-xs font-['Menlo','Monaco','Consolas',monospace] bg-surface resize-y min-h-[100px] mt-2 leading-relaxed focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
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
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"classification": "slide"}</code>,
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"classification": "not_slide"}</code> {{ $t('advanced.ai.or') }}
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"classification": "may_be_slide_edit"}</code>
        </div>
        <textarea
          v-model="tempAiPromptLiveDistinguish"
          class="ai-prompt-textarea w-full p-2.5 border border-border-input rounded text-xs font-['Menlo','Monaco','Consolas',monospace] bg-surface resize-y min-h-[100px] mt-2 leading-relaxed focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
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
          <code class="json-example font-['SF_Mono','Monaco','Menlo','Consolas',monospace] text-[10px] bg-black/6 py-px px-1 rounded-sm text-text whitespace-nowrap dark:bg-white/10">{"image_0": "slide", "image_1": "not_slide", "image_2": "may_be_slide_edit", ...}</code>
        </div>
        <textarea
          v-model="tempAiPromptRecordedDistinguish"
          class="ai-prompt-textarea w-full p-2.5 border border-border-input rounded text-xs font-['Menlo','Monaco','Consolas',monospace] bg-surface resize-y min-h-[100px] mt-2 leading-relaxed focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(0,122,204,0.1)]"
          rows="6"
          :placeholder="$t('advanced.ai.promptPlaceholder')"
        ></textarea>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsContext } from '@features/settings/settingsContext'
import MlThresholdSlider from '../MlThresholdSlider.vue'

const { advanced, cache, ai } = useSettingsContext()

const { tempDistinguishMaybeSlide } = advanced
const { formatCacheSize } = cache

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
  importCustomMlModel,
  deleteCustomMlModel,
} = ai

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
</script>

<style scoped>
/* Copilot or-divider pseudo-element lines — requires pseudo-elements */
.copilot-or-divider::before,
.copilot-or-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border-input);
}

/* Model chain exhausted row: dim child input — parent class targets child */
.model-chain-row.is-exhausted .model-chain-input {
  opacity: 0.6;
}

/* Distinguish variant badge color override — custom amber palette not in theme tokens */
.variant-badge-distinguish {
  background-color: var(--warning-bg);
  color: var(--warning);
  border-color: var(--warning-border);
}
</style>
