<template>
  <div class="settings-page">
    <!-- Section switcher: a centered iOS-style segmented pill (single row). -->
    <div class="settings-tabs-wrap">
      <div class="settings-segment" role="tablist">
        <button
          v-for="tab in advanced.advancedSettingsTabs"
          :key="tab.id"
          role="tab"
          :aria-selected="advanced.activeAdvancedTab.value === tab.id"
          @click="advanced.activeAdvancedTab.value = tab.id"
          :class="['settings-segment-btn', { active: advanced.activeAdvancedTab.value === tab.id }]"
        >
          {{ $t(`advanced.tabs.${tab.id}`) }}
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="settings-body custom-scrollbar">
      <div v-show="advanced.activeAdvancedTab.value === 'general'" class="tab-content">
        <GeneralSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'imageProcessing'" class="tab-content">
        <ImageProcessingSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'playback'" class="tab-content">
        <PlaybackSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'network'" class="tab-content">
        <NetworkSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'ai'" class="tab-content">
        <AISettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'cloud'" class="tab-content">
        <CloudSettingsTab />
      </div>
    </div>

    <!-- Sticky footer actions -->
    <footer class="settings-footer">
      <span
        v-if="footerFeedback"
        :class="['settings-footer-feedback', footerFeedback]"
        role="status"
        aria-live="polite"
      >
        {{ $t(`advanced.${footerFeedback}`) }}
      </span>
      <button class="btn" :disabled="isSaving" @click="onCancel">{{ $t('advanced.cancel') }}</button>
      <button class="btn btn--primary" :disabled="isSaving" @click="onSave">{{ $t('advanced.save') }}</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Settings as a full-width Workspace page (replaces the former AdvancedSettings
// modal). The six settings composables are provided high (App.vue) so this page —
// a sibling of LeftPanel under the same root — can inject the same bundle the
// gear button's state belongs to. Buffered edits commit on Save, discard on
// Cancel, and discard when the user navigates away without choosing either.
import { onUnmounted, ref, watch } from 'vue'
import { useSettingsContext } from '@features/settings/settingsContext'
import { navigationStore } from '@features/course/navigationStore'
import GeneralSettingsTab from './tabs/GeneralSettingsTab.vue'
import ImageProcessingSettingsTab from './tabs/ImageProcessingSettingsTab.vue'
import PlaybackSettingsTab from './tabs/PlaybackSettingsTab.vue'
import NetworkSettingsTab from './tabs/NetworkSettingsTab.vue'
import AISettingsTab from './tabs/AISettingsTab.vue'
import CloudSettingsTab from './tabs/CloudSettingsTab.vue'

const { advanced } = useSettingsContext()

// Brief footer confirmation that Cancel/Save actually ran — the handlers already
// work, but without this the sticky buttons feel dead after click.
type FooterFeedback = 'applied' | 'discarded'
const footerFeedback = ref<FooterFeedback | null>(null)
const isSaving = ref(false)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const showFooterFeedback = (kind: FooterFeedback, duration = 2000) => {
  footerFeedback.value = kind
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    footerFeedback.value = null
    feedbackTimer = null
  }, duration)
}

// Refresh buffers/loads on entry; discard buffered edits when leaving the page by
// any route (sidebar nav, gear button elsewhere) without Save/Cancel. The page is
// lazily mounted on first visit, so the immediate run sees activeNav === 'settings'.
// Leave-without-Save discards silently — no footer feedback (user already left).
watch(
  () => navigationStore.activeNav.value,
  (nav, prev) => {
    if (nav === 'settings') {
      footerFeedback.value = null
      void advanced.prepareSettings()
    } else if (prev === 'settings') {
      advanced.discardSettings()
    }
  },
  { immediate: true }
)

// Save persists the buffered edits and stays on the page. Cancel reverts the UI
// to the currently-saved config (drops buffered edits) and also stays.
const onSave = async () => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await advanced.commitSettings()
    showFooterFeedback('applied')
  } finally {
    isSaving.value = false
  }
}

const onCancel = () => {
  if (isSaving.value) return
  advanced.discardSettings()
  showFooterFeedback('discarded')
}

onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
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

/* Centered segmented control (one row) instead of a second underline tab bar. */
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
  /* Wide left/right gutters so the form rows sit in a comfortable inset column
     rather than spanning edge-to-edge. */
  padding: 16px 96px 28px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  max-width: 720px;
  margin: 0 auto;
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-elevated);
  flex-shrink: 0;
}

.settings-footer-feedback {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  animation: settings-feedback-in 0.15s ease-out;
}

.settings-footer-feedback.applied {
  color: var(--success);
}

.settings-footer-feedback.discarded {
  color: var(--text-secondary);
}

@keyframes settings-feedback-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
