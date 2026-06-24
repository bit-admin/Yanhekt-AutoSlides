<template>
  <div class="tools-window">
    <!-- Title Bar -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-bar-drag-region" :class="{ 'macos-padding': isMacOS }">
        <!-- Tab Buttons -->
        <div class="toolwin-tabs">
          <button
            class="toolwin-tab"
            :class="{ active: activeTab === 'offline' }"
            @click="switchTab('offline')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 12a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4.5 9.5a5 5 0 016.9 0l-1 1a3.5 3.5 0 00-4.9 0l-1-1zM1.5 6.5a9 9 0 0112.9 0l-1 1a7.5 7.5 0 00-10.9 0l-1-1z" fill="currentColor"/>
              <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            {{ $t('tools.tabOffline') }}
          </button>
          <button
            class="toolwin-tab"
            :class="{ active: activeTab === 'compress' }"
            @click="switchTab('compress')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm3 2H4v8h8V6h-2V4H6zm1 0v1h2V4H7zm-2 5h6v1H5V9z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabCompressLecture') }}
          </button>
          <button
            class="toolwin-tab"
            :class="{ active: activeTab === 'webcapture' }"
            @click="switchTab('webcapture')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 3h12v8H2V3zm1 1v6h10V4H3zm1 8h8v1H4v-1z" fill="currentColor"/>
              <path d="M6 6h4v3H6z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabWebCapture') }}
          </button>
          <button
            class="toolwin-tab"
            :class="{ active: activeTab === 'yuketang' }"
            @click="switchTab('yuketang')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabYuketang') }}
          </button>
        </div>
      </div>
      <div v-if="!isMacOS" class="win-controls">
        <button class="win-btn" @click="minimizeWindow" :title="$t('window.minimize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="win-btn" @click="maximizeWindow" :title="$t('window.maximize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="win-btn win-btn--close" @click="closeWindow" :title="$t('window.close')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <div v-show="activeTab === 'offline'" class="tab-panel">
        <OfflineProcessingTab />
      </div>
      <div v-show="activeTab === 'compress'" class="tab-panel">
        <CompressLectureTab />
      </div>
      <div v-show="activeTab === 'webcapture'" class="tab-panel">
        <WebCaptureTab />
      </div>
      <div v-show="activeTab === 'yuketang'" class="tab-panel">
        <YuketangTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import OfflineProcessingTab from '@renderer/components/offline/OfflineProcessingTab.vue'
import CompressLectureTab from './CompressLectureTab.vue'
import WebCaptureTab from '@renderer/components/webCapture/WebCaptureTab.vue'
import YuketangTab from '@renderer/components/export/YuketangTab.vue'

type TabId = 'offline' | 'compress' | 'webcapture' | 'yuketang'

const isValidTab = (tab: string | null): tab is TabId =>
  tab === 'offline' || tab === 'compress' || tab === 'webcapture' || tab === 'yuketang'

const isMacOS = navigator.userAgent.includes('Mac')

// Read initial tab from URL query param
const getInitialTab = (): TabId => {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return isValidTab(tab) ? tab : 'offline'
}

const activeTab = ref<TabId>(getInitialTab())

const switchTab = (tab: TabId) => {
  activeTab.value = tab
}

// Listen for tab switch IPC from main process
let cleanupSwitchTab: (() => void) | undefined
onMounted(() => {
  cleanupSwitchTab = window.electronAPI.tools?.onSwitchTab?.((tab: string) => {
    if (isValidTab(tab)) {
      activeTab.value = tab
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

<style scoped>
.tools-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

/* Title Bar */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  background-color: var(--bg-page-alt);
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
  padding: 0 8px;
  flex-shrink: 0;
}

.title-bar-drag-region {
  flex: 1;
  display: flex;
  align-items: center;
}

.title-bar-drag-region.macos-padding {
  padding-left: 70px;
}

/* Tab bar + window controls use the shared .toolwin-* / .win-* classes */

/* Tab Content */
.tab-content {
  flex: 1;
  overflow: hidden;
}

.tab-panel {
  height: 100%;
}

</style>
