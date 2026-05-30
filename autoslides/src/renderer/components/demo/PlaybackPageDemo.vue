<template>
  <div class="flex flex-col h-full p-4">
    <div class="border border-border rounded-lg bg-elevated mb-6 overflow-hidden">
      <div class="flex items-center gap-4 p-4">
        <button class="flex items-center gap-1.5 py-2 px-4 border border-border-input rounded bg-surface text-text-secondary text-sm cursor-pointer transition-all duration-200 hover:border-accent hover:text-accent" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('playback.back') }}
        </button>
        <div class="flex-1">
          <h2 class="m-0 text-xl font-semibold text-text">{{ $t('demo.course.title') }}</h2>
          <p class="mt-1 text-sm text-text-secondary">{{ $t('demo.session.title') }}</p>
        </div>
        <button class="flex items-center justify-center w-8 h-8 border border-border-input rounded bg-surface cursor-pointer transition-all duration-200 hover:border-accent hover:bg-accent/5" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform duration-200" :class="{ 'rotate-180': showDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showDetails" class="p-4 border-t border-border bg-surface grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.instructor') }}</span>
          <span class="text-sm text-text font-medium">{{ $t('demo.course.instructor') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-sm text-text font-medium">{{ $t('demo.course.term') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('sessions.classrooms') }}</span>
          <span class="text-sm text-text font-medium">{{ $t('demo.course.classroom') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-[0.5px]">{{ $t('playback.duration') }}</span>
          <span class="text-sm text-text font-medium">{{ formatDuration(totalTime) }}</span>
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div class="flex flex-col">
        <!-- Controls Row -->
        <div class="flex justify-between items-center p-3 bg-elevated border border-hover rounded-t-lg gap-4">
          <div class="flex items-center gap-3">
            <label class="font-medium text-text">{{ $t('playback.selectStream') }}</label>
            <select v-model="selectedStream" class="py-1.5 px-3 border border-border-input rounded bg-surface text-sm demo-disabled">
              <option value="camera">{{ $t('demo.stream.camera') }}</option>
              <option value="screen">{{ $t('demo.stream.screen') }}</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <label class="font-medium text-text whitespace-nowrap">{{ $t('playback.playbackSpeed') }}</label>
            <select v-model="currentPlaybackRate" class="py-1.5 px-3 border border-border-input rounded bg-surface text-sm cursor-pointer demo-disabled">
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
              <option value="4">4x</option>
            </select>
          </div>

          <div class="flex items-center">
            <button class="flex items-center gap-1.5 py-2 px-3 border border-border-input rounded bg-surface text-text text-sm cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-accent demo-disabled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <rect x="14" y="12" width="6" height="4" rx="1" fill="currentColor"/>
              </svg>
              <span>{{ $t('playback.picInPic') }}</span>
            </button>
          </div>
        </div>

        <!-- Mock Video Player -->
        <div class="relative w-full bg-black border border-hover border-t-0 overflow-hidden">
          <div class="w-full min-h-[400px] flex items-center justify-center bg-black">
            <div class="flex flex-col items-center gap-4 text-surface text-center">
              <svg class="opacity-70" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              <p class="m-0 text-base font-medium">{{ $t('demo.video.playing') }}</p>
              <div class="w-[300px] h-1 bg-white/30 rounded-sm overflow-hidden">
                <div class="h-full bg-accent transition-[width] duration-300" :style="{ width: progress + '%' }"></div>
              </div>
              <p class="text-sm text-white/80 font-mono">{{ formatTime(currentTime) }} / {{ formatTime(totalTime) }}</p>
            </div>
          </div>
        </div>

        <!-- Slide Gallery -->
        <div v-if="selectedStream === 'screen'" class="bg-elevated border border-hover border-t-0 rounded-b-lg">
          <div class="mb-4">
            <div class="flex justify-between items-center p-4 bg-elevated border-t border-border">
              <div class="flex items-center gap-5">
                <label class="extraction-toggle flex items-center gap-3 cursor-pointer font-medium text-text select-none demo-disabled">
                  <input
                    type="checkbox"
                    v-model="isSlideExtractionEnabled"
                    disabled
                    class="absolute opacity-0 w-0 h-0"
                  />
                  <span class="toggle-slider"></span>
                  <span class="text-[15px] font-semibold select-none">{{ $t('playback.slideExtraction') }}</span>
                </label>

                <div class="flex items-center gap-2 py-1.5 px-3 bg-accent/10 border border-accent/20 rounded-md text-accent-strong text-sm font-medium">
                  <svg class="shrink-0 text-accent-strong" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="flex items-center gap-1">
                    {{ isSlideExtractionEnabled ? mockSlides.length : 0 }} {{ $t('playback.slides') }}
                    <span v-if="isSlideExtractionEnabled" class="text-accent-strong font-normal opacity-80">{{ $t('playback.extracted') }}</span>
                  </span>
                </div>
              </div>

              <button
                v-if="isSlideExtractionEnabled && mockSlides.length > 0"
                class="flex items-center gap-1.5 py-1.5 px-3 border border-accent rounded bg-accent text-white text-[13px] cursor-pointer demo-disabled"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="m2 17 10 5 10-5"/>
                  <path d="m2 12 10 5 10-5"/>
                </svg>
                {{ $t('playback.postProcess') }}
              </button>

              <button
                v-if="isSlideExtractionEnabled && mockSlides.length > 0"
                class="flex items-center gap-1.5 py-1.5 px-3 border border-danger rounded bg-danger text-white text-[13px] cursor-pointer transition-all duration-200 hover:bg-danger-hover hover:border-danger-hover demo-disabled"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
                {{ $t('playback.clearAll') }}
              </button>
            </div>
          </div>

          <!-- Post-processing Status Bar -->
          <div v-if="isSlideExtractionEnabled && mockSlides.length > 0" class="bg-elevated border border-border rounded py-2 px-3 mx-4 mb-3">
            <div class="flex items-stretch">
              <div class="flex-1 flex flex-col gap-1">
                <div class="flex justify-between items-center">
                  <span class="text-[10px] font-medium text-text">{{ $t('playback.postProcessStatus.phase1Name') }}</span>
                  <span class="text-[9px] font-medium py-px px-1 rounded-sm text-success bg-success/10">{{ $t('playback.postProcessStatus.completed') }}</span>
                </div>
                <div class="h-[3px] bg-hover rounded-sm overflow-hidden">
                  <div class="h-full rounded-sm transition-[width] duration-300 bg-success" style="width: 100%"></div>
                </div>
              </div>
              <div class="w-px bg-border mx-2 self-stretch"></div>
              <div class="flex-1 flex flex-col gap-1">
                <div class="flex justify-between items-center">
                  <span class="text-[10px] font-medium text-text">{{ $t('playback.postProcessStatus.phase2Name') }}</span>
                  <span class="text-[9px] font-medium py-px px-1 rounded-sm text-success bg-success/10">{{ $t('playback.postProcessStatus.completed') }}</span>
                </div>
                <div class="h-[3px] bg-hover rounded-sm overflow-hidden">
                  <div class="h-full rounded-sm transition-[width] duration-300 bg-success" style="width: 100%"></div>
                </div>
              </div>
              <div class="w-px bg-border mx-2 self-stretch"></div>
              <div class="flex-1 flex flex-col gap-1">
                <div class="flex justify-between items-center">
                  <span class="text-[10px] font-medium text-text">{{ $t('playback.postProcessStatus.phase3Name') }}</span>
                  <span class="text-[9px] font-medium py-px px-1 rounded-sm text-text-muted bg-hover">{{ $t('playback.postProcessStatus.idle') }}</span>
                </div>
                <div class="h-[3px] bg-hover rounded-sm overflow-hidden">
                  <div class="h-full rounded-sm transition-[width] duration-300 bg-accent" style="width: 0%"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Gallery Grid -->
          <div v-if="isSlideExtractionEnabled && mockSlides.length > 0" class="grid gap-4 px-4 pb-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            <div
              v-for="slide in mockSlides"
              :key="slide.id"
              class="slide-thumbnail relative bg-surface rounded-lg overflow-hidden border-2 border-hover cursor-pointer transition-all duration-200 hover:border-accent hover:-translate-y-0.5 hover:shadow-lg demo-disabled"
            >
              <div class="w-full h-[120px] bg-black flex items-center justify-center">
                <div class="flex flex-col items-center gap-2 text-surface text-center">
                  <svg class="opacity-70" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span class="text-xs opacity-80">{{ $t('demo.slide.preview') }}</span>
                </div>
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex justify-between items-end">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span class="truncate text-xs font-medium text-white">{{ slide.title }}</span>
                  <span class="text-[11px] text-white/80">{{ slide.time }}</span>
                </div>
                <button class="p-1 rounded bg-danger/80 text-white cursor-pointer transition-all duration-200 shrink-0 hover:bg-danger hover:scale-110 demo-disabled">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Slide Preview Modal -->
    <div v-if="selectedSlide" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-sm">
      <div class="bg-surface rounded-2xl max-w-[90vw] max-h-[90vh] overflow-hidden shadow-2xl">
        <div class="flex justify-between items-center py-4 px-5 border-b border-hover bg-elevated">
          <h3 class="m-0 text-lg font-semibold text-text">{{ selectedSlide.title }}</h3>
          <div class="flex gap-2">
            <button class="flex items-center gap-1.5 py-1.5 px-3 border border-danger rounded bg-danger text-white text-[13px] cursor-pointer transition-all duration-200 hover:bg-danger-hover hover:border-danger-hover demo-disabled" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              {{ $t('playback.moveToTrash') }}
            </button>
            <button class="flex items-center gap-1.5 py-1.5 px-3 border border-text-muted rounded bg-text-muted text-white text-[13px] cursor-pointer transition-all duration-200 hover:bg-[#5a6268] hover:border-[#5a6268]" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {{ $t('playback.close') }}
            </button>
          </div>
        </div>
        <div class="p-5 flex flex-col gap-4">
          <div class="w-full h-[400px] bg-black flex items-center justify-center rounded-lg">
            <div class="flex flex-col items-center gap-4 text-surface text-center">
              <svg class="opacity-70" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span class="text-base opacity-80">{{ $t('demo.slide.fullPreview') }}</span>
            </div>
          </div>
          <div class="p-3 bg-elevated rounded-md border border-hover">
            <p class="my-1 text-sm text-text-secondary"><strong class="text-text">{{ $t('playback.extractedAt') }}</strong> {{ selectedSlide.time }}</p>
            <p class="my-1 text-sm text-text-secondary"><strong class="text-text">{{ $t('playback.fileName') }}</strong> {{ selectedSlide.title }}.png</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  back: []
}>()

// Reactive state
const showDetails = ref(false)
const selectedStream = ref('screen')
const currentPlaybackRate = ref(2)
const isSlideExtractionEnabled = ref(true)
const selectedSlide = ref<any>(null)

// Mock video progress
const progress = ref(35)
const currentTime = ref(2130) // 35:30
const totalTime = ref(6330) // 1:45:30

// Mock slides data
const mockSlides = ref([
  {
    id: 1,
    title: 'slide_001',
    time: '10:23'
  }
])

// Methods
const goBack = () => {
  emit('back')
}

const toggleCourseDetails = () => {
  showDetails.value = !showDetails.value
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Demo mode - modal functionality disabled
const openSlideModal = (slide: any) => {
  // Disabled in demo mode
}

const closeSlideModal = () => {
  selectedSlide.value = null
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Simulate video progress
let progressInterval: NodeJS.Timeout | null = null

onMounted(() => {
  // Simulate video playback progress
  progressInterval = setInterval(() => {
    if (progress.value < 100) {
      progress.value += 0.5
      currentTime.value += 30 // 30 seconds per update
    }
  }, 1000)
})

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval)
  }
})
</script>

<style scoped>
/* Toggle slider pseudo-elements */
.toggle-slider {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  background-color: var(--border-strong);
  border-radius: 24px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: var(--bg-surface);
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.extraction-toggle input:checked + .toggle-slider {
  background-color: var(--accent);
}

.extraction-toggle input:checked + .toggle-slider::before {
  transform: translateX(24px);
}

/* Demo mode disabled overrides */
.demo-disabled {
  pointer-events: none !important;
  cursor: default !important;
  opacity: 0.8 !important;
}

.demo-disabled:hover {
  background-color: inherit !important;
  border-color: inherit !important;
  transform: none !important;
  box-shadow: none !important;
}

.slide-thumbnail.demo-disabled:hover {
  border-color: var(--border-color) !important;
  transform: none !important;
  box-shadow: none !important;
}

.extraction-toggle.demo-disabled {
  cursor: default !important;
  opacity: 0.8 !important;
}

.extraction-toggle.demo-disabled .toggle-slider {
  cursor: default !important;
}
</style>
