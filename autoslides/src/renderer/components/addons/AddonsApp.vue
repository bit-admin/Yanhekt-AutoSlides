<template>
  <div class="h-screen w-full overflow-hidden bg-page">
    <AddonsWindow />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { configStore } from '@shared/services/configStore'
import AddonsWindow from './AddonsWindow.vue'
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
    console.error('Failed to load language config:', error)
  }
})
</script>
