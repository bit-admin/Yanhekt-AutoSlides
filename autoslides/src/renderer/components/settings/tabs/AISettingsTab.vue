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
            <button @click="refreshBuiltinModel" class="refresh-btn" :title="$t('advanced.ai.refreshModel')">
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

.setting-description .json-example {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10px;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 3px;
  color: #333;
  white-space: nowrap;
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

.model-error.model-error-warning {
  color: #b26a00;
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

  .setting-description .json-example {
    background-color: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
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

  .model-error.model-error-warning {
    color: #f4c67a;
  }

  .builtin-disclaimer {
    background-color: rgba(255, 255, 255, 0.05);
    color: #888;
  }

  /* ModelScope Model Chain dark mode */
  .model-chain-hint {
    color: #aaa;
  }

  .model-chain-list {
    background-color: #262626;
    border-color: #404040;
  }

  .model-chain-row {
    border-bottom-color: #333;
  }

  .model-chain-index {
    color: #888;
  }

  .model-chain-input,
  .model-chain-add-input {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .model-chain-input:focus,
  .model-chain-add-input:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.15);
  }

  .model-chain-badge.primary {
    background-color: #1b3a5c;
    color: #a6c8ff;
  }

  .model-chain-badge.exhausted {
    background-color: #4a3400;
    color: #f4c67a;
  }

  .model-chain-move-btn,
  .model-chain-remove-btn {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #ccc;
  }

  .model-chain-move-btn:hover:not(:disabled),
  .model-chain-remove-btn:hover:not(:disabled) {
    background-color: #3a3a3a;
    color: #e0e0e0;
  }

  .model-chain-remove-btn:hover:not(:disabled) {
    background-color: #4a1f1f;
    color: #ff8080;
    border-color: #6a2d2d;
  }

  .model-chain-empty {
    color: #888;
    border-color: #404040;
    background-color: rgba(255, 255, 255, 0.02);
  }

  .model-chain-preset-select {
    background-color: #2d2d2d;
    border-color: #404040;
    color: #e0e0e0;
  }

  .model-chain-add-btn {
    background-color: #2d5a8c;
    border-color: #2d5a8c;
    color: #ffffff;
  }

  .model-chain-add-btn:hover:not(:disabled) {
    background-color: #3a6ea3;
    border-color: #3a6ea3;
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
}
</style>
