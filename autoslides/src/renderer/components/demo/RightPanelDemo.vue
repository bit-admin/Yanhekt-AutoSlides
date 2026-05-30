<template>
  <div class="flex flex-col h-full" :data-tab="currentTab">
    <div class="flex border-b border-border bg-elevated">
      <button
        :class="[
          'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 border-0 bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-b-transparent',
          'hover:bg-hover',
          { 'bg-surface border-b-accent text-accent': currentTab === 'task' }
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        {{ $t('navigation.task') }}
      </button>
      <button
        :class="[
          'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 border-0 bg-transparent text-sm font-medium cursor-pointer transition-all border-b-[3px] border-b-transparent',
          'hover:bg-hover',
          { 'bg-surface border-b-accent text-accent': currentTab === 'download' }
        ]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ $t('navigation.download') }}
      </button>
    </div>

    <div class="flex-1 overflow-hidden relative">
      <!-- Task Mode Container -->
      <div
        :class="['h-full w-full absolute inset-0 transition-opacity duration-200 ease-in-out overflow-y-auto', { 'opacity-0 pointer-events-none -z-1': currentTab !== 'task' }]"
        data-tab="task"
      >
        <div class="p-4 h-full">
          <div class="flex justify-between items-center mb-5">
            <h3 class="m-0 text-base font-semibold text-text">{{ $t('tasks.taskList') }}</h3>
            <div class="flex gap-2">
              <button class="flex items-center gap-1 px-2 py-1.5 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all hover:bg-elevated text-success border-success hover:bg-success/10 hover:border-text-success demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                {{ $t('tasks.start') }}
              </button>
              <button class="flex items-center gap-1 px-2 py-1.5 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all hover:bg-elevated text-text-muted border-text-muted hover:bg-[var(--border-color)] hover:border-[var(--text-secondary)] demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('tasks.clear') }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2 mb-4">
            <div
              v-for="item in mockTaskItems"
              :key="item.id"
              class="flex flex-col"
            >
              <div
                class="flex items-center gap-3 p-3 bg-surface border border-border rounded-md transition-all shrink-0 hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
                :class="[`status-${item.status}`]"
              >
                <div class="shrink-0">
                  <div :class="[
                    'flex items-center justify-center w-6 h-6 rounded-full border-2 border-current',
                    item.status === 'queued' ? 'text-text-muted bg-elevated' : '',
                    item.status === 'in_progress' ? 'text-success bg-success/5 animate-pulse' : '',
                    item.status === 'completed' ? 'text-success bg-success/5' : ''
                  ]">
                    <svg v-if="item.status === 'queued'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    <svg v-else-if="item.status === 'in_progress'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 11l3 3 8-8"/>
                      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
                    </svg>
                    <svg v-else-if="item.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-medium text-text mb-1.5 truncate">
                    {{ item.name }}
                  </div>
                  <div class="flex flex-col gap-1">
                    <div class="w-full h-1 bg-hover rounded-sm overflow-hidden">
                      <div class="h-full bg-accent rounded-sm transition-[width] duration-300 ease-in-out" :style="{ width: `${item.progress}%` }"></div>
                    </div>
                    <div class="text-[11px] text-text-secondary">
                      <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                      <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                      <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                    </div>
                  </div>
                </div>

                <div class="shrink-0">
                  <button
                    class="flex items-center justify-center w-6 h-6 border-0 bg-transparent text-danger rounded cursor-pointer transition-colors hover:bg-danger/10 demo-disabled"
                    v-if="item.status !== 'in_progress'"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Post-processing affiliated panel -->
              <div
                v-if="item.postProcess"
                class="w-full bg-surface border border-border border-t-0 rounded-b-md p-1 px-1.5 hover:border-accent"
                :class="[`pp-status-${item.postProcess.status}`]"
              >
                <div class="flex items-stretch gap-2 text-[8px]">
                  <div class="flex-1 flex flex-col gap-[3px] min-w-0">
                    <div class="flex justify-between items-center gap-1">
                      <span class="font-medium text-text text-[8px] truncate">{{ $t('playback.postProcessStatus.phase1NameShort') }}</span>
                      <span v-if="item.postProcess.phase1 === 'completed'" class="bg-success text-white text-[7px] px-[3px] py-px rounded-sm shrink-0">
                        -{{ item.postProcess.phase1Removed }}
                      </span>
                    </div>
                    <div class="h-[3px] bg-border rounded-sm overflow-hidden">
                      <div class="h-full bg-border transition-[width] duration-300 ease-in-out" :class="{ 'bg-success': item.postProcess.phase1 === 'completed' }" :style="{ width: item.postProcess.phase1 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="flex-1 flex flex-col gap-[3px] min-w-0">
                    <div class="flex justify-between items-center gap-1">
                      <span class="font-medium text-text text-[8px] truncate">{{ $t('playback.postProcessStatus.phase2NameShort') }}</span>
                      <span v-if="item.postProcess.phase2 === 'completed'" class="bg-success text-white text-[7px] px-[3px] py-px rounded-sm shrink-0">
                        -{{ item.postProcess.phase2Removed }}
                      </span>
                    </div>
                    <div class="h-[3px] bg-border rounded-sm overflow-hidden">
                      <div class="h-full bg-border transition-[width] duration-300 ease-in-out" :class="{ 'bg-success': item.postProcess.phase2 === 'completed' }" :style="{ width: item.postProcess.phase2 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="flex-1 flex flex-col gap-[3px] min-w-0">
                    <div class="flex justify-between items-center gap-1">
                      <span class="font-medium text-text text-[8px] truncate">{{ $t('playback.postProcessStatus.phase3NameShort') }}</span>
                      <span v-if="item.postProcess.phase3 === 'completed'" class="bg-success text-white text-[7px] px-[3px] py-px rounded-sm shrink-0">
                        -{{ item.postProcess.phase3Removed }}
                      </span>
                      <span v-else-if="item.postProcess.phase3 === 'active'" class="bg-accent text-white text-[7px] px-[3px] py-px rounded-sm shrink-0">
                        {{ item.postProcess.phase3Progress }}/{{ item.postProcess.phase3Total }}
                      </span>
                    </div>
                    <div class="h-[3px] bg-border rounded-sm overflow-hidden">
                      <div class="h-full bg-border transition-[width] duration-300 ease-in-out" :class="{ 'bg-accent': item.postProcess.phase3 === 'active', 'bg-success': item.postProcess.phase3 === 'completed' }" :style="{ width: item.postProcess.phase3 === 'completed' ? '100%' : item.postProcess.phase3 === 'active' ? `${(item.postProcess.phase3Progress / item.postProcess.phase3Total) * 100}%` : '0%' }"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Download Mode Container -->
      <div
        :class="['h-full w-full absolute inset-0 transition-opacity duration-200 ease-in-out overflow-y-auto', { 'opacity-0 pointer-events-none -z-1': currentTab !== 'download' }]"
        data-tab="download"
      >
        <div class="p-4 h-full">
          <div class="flex justify-between items-center mb-5">
            <h3 class="m-0 text-base font-semibold text-text">{{ $t('downloads.downloadList') }}</h3>
            <div class="flex gap-2">
              <button class="flex items-center gap-1 px-2 py-1.5 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all hover:bg-elevated text-danger border-danger hover:bg-danger/10 hover:border-bg-danger-hover demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {{ $t('downloads.cancelAll') }}
              </button>
              <button class="flex items-center gap-1 px-2 py-1.5 border border-border-input rounded bg-surface text-[11px] cursor-pointer transition-all hover:bg-elevated text-text-muted border-text-muted hover:bg-[var(--border-color)] hover:border-[var(--text-secondary)] demo-disabled">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('downloads.clear') }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2 mb-4">
            <div
              v-for="item in mockDownloadItems"
              :key="item.id"
              class="flex items-center gap-3 p-3 bg-surface border border-border rounded-md transition-all hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
              :class="[`status-${item.status}`]"
            >
              <div class="shrink-0">
                <div :class="[
                  'flex items-center justify-center w-6 h-6 rounded-full border-2 border-current',
                  item.status === 'downloading' ? 'text-accent bg-accent/10 animate-pulse' : '',
                  item.status === 'completed' ? 'text-success bg-success/5' : ''
                ]">
                  <svg v-if="item.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  <svg v-else-if="item.status === 'downloading'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium text-text mb-1.5 truncate">
                  {{ item.name }}
                </div>
                <div class="flex flex-col gap-1">
                  <div class="w-full h-1 bg-hover rounded-sm overflow-hidden">
                    <div class="h-full bg-accent rounded-sm transition-[width] duration-300 ease-in-out" :style="{ width: `${item.progress}%` }"></div>
                  </div>
                  <div class="text-[11px] text-text-secondary">
                    <span v-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                  </div>
                </div>
              </div>

              <div class="shrink-0">
                <button
                  class="flex items-center justify-center w-6 h-6 border-0 bg-transparent text-danger rounded cursor-pointer transition-colors hover:bg-danger/10 demo-disabled"
                  v-if="item.status !== 'completed'"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

type Tab = 'task' | 'download'

const { t } = useI18n()
const currentTab = ref<Tab>('task')

// Mock task items for demo
const mockTaskItems = computed(() => [
  {
    id: 'task-1',
    name: t('demo.tasks.functionalAnalysis.chapter1'),
    status: 'completed',
    progress: 100,
    postProcess: {
      status: 'completed',
      phase1: 'completed',
      phase1Removed: 3,
      phase2: 'completed',
      phase2Removed: 1,
      phase3: 'completed',
      phase3Removed: 2,
      phase3Progress: 0,
      phase3Total: 0
    }
  },
  {
    id: 'task-2',
    name: t('demo.tasks.functionalAnalysis.chapter2'),
    status: 'in_progress',
    progress: 66,
    postProcess: null
  },
  {
    id: 'task-3',
    name: t('demo.tasks.realAnalysis.chapter3'),
    status: 'queued',
    progress: 0,
    postProcess: null
  }
])

// Mock download items for demo
const mockDownloadItems = computed(() => [
  {
    id: 'download-1',
    name: t('demo.downloads.complexAnalysis.chapter5'),
    status: 'completed',
    progress: 100
  },
  {
    id: 'download-2',
    name: t('demo.downloads.complexAnalysis.chapter6'),
    status: 'downloading',
    progress: 66
  },
  {
    id: 'download-3',
    name: t('demo.downloads.abstractAlgebra.chapter7'),
    status: 'queued',
    progress: 0
  }
])

const switchTab = (tab: Tab) => {
  // Only allow programmatic tab switching in demo mode
  currentTab.value = tab
}

// Expose methods for parent components
defineExpose({
  switchToDownload: () => switchTab('download'),
  switchToTask: () => switchTab('task')
})
</script>

<style scoped>
/* Status borders: Vue scoped adds [data-v-xxx] giving (0,3,0) specificity */
.status-queued {
  border-left: 3px solid var(--text-muted);
}

.status-in_progress {
  border-left: 3px solid var(--success);
}

.status-downloading {
  border-left: 3px solid var(--accent);
}

.status-completed {
  border-left: 3px solid var(--success);
}

/* Hover overrides status borders (class + hover + scoped = (0,3,0)) */
.task-item-wrapper:hover > .status-queued,
.task-item-wrapper:hover > .status-in_progress,
.task-item-wrapper:hover > .status-completed {
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

/* Adjacent post-process panel status borders */
.task-item-wrapper:has(.status-completed) + .post-process-affiliated-panel,
.status-completed + .post-process-affiliated-panel {
  border-left: 3px solid var(--success);
}

.status-in_progress + .post-process-affiliated-panel {
  border-left: 3px solid var(--success);
}

/* :has() for squared corners */
.task-item-wrapper:has(.post-process-affiliated-panel) > .flex.items-center {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* Pulse animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s infinite;
}

/* Demo mode disabled styles */
.demo-disabled {
  pointer-events: none !important;
  cursor: default !important;
  opacity: 0.7 !important;
}

.demo-disabled:hover {
  background-color: inherit !important;
  border-color: inherit !important;
}
</style>
