<template>
  <div class="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
    <div class="w-[85%] h-[80%] max-w-[1100px] max-h-[700px] bg-surface rounded-[10px] shadow-[0_16px_48px_rgba(0,0,0,0.24)] flex flex-col overflow-hidden">
      <!-- Title Bar with Tabs -->
      <div class="flex items-center h-[38px] bg-page border-b border-border px-3 shrink-0">
        <div class="flex gap-0.5">
          <button
            class="flex items-center gap-[5px] py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-default transition-all duration-150 whitespace-nowrap"
            :class="{ 'bg-accent/12 text-accent font-medium': activeTab === 'results' }"
            @click.stop
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
            </svg>
            Results View
          </button>
          <button
            class="flex items-center gap-[5px] py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-default transition-all duration-150 whitespace-nowrap"
            :class="{ 'bg-accent/12 text-accent font-medium': activeTab === 'pdfmaker' }"
            @click.stop
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1.5H4V8zm0 2.5h8V12H4v-1.5zm0 2.5h5v1.5H4V13z" fill="currentColor"/>
            </svg>
            Slides Export
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-hidden">
        <!-- Results View -->
        <div v-if="activeTab === 'results'" class="flex flex-col h-full">
          <!-- Toolbar -->
          <div class="flex justify-between items-center py-2.5 px-4 border-b border-hover shrink-0">
            <div class="flex items-center gap-2.5">
              <button v-if="resultsView === 'images'" class="flex items-center gap-1 py-[5px] px-2.5 border border-border-input rounded-[5px] bg-surface text-text-secondary text-xs cursor-default opacity-70" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                Back
              </button>
              <template v-if="resultsView === 'images'">
                <div class="flex items-center gap-1 text-xs text-text-secondary">
                  <label>View:</label>
                  <select class="py-0.5 px-1.5 border border-border-input rounded text-xs bg-surface text-text" disabled>
                    <option>Show Context</option>
                  </select>
                </div>
                <div class="flex items-center gap-1 text-xs text-text-secondary">
                  <label>Reason:</label>
                  <select class="py-0.5 px-1.5 border border-border-input rounded text-xs bg-surface text-text" disabled>
                    <option>All</option>
                  </select>
                </div>
              </template>
              <button class="flex items-center gap-1 py-[5px] px-2.5 border border-border-input rounded-[5px] bg-surface text-text-secondary text-xs cursor-default opacity-70" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
                </svg>
                Refresh
              </button>
            </div>
            <div v-if="resultsView === 'images'" class="flex items-center gap-2.5">
              <button class="flex items-center gap-1 py-[5px] px-2.5 border rounded-[5px] text-xs cursor-default bg-danger/5 text-danger border-danger/20 opacity-60" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
                </svg>
                Delete
              </button>
              <button class="flex items-center gap-1 py-[5px] px-2.5 border rounded-[5px] text-xs cursor-default bg-success/5 text-success border-success/20 opacity-60" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
                  <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
                </svg>
                Restore
              </button>
              <button class="flex items-center gap-1 py-[5px] px-2.5 border border-border-input rounded-[5px] bg-surface text-text-secondary text-xs cursor-default opacity-60" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
                </svg>
                Clear Trash
              </button>
            </div>
          </div>

          <!-- Folder List -->
          <div v-if="resultsView === 'folders'" class="flex-1 overflow-y-auto p-4">
            <div class="flex flex-col gap-1">
              <button
                v-for="folder in demoFolders"
                :key="folder.name"
                class="flex items-center gap-3 w-full py-3 px-4 border border-hover rounded-lg bg-surface cursor-default text-left transition-colors duration-150 hover:bg-elevated"
                :class="{ 'bg-accent/10 border-accent': folder.lastVisited }"
              >
                <div class="shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                    <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="text-[13px] font-medium text-text whitespace-nowrap overflow-hidden text-ellipsis">{{ folder.name }}</span>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span class="flex items-center gap-[3px] text-[11px]">
                        <span class="font-semibold text-text">{{ folder.activeCount }}</span>
                        <span class="text-text-muted">active</span>
                      </span>
                      <span class="text-text-muted text-[11px]">/</span>
                      <span class="flex items-center gap-[3px] text-[11px]">
                        <span class="font-semibold text-text">{{ folder.removedCount }}</span>
                        <span class="text-text-muted">removed</span>
                      </span>
                    </div>
                  </div>
                </div>
                <svg class="shrink-0 text-text-muted" width="16" height="16" viewBox="0 0 16 16">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Image Grid -->
          <div v-else id="tour-results-grid" class="flex-1 overflow-y-auto p-4">
            <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              <div
                v-for="item in demoImages"
                :key="item.name"
                class="relative bg-surface border-2 rounded-lg overflow-hidden transition-colors duration-150"
                :class="item.status === 'removed' ? 'border-danger/20 opacity-[0.85]' : 'border-hover'"
              >
                <div class="aspect-video overflow-hidden">
                  <div class="w-full h-full flex items-center justify-center" :style="{ backgroundColor: item.color }">
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <rect x="4" y="4" width="24" height="24" rx="2" fill="white" opacity="0.3"/>
                      <rect x="7" y="12" width="18" height="2" rx="1" fill="white" opacity="0.4"/>
                      <rect x="7" y="17" width="12" height="2" rx="1" fill="white" opacity="0.3"/>
                    </svg>
                  </div>
                </div>
                <div class="py-2 px-2.5">
                  <div class="text-[11px] text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis mb-1">{{ item.name }}</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-if="item.isCropped" class="inline-flex items-center rounded-full py-0.5 px-[7px] text-[10px] font-medium whitespace-nowrap bg-elevated text-text-secondary">Cropped</span>
                    <span
                      class="inline-flex items-center rounded-full py-0.5 px-[7px] text-[10px] font-medium whitespace-nowrap"
                      :class="item.status === 'active' ? 'bg-accent/10 text-accent-strong' : 'bg-danger/10 text-danger'"
                    >{{ item.status === 'active' ? 'Extracted' : 'Removed' }}</span>
                    <span
                      v-if="item.reason"
                      class="inline-flex items-center rounded-full py-0.5 px-[7px] text-[10px] font-medium whitespace-nowrap"
                      :class="{
                        'bg-bg-warning-bg text-warning': item.reason === 'duplicate',
                        'bg-[#ede7ff] text-[#6546c2]': item.reason === 'exclusion',
                        'bg-success/10 text-success': item.reason === 'ai_filtered',
                        'bg-warning-bg text-warning': item.reason === 'ai_filtered_edit',
                        'bg-danger/10 text-danger': item.reason === 'manual'
                      }"
                    >{{ reasonLabels[item.reason] }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center py-2 px-4 border-t border-hover text-xs text-text-secondary shrink-0">
            <div class="flex items-center gap-3">
              <span v-if="resultsView === 'folders'">Total: {{ demoFolders.length }}</span>
              <span v-else>Selected: 0 / Total: {{ demoImages.length }}</span>
            </div>
          </div>
        </div>

        <!-- Slides Export -->
        <div v-if="activeTab === 'pdfmaker'" id="tour-pdfmaker-content" class="flex flex-col h-full">
          <div class="flex justify-between items-center py-2.5 px-4 border-b border-hover shrink-0">
            <div class="flex items-center gap-2.5">
              <button class="flex items-center gap-1 py-[5px] px-2.5 border border-border-input rounded-[5px] bg-surface text-text-secondary text-xs cursor-default opacity-70" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                A→Z
              </button>
              <button class="flex items-center gap-1 py-[5px] px-2.5 border border-border-input rounded-[5px] bg-surface text-text-secondary text-xs cursor-default opacity-70" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
                </svg>
                Refresh
              </button>
            </div>
            <div class="flex items-center gap-2.5">
              <label class="flex items-center gap-[5px] text-xs text-text-secondary cursor-default">
                <input type="checkbox" checked disabled class="w-4 h-4 accent-accent" />
                <span>Reduce Size</span>
              </label>
              <div class="flex items-center gap-2">
                <select class="py-0.5 px-1.5 border border-border-input rounded text-xs bg-surface" disabled>
                  <option>Standard</option>
                </select>
                <div class="flex items-center gap-1 text-[11px]">
                  <label class="text-text-muted">Colors</label>
                  <span class="text-text font-medium">256</span>
                </div>
                <div class="flex items-center gap-1 text-[11px]">
                  <label class="text-text-muted">Size</label>
                  <span class="text-text font-medium">1280×720</span>
                </div>
              </div>
              <button class="flex items-center gap-[5px] py-1.5 px-3.5 border-none rounded-[5px] bg-accent text-surface text-xs font-medium cursor-default opacity-60" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
                </svg>
                Make PDF
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div class="flex flex-col gap-1">
              <div
                v-for="folder in pdfFolders"
                :key="folder.name"
                class="flex items-center gap-2.5 w-full py-2.5 px-3.5 border rounded-lg bg-surface cursor-default text-left transition-colors duration-150 hover:bg-elevated"
                :class="folder.selected ? 'bg-accent/10 border-accent' : 'border-hover'"
              >
                <div class="shrink-0">
                  <input type="checkbox" :checked="folder.selected" disabled class="w-4 h-4 accent-accent" />
                </div>
                <div class="shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                    <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                  </svg>
                </div>
                <span class="text-[13px] font-medium text-text whitespace-nowrap overflow-hidden text-ellipsis">{{ folder.name }}</span>
                <div class="ml-auto text-text-muted shrink-0">
                  <svg width="20" height="20" viewBox="0 0 16 16">
                    <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center py-2 px-4 border-t border-hover text-xs text-text-secondary shrink-0">
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
