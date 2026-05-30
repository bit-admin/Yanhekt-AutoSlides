<template>
  <div class="flex h-full flex-col bg-surface">
    <!-- Tab Navigation -->
    <div class="border-b border-line bg-elevated">
      <div class="flex gap-1 px-4">
        <button :class="[tabBtnBase, activeTab === 'results' ? tabBtnActive : tabBtnIdle]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/>
            <polyline points="9,11 12,14 22,4"/>
          </svg>
          {{ $t('tools.tabs.results') }}
        </button>
        <button :class="[tabBtnBase, activeTab === 'pdf' ? tabBtnActive : tabBtnIdle]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          {{ $t('tools.tabs.pdfMaker') }}
        </button>
        <button :class="[tabBtnBase, activeTab === 'offline' ? tabBtnActive : tabBtnIdle]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {{ $t('tools.tabs.offlineProcessing') }}
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Results Tab Demo -->
      <div v-if="activeTab === 'results'" class="h-full overflow-y-auto p-6">
        <div>
          <div class="mb-5">
            <div>
              <h3 class="m-0 mb-1 text-lg text-fg">{{ $t('demo.tools.resultsTitle') }}</h3>
              <span class="text-[13px] text-fg-secondary">{{ $t('demo.tools.imagesSelected') }}</span>
            </div>
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
            <div v-for="i in 6" :key="i" class="flex flex-col items-center gap-2 rounded-lg border border-line bg-elevated p-4">
              <div class="text-fg-muted">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
              <span class="text-xs text-fg-secondary">Slide_{{ String(i).padStart(3, '0') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PDF Maker Tab Demo -->
      <div v-else-if="activeTab === 'pdf'" class="h-full overflow-y-auto p-6">
        <div>
          <div>
            <h3 class="m-0 mb-5 text-lg text-fg">{{ $t('demo.tools.pdfTitle') }}</h3>
            <div class="mb-6 flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <label class="text-sm text-fg">{{ $t('demo.tools.pageSize') }}</label>
                <select class="min-w-[120px] rounded border border-line-input bg-elevated px-3 py-1.5 text-sm text-fg" disabled>
                  <option>A4</option>
                </select>
              </div>
              <div class="flex items-center justify-between">
                <label class="text-sm text-fg">{{ $t('demo.tools.orientation') }}</label>
                <select class="min-w-[120px] rounded border border-line-input bg-elevated px-3 py-1.5 text-sm text-fg" disabled>
                  <option>{{ $t('demo.tools.landscape') }}</option>
                </select>
              </div>
            </div>
            <button class="cursor-pointer rounded-md border-none bg-accent px-5 py-2.5 text-sm text-white dark:text-[#1a1a1a]" disabled>
              {{ $t('demo.tools.generatePdf') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Offline Processing Tab Demo -->
      <div v-else-if="activeTab === 'offline'" class="h-full overflow-y-auto p-6">
        <div>
          <div>
            <h3 class="m-0 mb-5 text-lg text-fg">{{ $t('demo.tools.offlineTitle') }}</h3>
            <div class="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-line-input p-12 text-fg-muted">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <p class="m-0 text-sm">{{ $t('demo.tools.dropFiles') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type TabType = 'results' | 'pdf' | 'offline'

const activeTab = ref<TabType>('results')

const tabBtnBase = 'flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm cursor-pointer transition-colors'
const tabBtnActive = 'border-accent font-medium text-accent'
const tabBtnIdle = 'border-transparent text-fg-secondary hover:bg-accent/5 hover:text-accent'

const setActiveTab = (tab: TabType) => {
  activeTab.value = tab
}

defineExpose({
  setActiveTab
})
</script>
