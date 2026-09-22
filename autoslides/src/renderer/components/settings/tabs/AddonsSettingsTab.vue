<template>
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
import { useSettingsContext } from '@features/settings/settingsContext'

const { advanced } = useSettingsContext()
const { tempShowToolsButton } = advanced.addons
</script>

<style scoped>
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
