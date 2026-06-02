<template>
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
            <button @click="refreshBuiltinModel" class="btn--icon" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else-if="builtinModelError === 'temporarilyUnavailable'" class="model-error model-error-warning">
            <span>{{ $t('advanced.ai.modelTemporarilyUnavailable') }}</span>
            <button @click="refreshBuiltinModel" class="btn--icon" :title="$t('advanced.ai.refreshModel')">
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
            <button @click="refreshBuiltinModel" class="btn--icon" :title="$t('advanced.ai.refreshModel')">
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
            <button @click="refreshBuiltinModel" class="btn--icon" :title="$t('advanced.ai.refreshModel')">
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
          <div class="input-group">
            <input
              v-model="tempCopilotGhoToken"
              :type="showCopilotToken ? 'text' : 'password'"
              class="text-input api-key-input"
              :placeholder="$t('advanced.ai.copilotTokenPlaceholder')"
            />
            <button @click="showCopilotToken = !showCopilotToken" class="btn btn--adornment">
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
              class="btn btn--primary copilot-verify-btn"
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
        <div class="input-group">
          <input
            v-model="tempCopilotModelName"
            type="text"
            class="text-input model-name-input"
            :placeholder="$t('advanced.ai.copilotModelPlaceholder')"
          />
          <select v-model="selectedCopilotModelPreset" @change="onCopilotModelPresetChange" class="select-field model-preset-select">
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
        <div class="input-group">
          <input
            v-model="tempAiCustomApiBaseUrl"
            type="text"
            class="text-input api-url-input"
            :placeholder="$t('advanced.ai.apiBaseUrlPlaceholder')"
          />
          <select v-model="selectedApiUrlPreset" @change="onApiUrlPresetChange" class="select-field api-url-preset-select">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in apiUrlPresets" :key="preset.url" :value="preset.url">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.apiKey') }}</label>
        <div class="input-group">
          <input
            v-model="tempAiCustomApiKey"
            :type="showApiKey ? 'text' : 'password'"
            class="text-input api-key-input"
            :placeholder="$t('advanced.ai.apiKeyPlaceholder')"
          />
          <button @click="showApiKey = !showApiKey" class="btn btn--adornment" :title="showApiKey ? $t('advanced.hideToken') : $t('advanced.showToken')">
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
        <div class="input-group">
          <input
            v-model="tempAiCustomModelName"
            type="text"
            class="text-input model-name-input"
            :placeholder="$t('advanced.ai.modelNamePlaceholder')"
          />
          <select v-model="selectedModelPreset" @change="onModelPresetChange" class="select-field model-preset-select">
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
            class="select-field model-chain-preset-select"
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
.ai-service-type-selector {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.custom-api-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

/* Copilot settings */
.copilot-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.copilot-user-info {
  margin-bottom: 12px;
}

.copilot-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--success-bg);
  border: 1px solid var(--success-border);
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
  color: var(--text-primary);
}

.copilot-disconnect-btn {
  padding: 4px 10px;
  border: 1px solid var(--danger);
  background-color: transparent;
  color: var(--danger);
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.copilot-disconnect-btn:hover {
  background-color: var(--danger);
  color: var(--text-on-accent);
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
  border: 1px solid var(--brand-github);
  background-color: var(--brand-github);
  color: var(--text-on-accent);
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
  border-top: 1px solid var(--border-input);
}

.copilot-or-divider span {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.copilot-verify-btn {
  flex: 0 0 auto;
  min-width: 60px;
}

.copilot-error {
  margin-top: 8px;
  padding: 8px 10px;
  background-color: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--danger-bright);
}

.copilot-waiting {
  text-align: center;
  padding: 16px 0;
}

.copilot-enter-code-label {
  font-size: 12px;
  color: var(--text-secondary);
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
  color: var(--text-primary);
  padding: 12px;
  background-color: var(--bg-card);
  border: 2px dashed var(--border-strong);
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s, border-color 0.15s;
}

.copilot-user-code:hover {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

.copilot-code-copied {
  position: absolute;
  right: 10px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--success);
}

.copilot-waiting-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.copilot-verification-url {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  word-break: break-all;
}

.copilot-verification-url:hover {
  color: var(--accent-hover);
}

.copilot-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
}

.copilot-cancel-btn:hover {
  background-color: var(--bg-hover);
  color: var(--danger-bright);
}

.copilot-model-setting {
  margin-top: 12px;
}

/* Token/key/url rows: shared .input-group, with top spacing under the label */
.input-group {
  margin-top: 8px;
}

.api-url-input,
.api-key-input,
.model-name-input {
  flex: 1;
  min-width: 0;
}

/* Compact auto-width preset selects (inline in a row, not full width) */
.api-url-preset-select,
.model-preset-select {
  flex: 0 0 auto;
  width: auto;
  min-width: 130px;
}

.model-chain-hint {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 8px;
}

.model-chain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-subtle);
}

.model-chain-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 4px;
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.model-chain-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--bg-input);
  color: var(--text-primary);
}

.model-chain-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
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
  background: var(--badge-active-bg);
  color: var(--badge-active-text);
}

.model-chain-badge.exhausted {
  background: var(--warning-bg);
  color: var(--warning);
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
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}

.model-chain-move-btn:hover:not(:disabled),
.model-chain-remove-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.model-chain-remove-btn {
  font-size: 16px;
  line-height: 1;
  color: var(--text-muted);
}

.model-chain-remove-btn:hover:not(:disabled) {
  background: var(--danger-bg);
  color: var(--danger-bright);
  border-color: var(--danger-border);
}

.model-chain-move-btn:disabled,
.model-chain-remove-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.model-chain-empty {
  padding: 10px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  border: 1px dashed var(--border-input);
  border-radius: 4px;
  background: var(--bg-subtle);
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
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--bg-input);
  color: var(--text-primary);
}

.model-chain-add-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

/* .select-field provides the look; this only constrains the width so the
   preset select sits inline next to the model-chain add input. */
.model-chain-preset-select {
  flex: 0 0 auto;
  width: auto;
  min-width: 130px;
}

.model-chain-add-btn {
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 12px;
  cursor: pointer;
}

.model-chain-add-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.model-chain-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.rate-limit-hint {
  font-size: 11px;
  color: var(--warning);
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
  background-color: var(--badge-active-bg);
  color: var(--badge-active-text);
  border: 1px solid var(--badge-active-bg);
}

.variant-badge-distinguish {
  background-color: var(--warning-bg);
  color: var(--warning);
  border-color: var(--warning-border);
}

.ai-prompts-variant-hint {
  margin-bottom: 12px;
}

.ai-prompt-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  background-color: var(--bg-input);
  color: var(--text-primary);
  resize: vertical;
  min-height: 100px;
  margin-top: 8px;
  line-height: 1.5;
}

.ai-prompt-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.ai-prompt-textarea::placeholder {
  color: var(--text-muted);
}

.setting-description .json-example {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10px;
  background-color: var(--hover-tint);
  padding: 2px 5px;
  border-radius: 3px;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Built-in model display styles */
.builtin-model-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.builtin-model-display {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 10px 12px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  min-height: 20px;
}

.model-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.loading-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.model-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger-bright);
  font-size: 13px;
}

.model-error.model-error-warning {
  color: var(--warning);
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
  color: var(--text-primary);
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
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
  background-color: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--warning);
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
  color: var(--text-muted);
  line-height: 1.5;
  background-color: var(--hover-tint);
  border-radius: 4px;
}

</style>
