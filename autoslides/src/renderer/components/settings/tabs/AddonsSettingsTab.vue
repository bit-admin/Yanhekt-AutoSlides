<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.addons.watchNotesTitle') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.addons.watchNotesDescription') }}</div>
      <div class="prevent-sleep-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempWatchNotesEnabled" />
          {{ $t('advanced.addons.watchNotesEnable') }}
        </label>
      </div>
    </div>

    <!-- Provider picker, same segmented row as AI → Service Type. One provider
         today; the row is built from WATCH_NOTES_PROVIDERS so new ones slot in. -->
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.addons.providerLabel') }}</label>
      <div class="setting-description">{{ $t('advanced.addons.providerDescription') }}</div>
      <div class="addon-provider-selector">
        <button
          v-for="provider in WATCH_NOTES_PROVIDERS"
          :key="provider"
          type="button"
          :class="['mode-btn', { active: tempWatchNotesProvider === provider }]"
          :aria-pressed="tempWatchNotesProvider === provider"
          @click="tempWatchNotesProvider = provider"
        >
          {{ $t(PROVIDER_LABEL_KEYS[provider]) }}
        </button>
      </div>

      <template v-if="tempWatchNotesProvider === 'yanhekt'">
        <div class="setting-description addon-provider-detail">{{ $t('advanced.addons.providerYanhektDetail') }}</div>
        <div v-if="!cloudStorageStore.canUse.value" class="addon-provider-warning" role="status">
          {{ $t('advanced.addons.yanhektNotReady') }}
          <a href="#" class="external-link" @click.prevent="advanced.activeAdvancedTab.value = 'cloud'">
            {{ $t('advanced.addons.openCloudSettings') }}
          </a>
        </div>
      </template>
      <div v-else-if="tempWatchNotesProvider === 'obsidian'" class="setting-description addon-provider-detail">
        {{ $t('advanced.addons.providerObsidianDetail') }}
      </div>
      <template v-else-if="tempWatchNotesProvider === 'notion'">
        <div class="setting-description addon-provider-detail">{{ $t('advanced.addons.providerNotionDetail') }}</div>
        <div v-if="!configStore.notionConnected" class="addon-provider-warning" role="status">
          {{ $t('advanced.addons.notionNotConnected') }}
        </div>
      </template>
    </div>

    <!-- Notion provider: a personal internal connection. The token is checked
         and stored as soon as Connect is clicked.
         The page is chosen per lecture in the Notes tab. -->
    <template v-if="tempWatchNotesProvider === 'notion'">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.addons.notionSetupTitle') }}</label>
        <!-- Same bordered block as the Tools list below: one row per step. -->
        <ol class="addon-steps">
          <li class="addon-step">
            <span class="addon-step-number" aria-hidden="true">1</span>
            <i18n-t keypath="advanced.addons.notionStep1" tag="span" class="addon-step-text">
              <template #link>
                <a href="#" class="external-link" @click.prevent="openNotionConnections">{{ $t('advanced.addons.notionConnectionsLink') }}</a>
              </template>
            </i18n-t>
          </li>
          <li v-for="n in [2, 3, 4]" :key="n" class="addon-step">
            <span class="addon-step-number" aria-hidden="true">{{ n }}</span>
            <span class="addon-step-text">{{ $t(`advanced.addons.notionStep${n}`) }}</span>
          </li>
        </ol>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.addons.notionToken') }}</label>
        <template v-if="configStore.notionConnected">
          <div class="input-group addon-token-row">
            <input
              :value="notionStoredToken"
              :type="showNotionToken ? 'text' : 'password'"
              readonly
              spellcheck="false"
              class="text-input addon-path-input"
            />
            <button
              type="button"
              class="btn btn--adornment"
              :title="showNotionToken ? $t('advanced.hideToken') : $t('advanced.showToken')"
              @click="showNotionToken = !showNotionToken"
            >
              <svg v-if="showNotionToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="button" class="btn btn--danger-outline" :disabled="notionBusy" @click="disconnectNotion">
              {{ $t('advanced.addons.notionDisconnect') }}
            </button>
          </div>
          <div class="addon-connected">
            <span class="addon-connected-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ configStore.notionWorkspaceName
                ? $t('advanced.addons.notionConnectedTo', { name: configStore.notionWorkspaceName })
                : $t('advanced.addons.notionConnected') }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="setting-description">{{ $t('advanced.addons.notionTokenDescription') }}</div>
          <form class="input-group" @submit.prevent="connectNotion">
            <input
              v-model="notionTokenInput"
              :type="showNotionToken ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              class="text-input addon-path-input"
              :placeholder="$t('advanced.addons.notionTokenPlaceholder')"
            />
            <button
              type="button"
              class="btn btn--adornment"
              :title="showNotionToken ? $t('advanced.hideToken') : $t('advanced.showToken')"
              @click="showNotionToken = !showNotionToken"
            >
              <svg v-if="showNotionToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="submit" class="btn" :disabled="notionBusy || !notionTokenInput.trim()">
              {{ notionBusy ? $t('advanced.addons.notionConnecting') : $t('advanced.addons.notionConnect') }}
            </button>
          </form>
          <div v-if="notionErrorText" class="addon-provider-warning addon-provider-error" role="status">
            {{ notionErrorText }}
          </div>
        </template>
      </div>
    </template>

    <!-- Obsidian provider settings. A note chosen in the Notes panel may live in
         any vault; this vault is where lecture notes are created. -->
    <template v-if="tempWatchNotesProvider === 'obsidian'">
      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.addons.obsidianVault') }}</label>
        <div class="setting-description">{{ $t('advanced.addons.obsidianVaultDescription') }}</div>
        <div class="input-group">
          <input
            :value="tempObsidianVaultPath"
            type="text"
            readonly
            class="text-input addon-path-input"
            :placeholder="$t('advanced.addons.obsidianVaultPlaceholder')"
            :title="tempObsidianVaultPath"
          />
          <button type="button" class="btn" @click="selectObsidianVault">{{ $t('settings.browse') }}</button>
        </div>
        <div v-if="tempObsidianVaultPath && tempObsidianVaultIsVault === false" class="addon-provider-warning" role="status">
          {{ $t('advanced.addons.obsidianNotAVault') }}
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.addons.obsidianFolder') }}</label>
        <div class="setting-description">{{ $t('advanced.addons.obsidianFolderDescription') }}</div>
        <input
          v-model="tempObsidianSubfolder"
          type="text"
          class="text-input addon-path-input"
          :placeholder="$t('advanced.addons.obsidianFolderPlaceholder')"
        />
      </div>

      <div class="setting-item">
        <div class="setting-description">{{ $t('advanced.addons.obsidianAutoCreateDescription') }}</div>
        <div class="prevent-sleep-control">
          <label class="checkbox-label">
            <input type="checkbox" v-model="tempObsidianAutoCreateNote" />
            {{ $t('advanced.addons.obsidianAutoCreate') }}
          </label>
        </div>
      </div>
    </template>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.addons.toolsTitle') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.addons.toolsDescription') }}</div>
      <!-- What the Tools window holds, in its own tab order. Glyphs match the
           Tools window's tab icons so the two surfaces read as one thing. -->
      <ul class="addon-tool-list" :aria-label="$t('advanced.addons.includedTools')">
        <li class="addon-tool">
          <svg class="addon-tool-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3h12v8H2V3zm1 1v6h10V4H3zm1 8h8v1H4v-1z" fill="currentColor"/>
            <path d="M6 6h4v3H6z" fill="currentColor"/>
          </svg>
          <div class="addon-tool-text">
            <span class="addon-tool-name">{{ $t('tools.tabWebCapture') }}</span>
            <span class="addon-tool-description">{{ $t('advanced.addons.webCaptureDescription') }}</span>
          </div>
        </li>
        <li class="addon-tool">
          <svg class="addon-tool-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
          </svg>
          <div class="addon-tool-text">
            <span class="addon-tool-name">{{ $t('tools.tabYuketang') }}</span>
            <span class="addon-tool-description">{{ $t('advanced.addons.yuketangDescription') }}</span>
          </div>
        </li>
      </ul>

      <div class="prevent-sleep-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempShowToolsButton" />
          {{ $t('advanced.addons.showToolsButton') }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { WATCH_NOTES_PROVIDERS, type WatchNotesProviderId } from '@common/watchNotesProviders'
import { NOTION_CONNECTIONS_URL } from '@common/notionLinks'
import { configStore } from '@shared/services/configStore'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { useSettingsContext } from '@features/settings/settingsContext'

// Typed by provider id, so adding a provider fails to compile until it has a label.
const PROVIDER_LABEL_KEYS: Record<WatchNotesProviderId, string> = {
  yanhekt: 'advanced.addons.providerYanhekt',
  obsidian: 'advanced.addons.providerObsidian',
  notion: 'advanced.addons.providerNotion',
}

const { t } = useI18n()
const { advanced } = useSettingsContext()
const {
  tempWatchNotesEnabled,
  tempWatchNotesProvider,
  tempObsidianVaultPath,
  tempObsidianSubfolder,
  tempObsidianAutoCreateNote,
  tempObsidianVaultIsVault,
  selectObsidianVault,
  notionTokenInput,
  notionStoredToken,
  showNotionToken,
  notionBusy,
  notionError,
  connectNotion,
  disconnectNotion,
  tempShowToolsButton,
} = advanced.addons

const notionErrorText = computed(() => {
  switch (notionError.value) {
    case null: return ''
    case 'unauthorized': return t('advanced.addons.notionErrorUnauthorized')
    case 'network': return t('advanced.addons.notionErrorNetwork')
    default: return t('advanced.addons.notionErrorOther')
  }
})

function openNotionConnections(): void {
  void window.electronAPI.shell.openExternal(NOTION_CONNECTIONS_URL)
}
</script>

<style scoped>
.addon-provider-selector {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.addon-provider-detail {
  margin-top: 8px;
}

.addon-path-input {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.addon-provider-warning {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--warning);
}

.addon-provider-error {
  color: var(--danger);
}

.addon-steps {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.addon-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
}

.addon-step + .addon-step {
  border-top: 1px solid var(--border-color);
}

.addon-step-number {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--bg-selected);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.addon-step-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.addon-token-row {
  margin-top: 4px;
}

.addon-connected {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 4px;
}

.addon-connected-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
}

.addon-connected-text svg {
  color: var(--success);
}

.addon-tool-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.addon-tool {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
}

.addon-tool + .addon-tool {
  border-top: 1px solid var(--border-color);
}

.addon-tool-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--text-secondary);
}

.addon-tool-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.addon-tool-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.addon-tool-description {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}
</style>
