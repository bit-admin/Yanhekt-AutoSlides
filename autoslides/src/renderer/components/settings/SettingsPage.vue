<template>
  <div class="settings-page">
    <!-- Section switcher: a centered iOS-style segmented pill (single row). -->
    <div class="settings-tabs-wrap">
      <div class="settings-segment" role="tablist" :aria-label="$t('titlebar.settings')" @keydown="onTabKeydown">
        <button
          v-for="tab in advanced.advancedSettingsTabs"
          :key="tab.id"
          role="tab"
          :id="`settings-tab-${tab.id}`"
          :aria-controls="`settings-panel-${tab.id}`"
          :tabindex="advanced.activeAdvancedTab.value === tab.id ? 0 : -1"
          :aria-selected="advanced.activeAdvancedTab.value === tab.id"
          @click="advanced.activeAdvancedTab.value = tab.id"
          :class="['settings-segment-btn', { active: advanced.activeAdvancedTab.value === tab.id }]"
        >
          {{ $t(`advanced.tabs.${tab.id}`) }}
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="settings-body custom-scrollbar" :inert="isSaving || isLoading" :aria-busy="isSaving || isLoading">
      <div v-show="advanced.activeAdvancedTab.value === 'general'" id="settings-panel-general" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-general">
        <GeneralSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'imageProcessing'" id="settings-panel-imageProcessing" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-imageProcessing">
        <ImageProcessingSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'playback'" id="settings-panel-playback" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-playback">
        <PlaybackSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'network'" id="settings-panel-network" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-network">
        <NetworkSettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'ai'" id="settings-panel-ai" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-ai">
        <AISettingsTab />
      </div>
      <div v-show="advanced.activeAdvancedTab.value === 'addons'" id="settings-panel-addons" class="tab-content" role="tabpanel" aria-labelledby="settings-tab-addons">
        <AddonsSettingsTab />
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
      <button class="btn" :disabled="isSaving || isLoading" @click="onCancel">{{ $t('advanced.cancel') }}</button>
      <button class="btn btn--primary" :disabled="isSaving || isLoading" @click="onSave">{{ $t('advanced.save') }}</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Settings as a full-width Workspace page (replaces the former AdvancedSettings
// modal). The settings composables are provided high (App.vue) so this page —
// a sibling of LeftPanel under the same root — can inject the same bundle the
// gear button's state belongs to. Buffered edits commit on Save, discard on
// Cancel, and discard when the user navigates away without choosing either.
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useSettingsContext } from '@features/settings/settingsContext'
import { navigationStore } from '@features/course/navigationStore'
import GeneralSettingsTab from './tabs/GeneralSettingsTab.vue'
import ImageProcessingSettingsTab from './tabs/ImageProcessingSettingsTab.vue'
import PlaybackSettingsTab from './tabs/PlaybackSettingsTab.vue'
import NetworkSettingsTab from './tabs/NetworkSettingsTab.vue'
import AISettingsTab from './tabs/AISettingsTab.vue'
import AddonsSettingsTab from './tabs/AddonsSettingsTab.vue'

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

// While the drafts are being filled the form takes no edits, so a late answer
// cannot overwrite one. The cap keeps a stuck load from locking the page.
const LOAD_LOCK_MS = 4000
const isLoading = ref(false)
let loadRun = 0
const reload = async () => {
  const run = ++loadRun
  isLoading.value = true
  try {
    await Promise.race([
      advanced.prepareSettings(),
      new Promise((resolve) => setTimeout(resolve, LOAD_LOCK_MS)),
    ])
  } finally {
    if (run === loadRun) isLoading.value = false
  }
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
      void reload()
    } else if (prev === 'settings') {
      advanced.discardSettings()
    }
  },
  { immediate: true }
)

// Save persists the buffered edits and stays on the page. Cancel reverts the UI
// to the currently-saved config (drops buffered edits) and also stays.
const onTabKeydown = (event: KeyboardEvent) => {
  const tabs = advanced.advancedSettingsTabs
  const at = tabs.findIndex((tab) => tab.id === advanced.activeAdvancedTab.value)
  const next = event.key === 'ArrowRight' ? (at + 1) % tabs.length
    : event.key === 'ArrowLeft' ? (at + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : -1
  if (next < 0) return
  event.preventDefault()
  advanced.activeAdvancedTab.value = tabs[next].id
  void nextTick(() => document.getElementById(`settings-tab-${tabs[next].id}`)?.focus())
}

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

// Cancel re-runs the page-entry load rather than discardSettings(): several
// buffers (AI tab incl. model chain + prompts, auto-crop/YOLO params) have no
// in-memory committed copy and are only re-seeded from config by the loads.
const onCancel = async () => {
  if (isSaving.value || isLoading.value) return
  await reload()
  showFooterFeedback('discarded')
}

onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<style scoped>
.settings-page {
  container-type: inline-size;
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
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
  box-sizing: border-box;
  gap: 2px;
  padding: 3px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 9px;
}

.settings-segment-btn {
  padding: 6px clamp(8px, 2cqi, 16px);
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
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  /* Wide left/right gutters so the form rows sit in a comfortable inset column
     rather than spanning edge-to-edge. */
  padding: 16px clamp(16px, 9cqi, 96px) 28px;
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
