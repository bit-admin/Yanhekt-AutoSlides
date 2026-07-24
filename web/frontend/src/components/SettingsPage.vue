<template>
  <div class="settings-page">
    <!-- Section switcher: a centered iOS-style segmented pill (single row). -->
    <div class="settings-tabs-wrap">
      <div class="settings-segment" role="tablist">
        <button
          role="tab"
          aria-selected="true"
          class="settings-segment-btn active"
        >
          {{ $t('advanced.tabs.general') }}
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="settings-body custom-scrollbar">
      <div class="tab-content">
        <div class="advanced-setting-section">
          <h4>{{ $t('advanced.appearance') }}</h4>
          <div class="setting-item">
            <div class="two-col-row">
              <div class="two-col-item">
                <label class="setting-label" for="settings-theme">{{ $t('settings.theme') }}</label>
                <select
                  id="settings-theme"
                  class="select-field"
                  :value="themeMode"
                  @change="onThemeChange"
                >
                  <option value="system">{{ $t('settings.followSystem') }}</option>
                  <option value="light">{{ $t('settings.light') }}</option>
                  <option value="dark">{{ $t('settings.dark') }}</option>
                </select>
              </div>
              <div class="two-col-item">
                <label class="setting-label" for="settings-language">{{ $t('settings.language') }}</label>
                <select
                  id="settings-language"
                  class="select-field"
                  :value="languageMode"
                  @change="onLanguageChange"
                >
                  <option value="system">{{ $t('settings.followSystem') }}</option>
                  <option value="en">{{ $t('settings.english') }}</option>
                  <option value="zh">{{ $t('settings.chinese') }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="advanced-setting-section">
          <h4>{{ $t('settings.slideExtractionSection') }}</h4>
          <div class="setting-item">
            <label class="setting-toggle">
              <input
                type="checkbox"
                :checked="configStore.autoPostProcessingLive"
                @change="onAutoPostProcessingChange"
              />
              <span>{{ $t('settings.enableAutoPostProcessing') }}</span>
            </label>
            <div class="setting-description">{{ $t('settings.autoPostProcessingDescription') }}</div>
          </div>
        </div>

        <div class="advanced-setting-section">
          <h4>{{ $t('settings.aiFilteringSection') }}</h4>

          <div class="setting-item">
            <label class="setting-toggle">
              <input
                type="checkbox"
                :checked="configStore.aiFilteringEnabled"
                @change="onAiEnabledChange"
              />
              <span>{{ $t('settings.enableAIFiltering') }}</span>
            </label>
            <div class="setting-description">{{ $t('settings.aiFilteringDescription') }}</div>
          </div>

          <div class="setting-item">
            <div class="setting-label">{{ $t('settings.aiServiceType') }}</div>

            <!-- One unified panel: tabs + body share a single border -->
            <div class="ai-panel">
              <div class="ai-panel-tabs" role="radiogroup" :aria-label="$t('settings.aiServiceType')">
                <button
                  v-for="opt in aiServiceOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  class="ai-panel-tab"
                  :class="{ active: configStore.aiServiceType === opt.value }"
                  :aria-checked="configStore.aiServiceType === opt.value"
                  @click="setAiService(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>

              <div class="ai-panel-body">
                <!-- Built-in -->
                <template v-if="configStore.aiServiceType === 'builtin'">
                  <div class="ai-status-row">
                    <span class="cloud-storage-dot" :class="authStore.isLoggedIn.value ? 'is-ready' : 'is-warning'"></span>
                    <div class="ai-status-text">
                      <span class="ai-status-title">{{ $t('settings.aiServiceBuiltin') }}</span>
                      <span class="ai-status-sub">{{ $t('settings.aiBuiltinDescription') }}</span>
                    </div>
                  </div>
                  <div v-if="!authStore.isLoggedIn.value" class="setting-hint setting-hint--warning">
                    {{ $t('settings.aiBuiltinRequiresLogin') }}
                  </div>
                </template>

                <!-- GitHub Copilot -->
                <template v-else-if="configStore.aiServiceType === 'copilot'">
                  <div v-if="copilotOAuthStep === 'success'" class="ai-status-row">
                    <img
                      v-if="configStore.aiCopilotAvatarUrl"
                      class="copilot-avatar"
                      :src="configStore.aiCopilotAvatarUrl"
                      alt=""
                    />
                    <span v-else class="cloud-storage-dot is-ready"></span>
                    <div class="ai-status-text">
                      <span class="ai-status-title">{{ configStore.aiCopilotUsername || 'GitHub' }}</span>
                      <span class="ai-status-sub">{{ $t('settings.aiCopilotConnected') }}</span>
                    </div>
                    <button type="button" class="btn btn--sm" @click="disconnectCopilot">
                      {{ $t('settings.aiCopilotDisconnect') }}
                    </button>
                  </div>

                  <div v-else-if="copilotOAuthStep === 'waiting' || copilotOAuthStep === 'polling'" class="ai-stack">
                    <i18n-t keypath="settings.aiCopilotEnterCode" tag="div" class="ai-status-sub">
                      <template #url>
                        <a
                          class="copilot-link"
                          :href="copilotVerificationUri || 'https://github.com/login/device'"
                          target="_blank"
                          rel="noopener"
                        >github.com/login/device</a>
                      </template>
                    </i18n-t>
                    <button
                      type="button"
                      class="copilot-code"
                      :title="$t('settings.aiCopilotClickToCopy')"
                      @click="copyCopilotCode"
                    >
                      {{ copilotUserCode || '····' }}
                      <span v-if="copilotCodeCopied" class="copilot-copied">{{ $t('settings.aiCopilotCopied') }}</span>
                    </button>
                    <div class="copilot-wait-row">
                      <span class="copilot-spinner"></span>
                      <span class="copilot-wait-text">{{ $t('settings.aiCopilotWaiting') }}</span>
                      <button type="button" class="btn btn--sm" @click="cancelCopilotOAuth">
                        {{ $t('settings.aiCopilotCancel') }}
                      </button>
                    </div>
                  </div>

                  <div v-else class="ai-stack">
                    <button
                      type="button"
                      class="btn btn--primary copilot-signin-btn"
                      :disabled="isCopilotLoading"
                      @click="startCopilotOAuth"
                    >
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                          0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52
                          -.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2
                          -3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82
                          .64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                          .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93
                          -.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                      {{ $t('settings.aiCopilotSignIn') }}
                    </button>
                    <div class="copilot-divider"><span>{{ $t('settings.aiCopilotOr') }}</span></div>
                    <div class="copilot-token-row">
                      <input
                        v-model="copilotTokenDraft"
                        type="password"
                        class="text-input"
                        autocomplete="off"
                        spellcheck="false"
                        :placeholder="$t('settings.aiCopilotTokenPlaceholder')"
                        @keyup.enter="onVerifyCopilotToken"
                      />
                      <button
                        type="button"
                        class="btn btn--sm"
                        :disabled="isCopilotLoading || !copilotTokenDraft.trim()"
                        @click="onVerifyCopilotToken"
                      >
                        {{ $t('settings.aiCopilotVerify') }}
                      </button>
                    </div>
                    <div v-if="copilotErrorText" class="setting-hint setting-hint--error">
                      {{ copilotErrorText }}
                    </div>
                  </div>
                </template>

                <!-- Custom OpenAI-compatible endpoint -->
                <template v-else>
                  <div class="ai-stack">
                    <div class="ai-field">
                      <label class="setting-label" for="settings-ai-custom-url">{{ $t('settings.aiCustomBaseUrl') }}</label>
                      <input
                        id="settings-ai-custom-url"
                        type="url"
                        class="text-input"
                        spellcheck="false"
                        autocomplete="off"
                        :value="configStore.aiCustomBaseUrl"
                        placeholder="https://api.example.com/v1"
                        @change="onCustomFieldChange('aiCustomBaseUrl', $event)"
                      />
                    </div>
                    <div class="ai-field">
                      <label class="setting-label" for="settings-ai-custom-key">{{ $t('settings.aiCustomApiKey') }}</label>
                      <input
                        id="settings-ai-custom-key"
                        type="password"
                        class="text-input"
                        autocomplete="off"
                        :value="configStore.aiCustomApiKey"
                        @change="onCustomFieldChange('aiCustomApiKey', $event)"
                      />
                    </div>
                    <div class="ai-field">
                      <label class="setting-label" for="settings-ai-custom-model">{{ $t('settings.aiCustomModel') }}</label>
                      <input
                        id="settings-ai-custom-model"
                        type="text"
                        class="text-input"
                        spellcheck="false"
                        autocomplete="off"
                        :value="configStore.aiCustomModel"
                        @change="onCustomFieldChange('aiCustomModel', $event)"
                      />
                    </div>
                    <div class="setting-hint">{{ $t('settings.aiCustomCorsNote') }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="advanced-setting-section">
          <h4>{{ $t('settings.cloudNotesSection') }}</h4>

          <!-- Cloud storage status (ASnote + ASuser). Desktop CloudSettingsTab parity. -->
          <div class="setting-item">
            <div class="setting-description">{{ $t('settings.cloudStorageIntro') }}</div>

            <div class="cloud-storage-cards">
              <div class="cloud-storage-card">
                <span class="cloud-storage-dot" :class="statusClass"></span>
                <div class="cloud-storage-text">
                  <span class="cloud-storage-title">{{ noteGroupName }} {{ statusText }}</span>
                  <span class="cloud-storage-subtitle">{{ $t('settings.cloudStorageGroupDescription') }}</span>
                </div>
                <span v-if="noteIdText" class="cloud-storage-meta">{{ noteIdText }}</span>
              </div>

              <div class="cloud-storage-card">
                <span class="cloud-storage-dot" :class="statusClass"></span>
                <div class="cloud-storage-text">
                  <span class="cloud-storage-title">{{ userGroupLabel }} {{ statusText }}</span>
                  <span class="cloud-storage-subtitle">{{ $t('settings.cloudStorageGroupDescriptionUser') }}</span>
                </div>
                <span v-if="userIdText" class="cloud-storage-meta">{{ userIdText }}</span>
              </div>
            </div>

            <div class="cloud-storage-footer">
              <span v-if="lastCheckedText" class="cloud-storage-checked">{{ lastCheckedText }}</span>
              <span class="cloud-storage-footer-spacer"></span>
              <button
                v-if="store.status.value === 'uninitialized'"
                type="button"
                class="btn btn--primary btn--sm"
                :disabled="storageBusy"
                @click="onInitialize"
              >
                {{ $t('settings.cloudStorageInit') }}
              </button>
              <button
                type="button"
                class="btn--icon"
                :title="storageBusy ? $t('settings.cloudStorageRefreshing') : $t('settings.cloudStorageRefresh')"
                :disabled="storageBusy"
                @click="onRefreshStorage"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  :class="{ spinning: storageBusy }"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              </button>
            </div>

            <p v-if="store.status.value === 'error' && store.lastError.value" class="cloud-storage-error">
              {{ store.lastError.value }}
            </p>
          </div>

          <div class="setting-item">
            <label class="setting-toggle">
              <input
                type="checkbox"
                :checked="configStore.cloudWatchSyncEnabled"
                :disabled="watchSyncBusy"
                @change="onWatchSyncChange"
              />
              <span>{{ $t('settings.enableCloudWatchSync') }}</span>
            </label>
            <div class="setting-description">{{ $t('settings.cloudWatchSyncDescription') }}</div>
            <div v-if="watchSyncError" class="setting-hint setting-hint--error">
              {{ watchSyncError }}
            </div>
          </div>
        </div>

        <!-- Hidden debug section: reveal with Ctrl/Cmd+Shift+D while Settings is open.
             If a non-public endpoint is already stored, show it so the user can reset. -->
        <div v-if="relaySectionVisible" class="advanced-setting-section">
          <h4>{{ $t('settings.relay') }}</h4>
          <div class="setting-item">
            <div class="setting-description">{{ $t('settings.relayDescription') }}</div>
            <label class="setting-label" for="settings-relay-endpoint">
              {{ $t('settings.relayEndpoint') }}
            </label>
            <div class="relay-row">
              <input
                id="settings-relay-endpoint"
                v-model="relayDraft"
                type="url"
                class="text-input relay-endpoint-input"
                spellcheck="false"
                autocomplete="off"
                :placeholder="publicRelay"
                @change="commitRelay"
                @keyup.enter="commitRelay"
              />
              <button
                type="button"
                class="btn btn--sm"
                :disabled="isPublicRelay"
                @click="onResetRelay"
              >
                {{ $t('settings.relayUsePublic') }}
              </button>
            </div>
            <div v-if="relayError" class="setting-hint setting-hint--error">
              {{ relayError }}
            </div>
            <div v-else-if="mixedContent" class="setting-hint setting-hint--warning">
              {{ $t('settings.relayMixedContent') }}
            </div>
            <div v-else-if="isHttpRelay" class="setting-hint">
              {{ $t('settings.relayHttpNote') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  configStore,
  persistConfig,
  PUBLIC_RELAY_ENDPOINT,
  type AIServiceType,
  type LanguageMode,
  type ThemeMode,
} from '../stores/configStore'
import { useCopilotOAuth } from '../composables/useCopilotOAuth'
import {
  setThemeMode,
  setLanguageMode,
  setRelayEndpoint,
  resetRelayEndpoint,
  isMixedContentRelay,
} from '../stores/settingsStore'
import { cloudStorageStore } from '../stores/cloudStorageStore'
import { authStore } from '../stores/authStore'
import { MANAGED_GROUP_NAME, USER_GROUP_NAME } from '../lib/notes/notesTypes'

defineOptions({ name: 'SettingsPage' })

const { t } = useI18n()

const themeMode = computed(() => configStore.themeMode)
const languageMode = computed(() => configStore.languageMode)
const publicRelay = PUBLIC_RELAY_ENDPOINT
const store = cloudStorageStore

const noteGroupName = MANAGED_GROUP_NAME
const userGroupLabel = USER_GROUP_NAME

const storageBusy = computed(
  () => store.status.value === 'checking' || store.status.value === 'repairing',
)

const statusText = computed(() => {
  switch (store.status.value) {
    case 'ready':
      return t('settings.cloudStorageStatusReady')
    case 'uninitialized':
      return t('settings.cloudStorageStatusUninitialized')
    case 'not-signed-in':
      return t('settings.cloudStorageStatusNotSignedIn')
    case 'checking':
      return t('settings.cloudStorageStatusChecking')
    case 'repairing':
      return t('settings.cloudStorageStatusRepairing')
    case 'error':
      return t('settings.cloudStorageStatusError')
    default:
      return t('settings.cloudStorageStatusChecking')
  }
})

const statusClass = computed(() => {
  switch (store.status.value) {
    case 'ready':
      return 'is-ready'
    case 'uninitialized':
    case 'not-signed-in':
      return 'is-warning'
    case 'error':
      return 'is-error'
    default:
      return 'is-pending'
  }
})

const noteIdText = computed(() =>
  store.status.value === 'ready' && store.managedGroupId.value != null
    ? `ID ${store.managedGroupId.value}`
    : '',
)
const userIdText = computed(() =>
  store.status.value === 'ready' && store.userGroupId.value != null
    ? `ID ${store.userGroupId.value}`
    : '',
)

const lastCheckedText = computed(() =>
  store.lastCheckedAt.value
    ? `${t('settings.cloudStorageLastChecked')} ${new Date(store.lastCheckedAt.value).toLocaleString()}`
    : '',
)

const onRefreshStorage = () => {
  void store.refresh({ force: true })
}
const onInitialize = () => {
  void store.initialize()
}

const RELAY_UNLOCK_KEY = 'autoslides.relaySettingsUnlocked'

function isNonPublicRelay(endpoint: string): boolean {
  return (endpoint || '').replace(/\/+$/, '') !== PUBLIC_RELAY_ENDPOINT
}

// Hidden by default. Unlocked via Ctrl/Cmd+Shift+D (session), or auto-shown
// when a custom relay is already configured so it can still be cleared.
const relayUnlocked = ref(
  typeof sessionStorage !== 'undefined' && sessionStorage.getItem(RELAY_UNLOCK_KEY) === '1'
)
const relaySectionVisible = computed(
  () => relayUnlocked.value || isNonPublicRelay(configStore.relayEndpoint)
)

function unlockRelaySection(): void {
  relayUnlocked.value = true
  try {
    sessionStorage.setItem(RELAY_UNLOCK_KEY, '1')
  } catch {
    // private mode / blocked storage — in-memory unlock still works this visit
  }
}

function onDebugKeydown(e: KeyboardEvent): void {
  // Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (macOS) — common "debug panel" chord.
  // Ignore when typing in an input so we don't fight form shortcuts.
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return
  if (e.key !== 'd' && e.key !== 'D') return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    return
  }
  e.preventDefault()
  unlockRelaySection()
}

onMounted(() => {
  window.addEventListener('keydown', onDebugKeydown)
  // Soft check if launch/auth hasn't produced a status yet (or TTL expired).
  if (store.status.value === 'unknown' || store.status.value === 'error') {
    void store.refresh()
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onDebugKeydown)
  // Abort an in-flight Copilot device flow; the user can restart it later.
  cancelCopilotOAuth()
  if (copiedTimer) clearTimeout(copiedTimer)
})

// Draft text so typing doesn't thrash localStorage / playback mid-keystroke;
// commit on blur (change) or Enter.
const relayDraft = ref(configStore.relayEndpoint)
const relayError = ref<string | null>(null)

watch(
  () => configStore.relayEndpoint,
  (v) => {
    // External reset / heal — keep the input in sync when we didn't just type.
    if (v !== relayDraft.value) relayDraft.value = v
  }
)

const isPublicRelay = computed(
  () => (configStore.relayEndpoint || '').replace(/\/+$/, '') === PUBLIC_RELAY_ENDPOINT
)

const isHttpRelay = computed(() => {
  try {
    return new URL(configStore.relayEndpoint).protocol === 'http:'
  } catch {
    return false
  }
})

const mixedContent = computed(() => isMixedContentRelay(configStore.relayEndpoint))

const onThemeChange = (e: Event) => {
  setThemeMode((e.target as HTMLSelectElement).value as ThemeMode)
}

const onLanguageChange = (e: Event) => {
  setLanguageMode((e.target as HTMLSelectElement).value as LanguageMode)
}

const onAutoPostProcessingChange = (e: Event) => {
  configStore.autoPostProcessingLive = (e.target as HTMLInputElement).checked
  persistConfig()
}

// --- AI filtering ---

const {
  copilotOAuthStep,
  copilotUserCode,
  copilotVerificationUri,
  copilotOAuthError,
  isCopilotLoading,
  startCopilotOAuth,
  validateCopilotToken,
  disconnectCopilot,
  cancelCopilotOAuth,
} = useCopilotOAuth()

const copilotTokenDraft = ref('')
const copilotCodeCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const copilotErrorText = computed(() => {
  switch (copilotOAuthError.value) {
    case '':
      return ''
    case 'expired_token':
      return t('settings.aiCopilotExpired')
    case 'access_denied':
      return t('settings.aiCopilotDenied')
    case 'invalid_token':
      return t('settings.aiCopilotInvalidToken')
    default:
      return copilotOAuthError.value
  }
})

const aiServiceOptions = computed(() => [
  { value: 'builtin' as const, label: t('settings.aiServiceBuiltin') },
  { value: 'copilot' as const, label: t('settings.aiServiceCopilot') },
  { value: 'custom' as const, label: t('settings.aiServiceCustom') },
])

const onAiEnabledChange = (e: Event) => {
  configStore.aiFilteringEnabled = (e.target as HTMLInputElement).checked
  persistConfig()
}

const setAiService = (value: AIServiceType) => {
  if (configStore.aiServiceType === value) return
  configStore.aiServiceType = value
  persistConfig()
}

const onCustomFieldChange = (
  field: 'aiCustomBaseUrl' | 'aiCustomApiKey' | 'aiCustomModel',
  e: Event,
) => {
  configStore[field] = (e.target as HTMLInputElement).value.trim()
  persistConfig()
}

const onVerifyCopilotToken = async () => {
  const ok = await validateCopilotToken(copilotTokenDraft.value)
  if (ok) copilotTokenDraft.value = ''
}

const copyCopilotCode = async () => {
  if (!copilotUserCode.value) return
  try {
    await navigator.clipboard.writeText(copilotUserCode.value)
    copilotCodeCopied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copilotCodeCopied.value = false
    }, 1500)
  } catch {
    // Clipboard unavailable — the code is visible for manual copying.
  }
}

// Hybrid: enabling watch-sync while signed in runs initialize() so first-time
// accounts provision ASnote+ASuser+README here (not silently at extraction).
// Preference is only kept on when storage ends ready; already-ready uses TTL 0-network.
const watchSyncError = ref<string | null>(null)
const watchSyncBusy = ref(false)

const onWatchSyncChange = async (e: Event) => {
  const enabled = (e.target as HTMLInputElement).checked
  watchSyncError.value = null

  if (!enabled) {
    configStore.cloudWatchSyncEnabled = false
    persistConfig()
    return
  }

  if (!authStore.isLoggedIn.value) {
    // Persist intent; provision happens after sign-in + re-enable or Init.
    configStore.cloudWatchSyncEnabled = true
    persistConfig()
    return
  }

  watchSyncBusy.value = true
  try {
    // Soft check first: ready+TTL → 0 network; ready+stale → groupList only.
    // Only call initialize() when not ready so we don't re-run the README scan
    // on every enable after the TTL expires.
    let st = await store.ensureReady()
    if (st !== 'ready') {
      const ok = await store.initialize()
      st = ok ? 'ready' : store.status.value
    }
    if (st !== 'ready') {
      configStore.cloudWatchSyncEnabled = false
      persistConfig()
      watchSyncError.value =
        store.status.value === 'uninitialized'
          ? t('settings.cloudWatchSyncNeedInit')
          : t('settings.cloudWatchSyncProvisionFailed')
      return
    }
    configStore.cloudWatchSyncEnabled = true
    persistConfig()
  } finally {
    watchSyncBusy.value = false
  }
}

const commitRelay = () => {
  relayError.value = null
  const raw = relayDraft.value.trim()
  if (!raw) {
    // Empty → treat as "use public".
    relayDraft.value = resetRelayEndpoint()
    return
  }
  const stored = setRelayEndpoint(raw)
  if (!stored) {
    relayError.value = t('settings.relayInvalid')
    // Revert the draft to the last good value so the user sees what's active.
    relayDraft.value = configStore.relayEndpoint
    return
  }
  relayDraft.value = stored
}

const onResetRelay = () => {
  relayError.value = null
  relayDraft.value = resetRelayEndpoint()
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.settings-tabs-wrap {
  display: flex;
  justify-content: center;
  padding: 14px 20px 8px;
  flex-shrink: 0;
}

.settings-segment {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 9px;
}

.settings-segment-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.settings-segment-btn:hover {
  color: var(--text-primary);
}

.settings-segment-btn.active {
  background-color: var(--bg-elevated);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 96px 28px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  max-width: 720px;
  margin: 0 auto;
}

.advanced-setting-section {
  margin-bottom: 24px;
}

.advanced-setting-section h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.two-col-row {
  display: flex;
  gap: 12px;
}

.two-col-item {
  flex: 1;
}

.setting-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
  margin-bottom: 10px;
}

.setting-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  margin-bottom: 6px;
}

.setting-toggle input[type='checkbox'] {
  accent-color: var(--accent);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.setting-toggle input[type='checkbox']:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.cloud-storage-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cloud-storage-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.cloud-storage-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.cloud-storage-footer-spacer {
  flex: 1;
}

.cloud-storage-checked {
  font-size: 11px;
  color: var(--text-secondary);
}

.cloud-storage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--text-muted);
}

.cloud-storage-dot.is-ready {
  background-color: var(--success);
}
.cloud-storage-dot.is-warning {
  background-color: var(--warning);
}
.cloud-storage-dot.is-error {
  background-color: var(--danger);
}
.cloud-storage-dot.is-pending {
  background-color: var(--text-muted);
}

.cloud-storage-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.cloud-storage-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.cloud-storage-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.cloud-storage-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.cloud-storage-error {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--danger);
}

.btn--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
}

.btn--icon:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn--icon:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--icon .spinning {
  animation: cloud-spin 0.9s linear infinite;
}

@keyframes cloud-spin {
  to {
    transform: rotate(360deg);
  }
}

/* AI Filtering — one unified panel (tabs + body, single border) */

.ai-panel {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--bg-elevated);
}

.ai-panel-tabs {
  display: flex;
  width: 100%;
  background-color: var(--bg-subtle);
  border-bottom: 1px solid var(--border-color);
}

.ai-panel-tab {
  flex: 1 1 0;
  min-width: 0;
  padding: 10px 8px;
  border: none;
  border-right: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  white-space: nowrap;
}

.ai-panel-tab:last-child {
  border-right: none;
}

.ai-panel-tab:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.ai-panel-tab.active {
  background-color: var(--bg-elevated);
  color: var(--accent);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--accent);
}

.ai-panel-body {
  padding: 16px;
}

.ai-panel-body .text-input {
  width: 100%;
  display: block;
}

.ai-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-field .setting-label {
  margin-bottom: 0;
}

.ai-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ai-status-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-status-sub {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.copilot-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.copilot-signin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
}

.copilot-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: var(--bg-subtle);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 3px;
  cursor: pointer;
}

.copilot-code:hover {
  border-color: var(--accent);
}

.copilot-copied {
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--success);
}

.copilot-link {
  color: var(--link-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.copilot-wait-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copilot-wait-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
}

.copilot-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  flex-shrink: 0;
  animation: cloud-spin 0.9s linear infinite;
}

.copilot-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.copilot-divider::before,
.copilot-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.copilot-token-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
}

.copilot-token-row .text-input {
  flex: 1 1 auto;
  min-width: 0;
}

.copilot-token-row .btn {
  flex: 0 0 auto;
  min-width: 72px;
}

.relay-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.relay-endpoint-input {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.relay-row .btn {
  flex-shrink: 0;
  align-self: stretch;
}

.setting-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.setting-hint--warning {
  color: var(--warning);
}

.setting-hint--error {
  color: var(--danger);
}

@media (max-width: 600px) {
  .settings-body {
    padding: 16px 24px 28px;
  }

  .relay-row {
    flex-direction: column;
  }
}
</style>
