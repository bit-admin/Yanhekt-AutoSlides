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
  PUBLIC_RELAY_ENDPOINT,
  type LanguageMode,
  type ThemeMode,
} from '../stores/configStore'
import {
  setThemeMode,
  setLanguageMode,
  setRelayEndpoint,
  resetRelayEndpoint,
  isMixedContentRelay,
} from '../stores/settingsStore'

defineOptions({ name: 'SettingsPage' })

const { t } = useI18n()

const themeMode = computed(() => configStore.themeMode)
const languageMode = computed(() => configStore.languageMode)
const publicRelay = PUBLIC_RELAY_ENDPOINT

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
})
onUnmounted(() => {
  window.removeEventListener('keydown', onDebugKeydown)
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
