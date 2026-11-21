<template>
  <div ref="pageEl" class="developer-page">
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
import { nextTick, ref, watch } from 'vue'
import ImageLabPanel from './ImageLabPanel.vue'
import ApiLabPanel from './ApiLabPanel.vue'
import SsoLabPanel from './SsoLabPanel.vue'
import DeveloperTabSwitch, { type DevTab } from './DeveloperTabSwitch.vue'

// Always opens on the API tab; the choice is not remembered.
const pageEl = ref<HTMLElement | null>(null)
const activeTab = ref<DevTab>('api')
const apiMounted = ref(true)
const ssoMounted = ref(false)

watch(activeTab, (tab) => {
  if (tab === 'sso') ssoMounted.value = true
  // Each panel has its own switch, so the focused one is about to be hidden.
  const hadFocus = !!pageEl.value?.querySelector('[role="tab"]:focus')
  if (!hadFocus) return
  void nextTick(() => {
    const selected = pageEl.value?.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]') ?? []
    ;[...selected].find((el) => el.getClientRects().length > 0)?.focus()
  })
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
