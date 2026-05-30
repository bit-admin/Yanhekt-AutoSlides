<template>
  <!-- Classifier Mode Toggle -->
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.ai.ml.classifierMode') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.ai.ml.classifierModeDescription') }}</div>
      <div class="mt-2 flex gap-2">
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
      <div class="mt-2 flex gap-2">
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
    <div v-if="tempAiServiceType === 'builtin'" :class="sectionDivider">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.builtinModel') }}</label>
        <div class="mt-2 flex min-h-5 items-center rounded border border-line bg-elevated px-3 py-2.5">
          <div v-if="isLoadingBuiltinModel" class="flex items-center gap-2 text-[13px] text-fg-secondary">
            <div :class="spinnerCls"></div>
            <span>{{ $t('advanced.ai.loadingModel') }}</span>
          </div>
          <div v-else-if="builtinModelError === 'notLoggedIn'" :class="modelErrorCls">
            <span>{{ $t('advanced.ai.modelNotLoggedIn') }}</span>
          </div>
          <div v-else-if="builtinModelError === 'cloudflareBlocked'" :class="[modelErrorCls, 'flex-wrap']">
            <span>{{ $t('advanced.ai.modelCloudflareBlocked') }}</span>
            <button @click="refreshBuiltinModel" :class="refreshBtnCls" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else-if="builtinModelError === 'temporarilyUnavailable'" :class="modelErrorWarnCls">
            <span>{{ $t('advanced.ai.modelTemporarilyUnavailable') }}</span>
            <button @click="refreshBuiltinModel" :class="refreshBtnCls" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else-if="builtinModelError === 'fetchFailed'" :class="modelErrorCls">
            <span>{{ $t('advanced.ai.modelFetchFailed') }}</span>
            <button @click="refreshBuiltinModel" :class="refreshBtnCls" :title="$t('advanced.ai.refreshModel')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>
          <div v-else class="flex w-full items-center justify-between">
            <span class="font-mono text-[13px] font-medium text-fg">{{ builtinModelName || $t('advanced.ai.modelUnknown') }}</span>
            <button @click="refreshBuiltinModel" :class="refreshBtnCls" :title="$t('advanced.ai.refreshModel')">
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
        <div v-if="builtinModelError === 'cloudflareBlocked'" class="mt-2.5 flex items-start gap-2 rounded border border-[#ffc107] bg-[#fff3cd] px-3 py-2.5 text-xs leading-[1.4] text-[#856404] dark:border-[#6b5a00] dark:bg-[#4a3f00] dark:text-[#ffd54f]">
          <svg class="mt-px shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ $t('advanced.ai.cloudflareHint') }}</span>
        </div>
      </div>
      <!-- Built-in service disclaimer -->
      <div class="mt-3 rounded bg-black/[0.03] px-3 py-2.5 text-[10px] leading-[1.5] text-fg-muted dark:bg-white/5">
        {{ $t('advanced.ai.builtinDisclaimer') }}
      </div>
    </div>

    <!-- Copilot Settings (shown only when copilot is selected) -->
    <div v-if="tempAiServiceType === 'copilot'" :class="sectionDivider">
      <!-- Authenticated state -->
      <div v-if="copilotOAuthStep === 'success'" class="mb-3">
        <div class="flex items-center gap-2.5 rounded border border-[#c3e6c3] bg-[#f0f9f0] px-3 py-2.5 dark:border-[#2d5a2d] dark:bg-[#1a2e1a]">
          <img v-if="copilotAvatarUrl" :src="copilotAvatarUrl" class="h-7 w-7 rounded-full" alt="" />
          <span class="flex-1 text-[13px] font-medium text-fg">{{ copilotUsername }}</span>
          <button @click="disconnectCopilot" class="cursor-pointer rounded border border-[#dc3545] bg-transparent px-2.5 py-1 text-[11px] text-[#dc3545] transition-colors hover:bg-[#dc3545] hover:text-white">
            {{ $t('advanced.ai.copilotDisconnect') }}
          </button>
        </div>
      </div>

      <!-- Idle / Error state -->
      <div v-else-if="copilotOAuthStep === 'idle' || copilotOAuthStep === 'error'" class="mb-3">
        <button @click="startCopilotOAuth" class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#24292e] bg-[#24292e] px-3.5 py-[7px] text-xs font-medium text-white transition-colors enabled:hover:bg-[#3b434b] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d0d7de] dark:bg-[#f0f6fc] dark:text-[#24292e] dark:enabled:hover:bg-[#e6edf5]" :disabled="isCopilotLoading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          {{ $t('advanced.ai.copilotSignInWithGitHub') }}
        </button>

        <div class="my-3 flex items-center gap-2 before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
          <span class="text-[11px] uppercase text-fg-muted">{{ $t('advanced.ai.or') }}</span>
        </div>

        <div>
          <div :class="inputGroup">
            <input
              v-model="tempCopilotGhoToken"
              :type="showCopilotToken ? 'text' : 'password'"
              class="input flex-1"
              :placeholder="$t('advanced.ai.copilotTokenPlaceholder')"
            />
            <button @click="showCopilotToken = !showCopilotToken" :class="keyToggleBtn">
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
              class="flex min-w-[60px] flex-none cursor-pointer items-center justify-center rounded border border-accent bg-accent px-3 py-1.5 text-xs text-white transition-colors enabled:hover:bg-[#005ea6] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!tempCopilotGhoToken || isCopilotLoading"
            >
              <div v-if="isCopilotLoading" :class="spinnerCls"></div>
              <span v-else>{{ $t('advanced.ai.copilotAuth') }}</span>
            </button>
          </div>
        </div>

        <!-- Error messages -->
        <div v-if="copilotOAuthError" class="mt-2 rounded border border-[#fecaca] bg-[#fef2f2] px-2.5 py-2 text-xs text-[#dc2626] dark:border-[#5a2d2d] dark:bg-[#3a1a1a] dark:text-[#ff6b6b]">
          <span v-if="copilotOAuthError === 'expired_token'">{{ $t('advanced.ai.copilotDeviceCodeExpired') }}</span>
          <span v-else-if="copilotOAuthError === 'access_denied'">{{ $t('advanced.ai.copilotAccessDenied') }}</span>
          <span v-else-if="copilotOAuthError === 'invalid_token'">{{ $t('advanced.ai.copilotInvalidToken') }}</span>
          <span v-else>{{ copilotOAuthError }}</span>
        </div>
      </div>

      <!-- Waiting / Polling state -->
      <div v-else-if="copilotOAuthStep === 'waiting' || copilotOAuthStep === 'polling'" class="py-4 text-center">
        <div class="mb-2 text-xs text-fg-secondary">
          {{ $t('advanced.ai.copilotEnterCode') }}
          <a class="cursor-pointer break-all text-[#0969da] underline hover:text-[#0550ae] dark:text-[#58a6ff] dark:hover:text-[#79c0ff]" @click.prevent="openCopilotVerificationUrl" :title="copilotVerificationUri">{{ copilotVerificationUri }}</a>
        </div>
        <div class="relative mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#d0d7de] bg-[#f6f8fa] p-3 font-mono text-2xl font-bold tracking-[4px] text-[#24292e] transition-colors hover:border-[#0969da] hover:bg-[#eef1f5] dark:border-[#555] dark:bg-[#2d2d2d] dark:text-[#e0e0e0] dark:hover:border-[#58a6ff] dark:hover:bg-[#363636]" @click="copyUserCode" :title="$t('advanced.ai.copilotClickToCopy')">
          <span>{{ copilotUserCode }}</span>
          <span class="absolute right-2.5 text-[11px] font-normal tracking-normal text-[#1a7f37] dark:text-[#3fb950]" v-if="copilotCodeCopied">{{ $t('advanced.ai.copilotCopied') }}</span>
        </div>
        <div class="flex items-center justify-center gap-2 text-xs text-fg-secondary">
          <div :class="spinnerCls"></div>
          <span>{{ $t('advanced.ai.copilotWaitingForAuth') }}</span>
          <button class="flex h-[22px] w-[22px] flex-shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-fg-secondary hover:bg-line hover:text-[#dc2626] dark:hover:bg-[#404040]" @click="cancelCopilotOAuth" :title="$t('advanced.ai.copilotCancel')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Model name input (always visible in copilot mode) -->
      <div class="setting-item mt-3">
        <label class="setting-label">{{ $t('advanced.ai.modelName') }}</label>
        <div :class="inputGroup">
          <input
            v-model="tempCopilotModelName"
            type="text"
            class="input flex-1"
            :placeholder="$t('advanced.ai.copilotModelPlaceholder')"
          />
          <select v-model="selectedCopilotModelPreset" @change="onCopilotModelPresetChange" :class="presetSelectCls">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in copilotModelPresets" :key="preset.name" :value="preset.name">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Custom API Settings (shown only when custom is selected) -->
    <div v-if="tempAiServiceType === 'custom'" :class="sectionDivider">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.apiBaseUrl') }}</label>
        <div :class="inputGroup">
          <input
            v-model="tempAiCustomApiBaseUrl"
            type="text"
            class="input flex-1"
            :placeholder="$t('advanced.ai.apiBaseUrlPlaceholder')"
          />
          <select v-model="selectedApiUrlPreset" @change="onApiUrlPresetChange" :class="presetSelectCls">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in apiUrlPresets" :key="preset.url" :value="preset.url">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.ai.apiKey') }}</label>
        <div :class="inputGroup">
          <input
            v-model="tempAiCustomApiKey"
            :type="showApiKey ? 'text' : 'password'"
            class="input flex-1"
            :placeholder="$t('advanced.ai.apiKeyPlaceholder')"
          />
          <button @click="showApiKey = !showApiKey" :class="keyToggleBtn" :title="showApiKey ? $t('advanced.hideToken') : $t('advanced.showToken')">
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
        <div :class="inputGroup">
          <input
            v-model="tempAiCustomModelName"
            type="text"
            class="input flex-1"
            :placeholder="$t('advanced.ai.modelNamePlaceholder')"
          />
          <select v-model="selectedModelPreset" @change="onModelPresetChange" :class="presetSelectCls">
            <option value="">{{ $t('advanced.ai.selectPreset') }}</option>
            <option v-for="preset in modelPresets" :key="preset.name" :value="preset.name">
              {{ preset.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="setting-item" v-else>
        <label class="setting-label">{{ $t('advanced.ai.modelChain') }}</label>
        <div class="mb-2 text-[11px] leading-[1.4] text-fg-secondary">{{ $t('advanced.ai.modelChainHint') }}</div>

        <ul v-if="tempCustomModelChain.length > 0" class="m-0 list-none rounded border border-line bg-subtle p-0">
          <li
            v-for="(model, idx) in tempCustomModelChain"
            :key="idx"
            class="flex items-center gap-1.5 border-b border-line py-1.5 pl-1 pr-2 last:border-b-0"
          >
            <div class="min-w-[14px] flex-none text-center text-[11px] tabular-nums text-fg-muted">{{ idx + 1 }}</div>
            <input
              type="text"
              class="input flex-1 font-mono"
              :class="{ 'opacity-60': exhaustedModels.includes(model) }"
              :value="model"
              @input="updateModelAt(idx, ($event.target as HTMLInputElement).value)"
            />
            <div class="flex flex-none gap-1">
              <span v-if="idx === 0" :class="chainBadgePrimary">
                {{ $t('advanced.ai.modelChainPrimary') }}
              </span>
              <span v-if="exhaustedModels.includes(model)" :class="chainBadgeExhausted">
                {{ $t('advanced.ai.modelChainExhausted') }}
              </span>
            </div>
            <div class="flex flex-none gap-0.5">
              <button
                type="button"
                :class="chainBtn"
                :disabled="idx === 0"
                @click="moveModelUp(idx)"
                :title="$t('advanced.ai.modelChainMoveUp')"
                aria-label="Move up"
              >↑</button>
              <button
                type="button"
                :class="chainBtn"
                :disabled="idx >= tempCustomModelChain.length - 1"
                @click="moveModelDown(idx)"
                :title="$t('advanced.ai.modelChainMoveDown')"
                aria-label="Move down"
              >↓</button>
              <button
                type="button"
                :class="chainRemoveBtn"
                @click="removeModelAt(idx)"
                :title="$t('advanced.ai.modelChainRemove')"
                aria-label="Remove"
              >×</button>
            </div>
          </li>
        </ul>
        <div v-else class="rounded border border-dashed border-line bg-subtle p-2.5 text-center text-[11px] text-fg-muted">{{ $t('advanced.ai.modelChainEmpty') }}</div>

        <div class="mt-2 flex gap-1.5">
          <input
            v-model="newModelInput"
            type="text"
            class="input flex-1 font-mono"
            :placeholder="$t('advanced.ai.modelChainAddPlaceholder')"
            @keydown.enter.prevent="addPendingModel"
          />
          <select
            v-model="selectedAddPreset"
            @change="onAddPresetSelect"
            :class="presetSelectCls"
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
            :class="chainAddBtn"
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
    <div v-if="tempAiServiceType === 'builtin'" class="mb-4 text-[11px] leading-[1.4] text-[#e67700]">
      {{ $t('advanced.ai.rateLimitBuiltinHint') }}
    </div>
    <div v-else-if="tempAiServiceType === 'copilot'" class="mb-4 text-[11px] leading-[1.4] text-[#e67700]">
      {{ $t('advanced.ai.rateLimitCopilotHint') }}
    </div>
    <div v-else class="mb-4 text-[11px] leading-[1.4] text-[#e67700]">
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
    <h4 class="flex items-center gap-2">
      {{ $t('advanced.ai.prompts') }}
      <span :class="tempDistinguishMaybeSlide ? variantBadgeDistinguish : variantBadgeSimple">
        {{ tempDistinguishMaybeSlide
          ? $t('advanced.ai.variantDistinguish')
          : $t('advanced.ai.variantSimple') }}
      </span>
    </h4>
    <div class="setting-description mb-3">
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
          <code :class="jsonExampleCls">{"classification": "slide"}</code> {{ $t('advanced.ai.or') }} <code :class="jsonExampleCls">{"classification": "not_slide"}</code>
        </div>
        <textarea
          v-model="tempAiPromptLive"
          :class="aiTextareaCls"
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
          <code :class="jsonExampleCls">{"image_0": "slide", "image_1": "not_slide", ...}</code>
        </div>
        <textarea
          v-model="tempAiPromptRecorded"
          :class="aiTextareaCls"
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
          <code :class="jsonExampleCls">{"classification": "slide"}</code>,
          <code :class="jsonExampleCls">{"classification": "not_slide"}</code> {{ $t('advanced.ai.or') }}
          <code :class="jsonExampleCls">{"classification": "may_be_slide_edit"}</code>
        </div>
        <textarea
          v-model="tempAiPromptLiveDistinguish"
          :class="aiTextareaCls"
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
          <code :class="jsonExampleCls">{"image_0": "slide", "image_1": "not_slide", "image_2": "may_be_slide_edit", ...}</code>
        </div>
        <textarea
          v-model="tempAiPromptRecordedDistinguish"
          :class="aiTextareaCls"
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

// ---- Tailwind class-string constants (bespoke AI-settings widgets) ----
const sectionDivider = 'mt-4 border-t border-line pt-4'
const inputGroup = 'mt-2 flex items-center gap-2'
const presetSelectCls = 'select !w-auto min-w-[130px] flex-none cursor-pointer'
const keyToggleBtn =
  'flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center rounded border border-line-input bg-field text-fg-secondary transition-colors hover:bg-hover hover:text-fg'
const refreshBtnCls =
  'flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-fg-secondary transition-colors hover:bg-line hover:text-fg'
const spinnerCls = 'h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent'
const modelErrorCls = 'flex items-center gap-2 text-[13px] text-[#dc3545] dark:text-[#ff6b6b]'
const modelErrorWarnCls = 'flex items-center gap-2 text-[13px] text-[#b26a00] dark:text-[#f4c67a]'
const chainBadgeBase = 'inline-block whitespace-nowrap rounded-[10px] px-1.5 py-px text-[10px] font-medium'
const chainBadgePrimary = `${chainBadgeBase} bg-[#e7f3ff] text-[#0366d6] dark:bg-[#1b3a5c] dark:text-[#a6c8ff]`
const chainBadgeExhausted = `${chainBadgeBase} bg-[#fff4e5] text-[#b26a00] dark:bg-[#4a3400] dark:text-[#f4c67a]`
const chainBtn =
  'h-6 w-6 cursor-pointer rounded border border-line-input bg-field text-xs text-fg-secondary enabled:hover:bg-hover enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-[0.35]'
const chainRemoveBtn =
  'h-6 w-6 cursor-pointer rounded border border-line-input bg-field text-base leading-none text-[#888] enabled:hover:border-[#fcc] enabled:hover:bg-[#fee] enabled:hover:text-[#c00] disabled:cursor-not-allowed disabled:opacity-[0.35] dark:enabled:hover:border-[#6a2d2d] dark:enabled:hover:bg-[#4a1f1f] dark:enabled:hover:text-[#ff8080]'
const chainAddBtn =
  'flex-none cursor-pointer rounded border border-accent bg-accent px-3 py-1.5 text-xs text-white enabled:hover:border-[#0066a8] enabled:hover:bg-[#0066a8] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2d5a8c] dark:bg-[#2d5a8c] dark:enabled:hover:border-[#3a6ea3] dark:enabled:hover:bg-[#3a6ea3]'
const variantBadgeBase = 'inline-flex items-center rounded-[10px] border px-2 py-0.5 text-[11px] font-semibold'
const variantBadgeSimple = `${variantBadgeBase} border-[#bbdefb] bg-[#e3f2fd] text-[#0d47a1] dark:border-[#2d5985] dark:bg-[#1b3a5c] dark:text-[#a6c8ff]`
const variantBadgeDistinguish = `${variantBadgeBase} border-[#ffd99c] bg-[#fff3d6] text-[#955800] dark:border-[#6a4c1d] dark:bg-[#3d2f14] dark:text-[#f4c67a]`
const jsonExampleCls = 'whitespace-nowrap rounded-[3px] bg-black/[0.06] px-[5px] py-0.5 font-mono text-[10px] text-fg dark:bg-white/10'
const aiTextareaCls =
  'mt-2 min-h-[100px] w-full resize-y rounded border border-line-input bg-field px-3 py-2.5 font-mono text-xs leading-[1.5] text-fg focus:border-accent focus:outline-none'

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

