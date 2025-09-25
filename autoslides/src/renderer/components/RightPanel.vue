<template>
  <div class="right-panel">
    <div class="navigation-bar">
      <button
        :class="['nav-btn', { active: currentTab === 'task' }]"
        @click="switchTab('task')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        Task
      </button>
      <button
        :class="['nav-btn', { active: currentTab === 'download' }]"
        @click="switchTab('download')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    </div>

    <div class="content-area">
      <!-- Task Mode Container -->
      <div
        :class="['tab-container', { 'tab-hidden': currentTab !== 'task' }]"
        data-tab="task"
      >
        <div class="task-content">
          <div class="section-header">
            <h3>Task Management</h3>
          </div>
          <div class="placeholder-content">
            <div class="placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 11l3 3 8-8"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
              </svg>
            </div>
            <p>Task management features will be implemented here</p>
            <div class="feature-list">
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9,11 12,14 22,4"/>
                  <path d="M21,12v7a2,2 0,0,1-2,2H5a2,2 0,0,1-2-2V5a2,2 0,0,1,2-2h11"/>
                </svg>
                <span>Task tracking</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span>Progress monitoring</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14,9V5a3,3 0,0,0-6,0v4"/>
                  <rect x="2" y="9" width="20" height="12" rx="2" ry="2"/>
                </svg>
                <span>Status updates</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Download Mode Container -->
      <div
        :class="['tab-container', { 'tab-hidden': currentTab !== 'download' }]"
        data-tab="download"
      >
        <div class="download-content">
          <div class="section-header">
            <h3>Download Manager</h3>
          </div>
          <div class="placeholder-content">
            <div class="placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <p>Download management features will be implemented here</p>
            <div class="feature-list">
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>File downloads</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="12" x2="2" y2="12"/>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <span>Queue management</span>
              </div>
              <div class="feature-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 3v18h18"/>
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                </svg>
                <span>Progress tracking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type Tab = 'task' | 'download'

interface TabState {
  // Future state properties for each tab can be added here
  // For example: tasks, downloads, filters, etc.
  initialized: boolean;
}

const currentTab = ref<Tab>('task')

// Maintain independent state for each tab
const taskState = ref<TabState>({
  initialized: true
})

const downloadState = ref<TabState>({
  initialized: true
})

const switchTab = (tab: Tab) => {
  currentTab.value = tab
}
</script>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.navigation-bar {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  background-color: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
}

.nav-btn:hover {
  background-color: #e9ecef;
}

.nav-btn.active {
  background-color: white;
  border-bottom-color: #007acc;
  color: #007acc;
}

.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-container {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: opacity 0.2s ease-in-out;
  overflow-y: auto;
}

.tab-container.tab-hidden {
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

.task-content, .download-content {
  padding: 16px;
  height: 100%;
}

.section-header {
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
  color: #666;
}

.placeholder-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.placeholder-content p {
  margin: 0 0 24px 0;
  font-size: 14px;
  font-style: italic;
  line-height: 1.4;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 200px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
}

.feature-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>