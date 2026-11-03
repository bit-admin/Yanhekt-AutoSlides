<template>
  <div class="developer-page">
    <!-- Both stay mounted so switching keeps images, requests and responses.
         Each panel puts the switch at the left of its own toolbar. -->
    <ImageLabPanel v-show="activeTab === 'image'">
      <template #switcher><DeveloperTabSwitch v-model="activeTab" /></template>
    </ImageLabPanel>
    <ApiLabPanel v-if="apiMounted" v-show="activeTab === 'api'">
      <template #switcher><DeveloperTabSwitch v-model="activeTab" /></template>
    </ApiLabPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ImageLabPanel from './ImageLabPanel.vue'
import ApiLabPanel from './ApiLabPanel.vue'
import DeveloperTabSwitch, { type DevTab } from './DeveloperTabSwitch.vue'

const TAB_KEY = 'autoslides.developer.tab'

function readTab(): DevTab {
  try {
    return localStorage.getItem(TAB_KEY) === 'api' ? 'api' : 'image'
  } catch {
    return 'image'
  }
}

const activeTab = ref<DevTab>(readTab())
const apiMounted = ref(activeTab.value === 'api')

watch(activeTab, (tab) => {
  if (tab === 'api') apiMounted.value = true
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Remembering the tab is a convenience only.
  }
})
</script>

<style scoped>
.developer-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

.developer-page > * {
  flex: 1;
  min-height: 0;
}
</style>
