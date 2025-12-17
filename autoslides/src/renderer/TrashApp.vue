<template>
  <div class="trash-app">
    <TrashWindow />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import TrashWindow from './components/TrashWindow.vue'
import { setI18nLanguage, detectSystemLanguage } from './i18n'

// Load language from config on mount
onMounted(async () => {
  try {
    const config = await window.electronAPI.config.get()
    if (config.languageMode === 'system') {
      setI18nLanguage(detectSystemLanguage())
    } else if (config.languageMode) {
      setI18nLanguage(config.languageMode as 'en' | 'zh' | 'ja' | 'ko')
    }
  } catch (error) {
    console.error('Failed to load language config:', error)
  }
})
</script>

<style scoped>
.trash-app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f5f5;
}

@media (prefers-color-scheme: dark) {
  .trash-app {
    background-color: #1e1e1e;
  }
}
</style>
