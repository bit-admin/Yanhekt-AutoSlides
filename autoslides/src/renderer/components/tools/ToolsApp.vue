<template>
  <div class="tools-app">
    <ToolsWindow />
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ToolsApp');
import { onMounted } from 'vue'
import { configStore } from '@shared/services/configStore'
import ToolsWindow from './ToolsWindow.vue'
import { setI18nLanguage, detectSystemLanguage } from '@shared/i18n'

// Load language from config on mount
onMounted(async () => {
  try {
    const config = configStore
    if (config.languageMode === 'system') {
      setI18nLanguage(detectSystemLanguage())
    } else if (config.languageMode) {
      setI18nLanguage(config.languageMode as 'en' | 'zh' | 'ja' | 'ko')
    }
  } catch (error) {
    log.error('Failed to load language config:', error)
  }
})
</script>

<style scoped>
.tools-app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-surface);
}
</style>
