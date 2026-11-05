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
    <SsoLabPanel v-if="ssoMounted" v-show="activeTab === 'sso'">
      <template #switcher><DeveloperTabSwitch v-model="activeTab" /></template>
    </SsoLabPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ImageLabPanel from './ImageLabPanel.vue'
import ApiLabPanel from './ApiLabPanel.vue'
import SsoLabPanel from './SsoLabPanel.vue'
import DeveloperTabSwitch, { type DevTab } from './DeveloperTabSwitch.vue'

// Always opens on the API tab; the choice is not remembered.
const activeTab = ref<DevTab>('api')
const apiMounted = ref(true)
const ssoMounted = ref(false)

watch(activeTab, (tab) => {
  if (tab === 'sso') ssoMounted.value = true
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
