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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { configStore, type LanguageMode, type ThemeMode } from '../stores/configStore'
import { setThemeMode, setLanguageMode } from '../stores/settingsStore'

defineOptions({ name: 'SettingsPage' })

const themeMode = computed(() => configStore.themeMode)
const languageMode = computed(() => configStore.languageMode)

const onThemeChange = (e: Event) => {
  setThemeMode((e.target as HTMLSelectElement).value as ThemeMode)
}

const onLanguageChange = (e: Event) => {
  setLanguageMode((e.target as HTMLSelectElement).value as LanguageMode)
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

@media (max-width: 600px) {
  .settings-body {
    padding: 16px 24px 28px;
  }
}
</style>
