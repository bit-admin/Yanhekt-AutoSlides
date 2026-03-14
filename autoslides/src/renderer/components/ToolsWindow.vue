<template>
  <div class="tools-window">
    <!-- Title Bar -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-bar-drag-region" :class="{ 'macos-padding': isMacOS }">
        <!-- Tab Buttons -->
        <div class="tab-buttons">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'pdfmaker' }"
            @click="switchTab('pdfmaker')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1.5H4V8zm0 2.5h8V12H4v-1.5zm0 2.5h5v1.5H4V13z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabPdfMaker') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'trash' }"
            @click="switchTab('trash')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabTrash') }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'offline' }"
            @click="switchTab('offline')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 12a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4.5 9.5a5 5 0 016.9 0l-1 1a3.5 3.5 0 00-4.9 0l-1-1zM1.5 6.5a9 9 0 0112.9 0l-1 1a7.5 7.5 0 00-10.9 0l-1-1z" fill="currentColor"/>
              <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            {{ $t('tools.tabOffline') }}
          </button>
        </div>
      </div>
      <div v-if="!isMacOS" class="window-controls">
        <button class="window-btn minimize-btn" @click="minimizeWindow" :title="$t('window.minimize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="window-btn maximize-btn" @click="maximizeWindow" :title="$t('window.maximize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="window-btn close-btn" @click="closeWindow" :title="$t('window.close')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <div v-show="activeTab === 'pdfmaker'" class="tab-panel">
        <PdfMakerWindow />
      </div>
      <div v-show="activeTab === 'trash'" class="tab-panel">
        <TrashWindow />
      </div>
      <div v-show="activeTab === 'offline'" class="tab-panel">
        <OfflineProcessingTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PdfMakerWindow from './PdfMakerWindow.vue'
import TrashWindow from './TrashWindow.vue'
import OfflineProcessingTab from './OfflineProcessingTab.vue'

type TabId = 'pdfmaker' | 'trash' | 'offline'

const isMacOS = navigator.userAgent.includes('Mac')

// Read initial tab from URL query param
const getInitialTab = (): TabId => {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (tab === 'pdfmaker' || tab === 'trash' || tab === 'offline') return tab
  return 'pdfmaker'
}

const activeTab = ref<TabId>(getInitialTab())

const switchTab = (tab: TabId) => {
  activeTab.value = tab
}

// Listen for tab switch IPC from main process
onMounted(() => {
  window.electronAPI.tools?.onSwitchTab?.((tab: string) => {
    if (tab === 'pdfmaker' || tab === 'trash' || tab === 'offline') {
      activeTab.value = tab
    }
  })
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
  background-color: #ffffff;
  color: #333;
}

/* Title Bar */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #e0e0e0;
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

/* Tab Buttons */
.tab-buttons {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tab-btn:hover {
  background-color: rgba(0, 0, 0, 0.06);
  color: #333;
}

.tab-btn.active {
  background-color: rgba(0, 122, 204, 0.12);
  color: #007acc;
  font-weight: 500;
}

/* Window Controls */
.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.window-btn:hover {
  background-color: #e0e0e0;
}

.close-btn:hover {
  background-color: #e81123;
  color: white;
}

/* Tab Content */
.tab-content {
  flex: 1;
  overflow: hidden;
}

.tab-panel {
  height: 100%;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .tools-window {
    background-color: #1e1e1e;
    color: #e0e0e0;
  }

  .title-bar {
    background-color: #2d2d2d;
    border-bottom-color: #3d3d3d;
  }

  .tab-btn {
    color: #999;
  }

  .tab-btn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #e0e0e0;
  }

  .tab-btn.active {
    background-color: rgba(74, 158, 255, 0.15);
    color: #4a9eff;
  }

  .window-btn {
    color: #ccc;
  }

  .window-btn:hover {
    background-color: #3d3d3d;
  }
}
</style>
