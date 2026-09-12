<template>
  <div class="quarantine-notice">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
    <div class="notice-text">
      <span>{{ message }}</span>
      <div class="code-with-copy">
        <code>{{ command }}</code>
        <button type="button" class="copy-btn" :title="$t('titlebar.copy')" :aria-label="$t('titlebar.copy')" @click="copyCommand">
          <svg v-if="!copied" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// macOS "remove quarantine" hint shared by the installer-style dialogs
// (app updater, AutoSlides Extractor installer). The outer notice chrome comes
// from installerModal.css; the command block and copy button live here.
import { onUnmounted, ref } from 'vue'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('QuarantineNotice')

const props = defineProps<{
  message: string
  command: string
}>()

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copyCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.command)
  } catch (error) {
    log.warn('Failed to copy quarantine command:', error)
    return
  }
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

onUnmounted(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<style scoped>
.code-with-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.code-with-copy code {
  flex: 1;
  padding: 6px 8px;
  background: var(--bg-surface);
  border-radius: 4px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
  color: var(--text-warning);
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-warning);
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--hover-tint);
  color: var(--text-warning);
}

.copy-btn:active {
  transform: scale(0.95);
}
</style>
