<template>
  <div class="tools-demo-overlay">
    <div class="tools-demo-modal">
      <!-- Title Bar with Tabs -->
      <div class="tools-demo-title-bar">
        <div class="tab-buttons">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'results' }"
            @click.stop
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
            </svg>
            Results View
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'pdfmaker' }"
            @click.stop
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1.5H4V8zm0 2.5h8V12H4v-1.5zm0 2.5h5v1.5H4V13z" fill="currentColor"/>
            </svg>
            PDF Maker
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tools-demo-content">
        <!-- Results View -->
        <div v-if="activeTab === 'results'" class="results-demo">
          <!-- Toolbar -->
          <div class="toolbar">
            <div class="toolbar-left">
              <button v-if="resultsView === 'images'" class="back-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                Back
              </button>
              <template v-if="resultsView === 'images'">
                <div class="filter-group">
                  <label>View:</label>
                  <select class="filter-select" disabled>
                    <option>Show Context</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label>Reason:</label>
                  <select class="filter-select" disabled>
                    <option>All</option>
                  </select>
                </div>
              </template>
              <button class="refresh-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
                </svg>
                Refresh
              </button>
            </div>
            <div v-if="resultsView === 'images'" class="actions">
              <button class="delete-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
                </svg>
                Delete
              </button>
              <button class="restore-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
                  <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
                </svg>
                Restore
              </button>
              <button class="clear-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
                </svg>
                Clear Trash
              </button>
            </div>
          </div>

          <!-- Folder List -->
          <div v-if="resultsView === 'folders'" class="content-area">
            <div class="folder-list">
              <button
                v-for="folder in demoFolders"
                :key="folder.name"
                class="folder-item"
                :class="{ 'folder-item-last-visited': folder.lastVisited }"
              >
                <div class="folder-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                    <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                  </svg>
                </div>
                <div class="folder-copy">
                  <div class="folder-mainline">
                    <span class="folder-name">{{ folder.name }}</span>
                    <div class="folder-counts">
                      <span class="folder-count-text">
                        <span class="count-value">{{ folder.activeCount }}</span>
                        <span class="count-label">active</span>
                      </span>
                      <span class="folder-count-separator">/</span>
                      <span class="folder-count-text">
                        <span class="count-value">{{ folder.removedCount }}</span>
                        <span class="count-label">removed</span>
                      </span>
                    </div>
                  </div>
                </div>
                <svg class="folder-chevron" width="16" height="16" viewBox="0 0 16 16">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Image Grid -->
          <div v-else id="tour-results-grid" class="content-area">
            <div class="results-grid">
              <div
                v-for="item in demoImages"
                :key="item.name"
                class="result-item"
                :class="{ removed: item.status === 'removed' }"
              >
                <div class="item-thumbnail">
                  <div class="thumbnail-placeholder" :style="{ backgroundColor: item.color }">
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <rect x="4" y="4" width="24" height="24" rx="2" fill="white" opacity="0.3"/>
                      <rect x="7" y="12" width="18" height="2" rx="1" fill="white" opacity="0.4"/>
                      <rect x="7" y="17" width="12" height="2" rx="1" fill="white" opacity="0.3"/>
                    </svg>
                  </div>
                </div>
                <div class="item-copy">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-badges">
                    <span v-if="item.isCropped" class="status-badge cropped">Cropped</span>
                    <span class="status-badge" :class="item.status">{{ item.status === 'active' ? 'Extracted' : 'Removed' }}</span>
                    <span
                      v-if="item.reason"
                      :class="['reason-badge', `reason-${item.reason}`]"
                    >{{ reasonLabels[item.reason] }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-left">
              <span v-if="resultsView === 'folders'">Total: {{ demoFolders.length }}</span>
              <span v-else>Selected: 0 / Total: {{ demoImages.length }}</span>
            </div>
          </div>
        </div>

        <!-- PDF Maker -->
        <div v-if="activeTab === 'pdfmaker'" id="tour-pdfmaker-content" class="pdfmaker-demo">
          <div class="toolbar">
            <div class="toolbar-left">
              <button class="sort-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                A→Z
              </button>
              <button class="refresh-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
                </svg>
                Refresh
              </button>
            </div>
            <div class="toolbar-right">
              <label class="reduce-toggle">
                <input type="checkbox" checked disabled />
                <span>Reduce Size</span>
              </label>
              <div class="reduce-config-group">
                <select class="effort-select" disabled>
                  <option>Standard</option>
                </select>
                <div class="config-item">
                  <label class="config-label">Colors</label>
                  <span class="config-value">256</span>
                </div>
                <div class="config-item">
                  <label class="config-label">Size</label>
                  <span class="config-value">1280×720</span>
                </div>
              </div>
              <button class="make-pdf-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
                </svg>
                Make PDF
              </button>
            </div>
          </div>

          <div class="content-area">
            <div class="folder-list pdf-folder-list">
              <div
                v-for="folder in pdfFolders"
                :key="folder.name"
                class="folder-item"
                :class="{ selected: folder.selected }"
              >
                <div class="item-checkbox">
                  <input type="checkbox" :checked="folder.selected" disabled />
                </div>
                <div class="folder-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                    <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                  </svg>
                </div>
                <span class="folder-name">{{ folder.name }}</span>
                <div class="drag-handle">
                  <svg width="20" height="20" viewBox="0 0 16 16">
                    <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <span>Selected: {{ pdfFolders.filter(f => f.selected).length }} / Total: {{ pdfFolders.length }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref<'results' | 'pdfmaker'>('results')
const resultsView = ref<'folders' | 'images'>('folders')

const demoFolders = [
  { name: 'Functional Analysis - Week 8', activeCount: 24, removedCount: 3, lastVisited: true },
  { name: 'Linear Algebra - Week 5', activeCount: 18, removedCount: 5, lastVisited: false },
  { name: 'Calculus II - Week 12', activeCount: 31, removedCount: 2, lastVisited: false }
]

const demoImages = [
  { name: 'slide_001.png', status: 'active', isCropped: false, reason: null, color: '#4a7fb5' },
  { name: 'slide_002.png', status: 'active', isCropped: true, reason: null, color: '#5a8faa' },
  { name: 'slide_003.png', status: 'removed', isCropped: false, reason: 'ai_filtered', color: '#7a9a8a' },
  { name: 'slide_004.png', status: 'removed', isCropped: false, reason: 'duplicate', color: '#4a7fb5' },
  { name: 'slide_005.png', status: 'removed', isCropped: false, reason: 'ai_filtered_edit', color: '#8a7a6a' },
  { name: 'slide_006.png', status: 'active', isCropped: false, reason: null, color: '#6a8a5a' }
]

const reasonLabels: Record<string, string> = {
  duplicate: 'Duplicate',
  exclusion: 'Exclusion',
  ai_filtered: 'AI Filtered',
  ai_filtered_edit: 'AI Edit',
  manual: 'Manual'
}

const pdfFolders = [
  { name: 'Functional Analysis - Week 8', selected: true },
  { name: 'Linear Algebra - Week 5', selected: true },
  { name: 'Calculus II - Week 12', selected: false }
]

const showResultsImages = () => {
  resultsView.value = 'images'
}

const switchToPdfMaker = () => {
  activeTab.value = 'pdfmaker'
}

defineExpose({
  showResultsImages,
  switchToPdfMaker
})
</script>

<style scoped>
.tools-demo-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.4);
}

.tools-demo-modal {
  width: 85%;
  height: 80%;
  max-width: 1100px;
  max-height: 700px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Title Bar */
.tools-demo-title-bar {
  display: flex;
  align-items: center;
  height: 38px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 12px;
  flex-shrink: 0;
}

.tab-buttons {
  display: flex;
  gap: 2px;
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
  cursor: default;
  transition: all 0.15s;
  white-space: nowrap;
}

.tab-btn.active {
  background-color: rgba(0, 122, 204, 0.12);
  color: #007acc;
  font-weight: 500;
}

/* Content Area */
.tools-demo-content {
  flex: 1;
  overflow: hidden;
}

.results-demo,
.pdfmaker-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right,
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn,
.refresh-btn,
.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  background-color: white;
  color: #555;
  font-size: 12px;
  cursor: default;
}

.back-btn:disabled,
.refresh-btn:disabled,
.sort-btn:disabled {
  opacity: 0.7;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.filter-select {
  padding: 3px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  color: #333;
}

.delete-btn,
.restore-btn,
.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 12px;
  cursor: default;
}

.delete-btn {
  background-color: #fff5f5;
  color: #c53030;
  border-color: #feb2b2;
}

.restore-btn {
  background-color: #f0fff4;
  color: #276749;
  border-color: #9ae6b4;
}

.clear-btn {
  background-color: white;
  color: #555;
}

.delete-btn:disabled,
.restore-btn:disabled,
.clear-btn:disabled {
  opacity: 0.6;
}

/* Content */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Folder list (Results View) */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background-color: white;
  cursor: default;
  text-align: left;
  transition: background-color 0.15s;
}

.folder-item:hover {
  background-color: #f8f9fa;
}

.folder-item-last-visited {
  background-color: #e7f1ff;
  border-color: #7aa9e6;
}

.folder-icon {
  flex-shrink: 0;
}

.folder-copy {
  flex: 1;
  min-width: 0;
}

.folder-mainline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.folder-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-counts {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.folder-count-text {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
}

.count-value {
  font-weight: 600;
  color: #333;
}

.count-label {
  color: #888;
}

.folder-count-separator {
  color: #ccc;
  font-size: 11px;
}

.folder-chevron {
  flex-shrink: 0;
  color: #aaa;
}

/* Results Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.result-item {
  position: relative;
  background-color: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.result-item.removed {
  border-color: #fecaca;
  opacity: 0.85;
}

.item-thumbnail {
  aspect-ratio: 16/9;
  overflow: hidden;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-copy {
  padding: 8px 10px;
}

.item-name {
  font-size: 11px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.item-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.status-badge,
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.active {
  background-color: #e7f3ff;
  color: #1768a8;
}

.status-badge.cropped {
  background-color: #edf0f3;
  color: #58616b;
}

.status-badge.removed {
  background-color: #ffe8e6;
  color: #b63a30;
}

.reason-badge.reason-duplicate {
  background-color: #fff2cc;
  color: #8a5b00;
}

.reason-badge.reason-exclusion {
  background-color: #ede7ff;
  color: #6546c2;
}

.reason-badge.reason-ai_filtered {
  background-color: #dff7ea;
  color: #257550;
}

.reason-badge.reason-ai_filtered_edit {
  background-color: #fff3d6;
  color: #955800;
}

.reason-badge.reason-manual {
  background-color: #ffe8e6;
  color: #b63a30;
}

/* Footer */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid #e9ecef;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* PDF Maker */
.pdf-folder-list .folder-item {
  gap: 10px;
  padding: 10px 14px;
}

.pdf-folder-list .folder-item.selected {
  background-color: #e7f1ff;
  border-color: #7aa9e6;
}

.item-checkbox {
  flex-shrink: 0;
}

.item-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #007acc;
}

.drag-handle {
  margin-left: auto;
  color: #aaa;
  flex-shrink: 0;
}

.reduce-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #555;
  cursor: default;
}

.reduce-toggle input[type="checkbox"] {
  accent-color: #007acc;
}

.reduce-config-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.effort-select {
  padding: 3px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.config-label {
  color: #888;
}

.config-value {
  color: #333;
  font-weight: 500;
}

.make-pdf-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 5px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: default;
}

.make-pdf-btn:disabled {
  opacity: 0.6;
}
</style>
