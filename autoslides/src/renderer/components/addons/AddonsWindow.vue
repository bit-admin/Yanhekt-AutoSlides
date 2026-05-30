<template>
  <div class="flex flex-col h-screen bg-surface text-text">
    <!-- Title Bar -->
    <div class="flex justify-between items-center h-[38px] bg-page border-b border-border px-2 shrink-0 [-webkit-app-region:drag]" @mousedown="startDrag">
      <div class="flex-1 flex items-center" :class="{ 'pl-[70px]': isMacOS }">
        <!-- Tab Buttons -->
        <div class="flex gap-0.5 [-webkit-app-region:no-drag]">
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'yuketang' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('yuketang')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            {{ $t('addons.tabYuketang') }}
          </button>
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'webcapture' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('webcapture')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 3h12v8H2V3zm1 1v6h10V4H3zm1 8h8v1H4v-1z" fill="currentColor"/>
              <path d="M6 6h4v3H6z" fill="currentColor"/>
            </svg>
            {{ $t('addons.tabWebCapture') }}
          </button>
        </div>
      </div>
      <div v-if="!isMacOS" class="flex gap-2 [-webkit-app-region:no-drag]">
        <button class="w-7 h-7 border-none bg-transparent rounded cursor-pointer flex items-center justify-center text-text-secondary transition-colors hover:bg-border" @click="minimizeWindow" :title="$t('window.minimize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="w-7 h-7 border-none bg-transparent rounded cursor-pointer flex items-center justify-center text-text-secondary transition-colors hover:bg-border" @click="maximizeWindow" :title="$t('window.maximize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="w-7 h-7 border-none bg-transparent rounded cursor-pointer flex items-center justify-center text-text-secondary transition-colors hover:bg-bg-danger hover:text-white" @click="closeWindow" :title="$t('window.close')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-hidden">
      <div v-show="activeTab === 'yuketang'" class="h-full">
        <YuketangTab />
      </div>
      <div v-show="activeTab === 'webcapture'" class="h-full">
        <WebCaptureTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import YuketangTab from '@renderer/components/export/YuketangTab.vue'
import WebCaptureTab from '@renderer/components/webCapture/WebCaptureTab.vue'

type TabId = 'yuketang' | 'webcapture'

const isMacOS = navigator.userAgent.includes('Mac')

// Read initial tab from URL query param
const getInitialTab = (): TabId => {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (tab === 'yuketang' || tab === 'webcapture') return tab
  return 'yuketang'
}

const activeTab = ref<TabId>(getInitialTab())

const switchTab = (tab: TabId) => {
  activeTab.value = tab
}

// Listen for tab switch IPC from main process
let cleanupSwitchTab: (() => void) | undefined
onMounted(() => {
  cleanupSwitchTab = window.electronAPI.addons?.onSwitchTab?.((tab: string) => {
    if (tab === 'yuketang' || tab === 'webcapture') {
      activeTab.value = tab as TabId
    }
  })
})

onUnmounted(() => {
  cleanupSwitchTab?.()
})

// Window controls
const minimizeWindow = () => {
  window.electronAPI.window?.minimize?.()
}

const maximizeWindow = () => {
  window.electronAPI.window?.maximize?.()
}

const closeWindow = () => {
  window.electronAPI.window?.close?.()
}

const startDrag = () => {
  // Handled by -webkit-app-region: drag in CSS
}
</script>
