<template>
  <!-- 'right-panel' retained as a Driver.js tour hook -->
  <div class="right-panel flex h-full flex-col" :data-tab="currentTab">
    <!-- 'navigation-bar' retained as a Driver.js tour hook -->
    <div class="navigation-bar flex border-b border-line bg-elevated">
      <button :class="[navBtnBase, currentTab === 'task' ? navActive : navIdle]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        {{ $t('navigation.task') }}
      </button>
      <button :class="[navBtnBase, currentTab === 'download' ? navActive : navIdle]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ $t('navigation.download') }}
      </button>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <!-- Task Mode Container -->
      <div
        :class="['absolute left-0 top-0 h-full w-full overflow-y-auto transition-opacity duration-200', currentTab !== 'task' ? 'pointer-events-none -z-10 opacity-0' : '']"
        data-tab="task"
      >
        <div class="h-full p-4">
          <div class="mb-5 flex items-center justify-between">
            <h3 class="m-0 text-base font-semibold text-fg">{{ $t('tasks.taskList') }}</h3>
            <div class="flex gap-2">
              <button :class="[ctlBtn, ctlStart, demoDisabled]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                {{ $t('tasks.start') }}
              </button>
              <button :class="[ctlBtn, ctlClear, demoDisabled]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('tasks.clear') }}
              </button>
            </div>
          </div>

          <div class="mb-4 flex flex-col gap-2">
            <div
              v-for="item in mockTaskItems"
              :key="item.id"
              class="flex flex-col"
            >
              <div
                class="flex items-center gap-3 border border-line bg-surface p-3 transition-all hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
                :class="[itemBorder(item.status), item.postProcess ? 'rounded-t-md' : 'rounded-md']"
              >
                <div class="shrink-0">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current" :class="indicatorCls(item.status)">
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

                <div class="min-w-0 flex-1">
                  <div class="mb-1.5 truncate text-[13px] font-medium text-fg" :title="item.name">
                    {{ item.name }}
                  </div>
                  <div class="flex flex-col gap-1">
                    <div class="h-1 w-full overflow-hidden rounded-sm bg-[#e9ecef] dark:bg-[#3a3a3a]">
                      <div class="h-full rounded-sm bg-accent transition-[width] duration-300" :style="{ width: `${item.progress}%` }"></div>
                    </div>
                    <div class="text-[11px] text-fg-secondary">
                      <span v-if="item.status === 'queued'">{{ $t('tasks.queued') }}</span>
                      <span v-else-if="item.status === 'in_progress'">{{ $t('tasks.processing') }} {{ item.progress }}%</span>
                      <span v-else-if="item.status === 'completed'">{{ $t('tasks.completed') }}</span>
                    </div>
                  </div>
                </div>

                <div class="shrink-0">
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded text-[#dc3545] pointer-events-none opacity-70"
                    v-if="item.status !== 'in_progress'"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Post-processing affiliated panel ('post-process-affiliated-panel' is a tour hook) -->
              <div
                v-if="item.postProcess"
                class="post-process-affiliated-panel w-full rounded-b-md border border-l-[3px] border-t-0 border-line border-l-[#9acd32] bg-surface px-1.5 py-1"
              >
                <div class="flex items-stretch gap-2 text-[8px]">
                  <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div class="flex items-center justify-between gap-1">
                      <span class="truncate text-[8px] font-medium text-fg">{{ $t('playback.postProcessStatus.phase1NameShort') }}</span>
                      <span v-if="item.postProcess.phase1 === 'completed'" class="shrink-0 whitespace-nowrap rounded-sm bg-[#28a745] px-[3px] py-px text-[7px] text-white">
                        -{{ item.postProcess.phase1Removed }}
                      </span>
                    </div>
                    <div class="h-[3px] overflow-hidden rounded-sm bg-line">
                      <div class="h-full transition-[width] duration-300" :class="item.postProcess.phase1 === 'completed' ? 'bg-[#28a745]' : 'bg-line'" :style="{ width: item.postProcess.phase1 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div class="flex items-center justify-between gap-1">
                      <span class="truncate text-[8px] font-medium text-fg">{{ $t('playback.postProcessStatus.phase2NameShort') }}</span>
                      <span v-if="item.postProcess.phase2 === 'completed'" class="shrink-0 whitespace-nowrap rounded-sm bg-[#28a745] px-[3px] py-px text-[7px] text-white">
                        -{{ item.postProcess.phase2Removed }}
                      </span>
                    </div>
                    <div class="h-[3px] overflow-hidden rounded-sm bg-line">
                      <div class="h-full transition-[width] duration-300" :class="item.postProcess.phase2 === 'completed' ? 'bg-[#28a745]' : 'bg-line'" :style="{ width: item.postProcess.phase2 === 'completed' ? '100%' : '0%' }"></div>
                    </div>
                  </div>
                  <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div class="flex items-center justify-between gap-1">
                      <span class="truncate text-[8px] font-medium text-fg">{{ $t('playback.postProcessStatus.phase3NameShort') }}</span>
                      <span v-if="item.postProcess.phase3 === 'completed'" class="shrink-0 whitespace-nowrap rounded-sm bg-[#28a745] px-[3px] py-px text-[7px] text-white">
                        -{{ item.postProcess.phase3Removed }}
                      </span>
                      <span v-else-if="item.postProcess.phase3 === 'active'" class="shrink-0 whitespace-nowrap rounded-sm bg-accent px-[3px] py-px text-[7px] text-white">
                        {{ item.postProcess.phase3Progress }}/{{ item.postProcess.phase3Total }}
                      </span>
                    </div>
                    <div class="h-[3px] overflow-hidden rounded-sm bg-line">
                      <div class="h-full transition-[width] duration-300" :class="item.postProcess.phase3 === 'completed' ? 'bg-[#28a745]' : item.postProcess.phase3 === 'active' ? 'bg-accent' : 'bg-line'" :style="{ width: item.postProcess.phase3 === 'completed' ? '100%' : item.postProcess.phase3 === 'active' ? `${(item.postProcess.phase3Progress / item.postProcess.phase3Total) * 100}%` : '0%' }"></div>
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
        :class="['absolute left-0 top-0 h-full w-full overflow-y-auto transition-opacity duration-200', currentTab !== 'download' ? 'pointer-events-none -z-10 opacity-0' : '']"
        data-tab="download"
      >
        <div class="h-full p-4">
          <div class="mb-5 flex items-center justify-between">
            <h3 class="m-0 text-base font-semibold text-fg">{{ $t('downloads.downloadList') }}</h3>
            <div class="flex gap-2">
              <button :class="[ctlBtn, ctlCancelAll, demoDisabled]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {{ $t('downloads.cancelAll') }}
              </button>
              <button :class="[ctlBtn, ctlClear, demoDisabled]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                </svg>
                {{ $t('downloads.clear') }}
              </button>
            </div>
          </div>

          <div class="mb-4 flex flex-col gap-2">
            <div
              v-for="item in mockDownloadItems"
              :key="item.id"
              class="flex items-center gap-3 rounded-md border border-line bg-surface p-3 transition-all hover:border-accent hover:shadow-[0_2px_4px_rgba(0,122,204,0.1)]"
              :class="itemBorder(item.status)"
            >
              <div class="shrink-0">
                <div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current" :class="indicatorCls(item.status)">
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

              <div class="min-w-0 flex-1">
                <div class="mb-1.5 truncate text-[13px] font-medium text-fg" :title="item.name">
                  {{ item.name }}
                </div>
                <div class="flex flex-col gap-1">
                  <div class="h-1 w-full overflow-hidden rounded-sm bg-[#e9ecef] dark:bg-[#3a3a3a]">
                    <div class="h-full rounded-sm bg-accent transition-[width] duration-300" :style="{ width: `${item.progress}%` }"></div>
                  </div>
                  <div class="text-[11px] text-fg-secondary">
                    <span v-if="item.status === 'downloading'">{{ $t('downloads.downloading') }} {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'completed'">{{ $t('downloads.completed') }}</span>
                  </div>
                </div>
              </div>

              <div class="shrink-0">
                <button
                  class="flex h-6 w-6 items-center justify-center rounded text-[#dc3545] pointer-events-none opacity-70"
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

// Nav tab + control-button class strings (idle/active split so one color set wins).
const navBtnBase = 'flex flex-1 items-center justify-center gap-1.5 border-b-[3px] px-4 py-3 text-sm font-medium cursor-pointer transition-colors'
const navActive = 'border-accent bg-surface text-accent'
const navIdle = 'border-transparent bg-transparent text-fg hover:bg-hover'
const demoDisabled = 'pointer-events-none opacity-70'
const ctlBtn = 'flex items-center gap-1 rounded border bg-surface px-2 py-1.5 text-[11px] cursor-pointer transition-colors'
const ctlStart = 'border-[#28a745] text-[#28a745]'
const ctlClear = 'border-[#6c757d] text-[#6c757d]'
const ctlCancelAll = 'border-[#dc3545] text-[#dc3545]'

// Status-driven utilities (dynamic `status-${x}` strings can't be Tailwind-generated).
const itemBorder = (status: string) => {
  switch (status) {
    case 'queued': return 'border-l-[3px] border-l-[#6c757d]'
    case 'downloading': return 'border-l-[3px] border-l-accent'
    case 'in_progress':
    case 'completed': return 'border-l-[3px] border-l-[#28a745]'
    default: return ''
  }
}
const indicatorCls = (status: string) => {
  switch (status) {
    case 'queued': return 'text-[#6c757d] bg-[#f8f9fa] dark:bg-[#333]'
    case 'downloading': return 'text-accent bg-[#e3f2fd] animate-pulse dark:bg-[#1e3a52]'
    case 'in_progress': return 'text-[#28a745] bg-[#e8f5e8] animate-pulse dark:bg-[#1f3a28]'
    case 'completed': return 'text-[#28a745] bg-[#e8f5e8] dark:bg-[#1f3a28]'
    default: return ''
  }
}

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
