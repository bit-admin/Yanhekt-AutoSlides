<template>
  <div class="flex flex-col h-screen bg-surface text-text">
    <!-- Title Bar -->
    <div class="flex justify-between items-center h-[38px] bg-page border-b border-border px-2 shrink-0 [-webkit-app-region:drag]" @mousedown="startDrag">
      <div class="flex-1 flex items-center" :class="{ 'pl-[70px]': isMacOS }">
        <!-- Tab Buttons -->
        <div class="flex gap-0.5 [-webkit-app-region:no-drag]">
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'trash' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('trash')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabTrash') }}
          </button>
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'pdfmaker' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('pdfmaker')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1.5H4V8zm0 2.5h8V12H4v-1.5zm0 2.5h5v1.5H4V13z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabPdfMaker') }}
          </button>
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'offline' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('offline')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 12a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4.5 9.5a5 5 0 016.9 0l-1 1a3.5 3.5 0 00-4.9 0l-1-1zM1.5 6.5a9 9 0 0112.9 0l-1 1a7.5 7.5 0 00-10.9 0l-1-1z" fill="currentColor"/>
              <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            {{ $t('tools.tabOffline') }}
          </button>
          <button
            :class="['flex items-center gap-1 py-1 px-3 border-none rounded bg-transparent text-xs text-text-secondary cursor-pointer transition-all whitespace-nowrap hover:bg-black/6 hover:text-text', activeTab === 'compress' ? 'bg-accent/12 text-accent font-medium' : '']"
            @click="switchTab('compress')"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm3 2H4v8h8V6h-2V4H6zm1 0v1h2V4H7zm-2 5h6v1H5V9z" fill="currentColor"/>
            </svg>
            {{ $t('tools.tabCompressLecture') }}
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
      <div v-show="activeTab === 'trash'" class="h-full">
        <ResultsWindow />
      </div>
      <div v-show="activeTab === 'pdfmaker'" class="h-full">
        <PdfMakerWindow />
      </div>
      <div v-show="activeTab === 'offline'" class="h-full">
        <OfflineProcessingTab />
      </div>
      <div v-show="activeTab === 'compress'" class="h-full">
        <CompressLectureTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PdfMakerWindow from '@renderer/components/export/PdfMakerWindow.vue'
import ResultsWindow from '@renderer/components/results/ResultsWindow.vue'
import OfflineProcessingTab from '@renderer/components/offline/OfflineProcessingTab.vue'
import CompressLectureTab from './CompressLectureTab.vue'

type TabId = 'pdfmaker' | 'trash' | 'compress' | 'offline'

const isMacOS = navigator.userAgent.includes('Mac')

// Read initial tab from URL query param
const getInitialTab = (): TabId => {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (tab === 'pdfmaker' || tab === 'trash' || tab === 'compress' || tab === 'offline') return tab
  return 'trash'
}

const activeTab = ref<TabId>(getInitialTab())

const switchTab = (tab: TabId) => {
  activeTab.value = tab
}

// Listen for tab switch IPC from main process
let cleanupSwitchTab: (() => void) | undefined
onMounted(() => {
  cleanupSwitchTab = window.electronAPI.tools?.onSwitchTab?.((tab: string) => {
    if (tab === 'pdfmaker' || tab === 'trash' || tab === 'compress' || tab === 'offline') {
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
