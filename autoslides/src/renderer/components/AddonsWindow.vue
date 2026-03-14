<template>
  <div class="addons-window">
    <!-- Title Bar -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-bar-drag-region" :class="{ 'macos-padding': isMacOS }">
        <!-- Tab Buttons -->
        <div class="tab-buttons">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'yuketang' }"
            @click="switchTab('yuketang')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l4.5 2.5L8 8 3.5 5.5 8 3zM2.5 6.3L7.5 9v4.2l-5-2.8V6.3zm11 0v4.1l-5 2.8V9l5-2.7z" fill="currentColor"/>
            </svg>
            {{ $t('addons.tabYuketang') }}
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
      <div v-show="activeTab === 'yuketang'" class="tab-panel">
        <YuketangTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import YuketangTab from './YuketangTab.vue'

type TabId = 'yuketang'

const isMacOS = navigator.userAgent.includes('Mac')

// Read initial tab from URL query param
const getInitialTab = (): TabId => {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (tab === 'yuketang') return tab
  return 'yuketang'
}

const activeTab = ref<TabId>(getInitialTab())

const switchTab = (tab: TabId) => {
  activeTab.value = tab
}

// Listen for tab switch IPC from main process
onMounted(() => {
  window.electronAPI.addons?.onSwitchTab?.((tab: string) => {
    if (tab === 'yuketang') {
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
.addons-window {
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
  .addons-window {
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
