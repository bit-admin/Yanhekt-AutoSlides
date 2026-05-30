<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-6 overflow-hidden rounded-lg border border-border bg-elevated">
      <div class="flex items-center gap-4 p-4">
        <button @click="goBack" class="flex cursor-pointer items-center gap-1.5 rounded border border-border-input bg-surface px-4 py-2 text-sm text-text-secondary transition-all hover:border-accent hover:text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2 class="m-0 flex-1 text-xl font-semibold text-text">{{ course?.title }}</h2>
        <button @click="toggleCourseDetails" class="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-border-input bg-surface transition-all hover:border-accent hover:bg-accent/5 dark:hover:bg-[#1a2332]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotate-180': showCourseDetails }" class="transition-transform duration-200">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 border-t border-border bg-surface p-4">
        <div class="flex flex-col gap-1" v-if="course?.instructor">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('playback.instructor') }}</span>
          <span class="text-sm font-medium text-text">{{ course.instructor }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.professors && course.professors.length > 0">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('playback.professors') }}</span>
          <span class="text-sm font-medium text-text">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.time">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-sm font-medium text-text">{{ course.time }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.classrooms && course.classrooms.length > 0">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('sessions.classrooms') }}</span>
          <span class="text-sm font-medium text-text">{{ course.classrooms.map((c: { name: string }) => c.name).join(', ') }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.college_name">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('sessions.college') }}</span>
          <span class="text-sm font-medium text-text">{{ course.college_name }}</span>
        </div>
        <div class="flex flex-col gap-1" v-if="course?.participant_count !== undefined">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ $t('sessions.participants') }}</span>
          <span class="text-sm font-medium text-text">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <div v-if="errorMessage" class="mb-4 flex items-center gap-2 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger dark:border-[#5d2d2d] dark:bg-[#3d1a1a] dark:text-text-danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center gap-4 py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--bg-elevated)] border-t-accent dark:border-[var(--bg-hover)] dark:border-t-accent-strong"></div>
        <p>{{ $t('sessions.loadingSessions') }}</p>
      </div>

      <div v-else-if="!errorMessage" class="flex min-h-0 flex-1 flex-col">

        <div v-if="sessions.length === 0" class="py-12 text-center italic text-text-secondary">
          <p>{{ $t('sessions.noSessions') }}</p>
        </div>

        <div v-else class="mt-4 flex min-h-0 flex-1 flex-col">
          <div class="mb-4 flex gap-2 rounded-lg border border-hover bg-elevated p-4">
            <button @click="addAllToQueue" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-success bg-surface px-3 py-2 text-xs text-success transition-all hover:bg-success/10 hover:border-text-success dark:hover:bg-[#1a3d1a] dark:hover:border-[#4dcc4d]" style="min-height: 36px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button @click="downloadAllCamera" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-accent bg-surface px-3 py-2 text-xs text-accent transition-all hover:bg-accent/10 hover:border-accent-hover dark:hover:bg-[#1a2332] dark:hover:border-accent-strong" style="min-height: 36px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button @click="downloadAllScreen" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-[#6f42c1] bg-surface px-3 py-2 text-xs text-[#6f42c1] transition-all hover:bg-[#f3e5f5] hover:border-[#59359a] dark:border-[#cc99ff] dark:text-[#cc99ff] dark:hover:bg-[#2d1a3d] dark:hover:border-[#d9b3ff]" style="min-height: 36px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="sessions-list flex flex-1 flex-col gap-px overflow-y-auto rounded-lg bg-elevated p-1">
            <div
              v-for="session in sessions"
              :key="session.session_id"
              class="flex min-h-[48px] cursor-pointer items-center justify-between rounded bg-surface px-3 py-2 transition-all hover:bg-accent/5 hover:shadow-[0_1px_3px_rgba(0,122,204,0.1)] dark:hover:bg-[#1a2332]"
              @click="selectSession(session)"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/5 text-accent dark:bg-[#1a2332]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="mb-0.5 truncate text-sm font-semibold text-text">{{ session.title }}</div>
                  <div class="flex gap-3 text-xs">
                    <span v-if="session.week_number && session.day" class="whitespace-nowrap font-medium text-accent">
                      {{ $t('sessions.week') }} {{ session.week_number }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ getDayName(session.day) }}
                    </span>
                    <span v-if="session.duration" class="whitespace-nowrap text-text-secondary">
                      {{ formatDuration(session.duration) }}
                    </span>
                    <span v-if="session.started_at" class="whitespace-nowrap text-text-muted">
                      {{ formatDate(session.started_at) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex w-[200px] shrink-0 items-center justify-end gap-1">
                <button @click.stop="addToQueue(session)" class="flex h-10 w-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded border border-success bg-surface transition-all hover:-translate-y-0.5 hover:bg-success/10 hover:border-text-success hover:shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:hover:bg-[#1a3d1a] dark:hover:border-[#4dcc4d]" :title="$t('sessions.addToTask')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none text-success">{{ $t('sessions.task') }}</span>
                </button>
                <button @click.stop="downloadCamera(session)" class="flex h-10 w-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded border border-accent bg-surface transition-all hover:-translate-y-0.5 hover:bg-accent/10 hover:border-accent-hover hover:shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:hover:bg-[#1a2332] dark:hover:border-accent-strong" :title="$t('sessions.downloadCamera')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none text-accent">{{ $t('sessions.camera') }}</span>
                </button>
                <button @click.stop="downloadScreen(session)" class="flex h-10 w-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded border border-[#6f42c1] bg-surface transition-all hover:-translate-y-0.5 hover:bg-[#f3e5f5] hover:border-[#59359a] hover:shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:border-[#cc99ff] dark:hover:bg-[#2d1a3d] dark:hover:border-[#d9b3ff]" :title="$t('sessions.downloadScreen')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span class="text-[10px] font-medium leading-none text-[#6f42c1] dark:text-[#cc99ff]">{{ $t('sessions.screen') }}</span>
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
import { onMounted, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionPage, type SessionCourse, type Session } from '@features/course/useSessionPage'

const props = defineProps<{
  course: SessionCourse | null
}>()

const emit = defineEmits<{
  sessionSelected: [session: Session]
  backToCourses: []
  switchToDownload: [downloadItemId?: string]
  switchToTask: [taskId?: string]
}>()

const { t } = useI18n()

const {
  sessions,
  isLoading,
  errorMessage,
  showCourseDetails,
  goBack,
  selectSession,
  toggleCourseDetails,
  loadCourseSessions,
  addToQueue,
  downloadCamera,
  downloadScreen,
  addAllToQueue,
  downloadAllCamera,
  downloadAllScreen,
  formatDuration,
  getDayName,
  formatDate
} = useSessionPage({
  course: toRef(() => props.course),
  t,
  onSessionSelected: (session: Session) => emit('sessionSelected', session),
  onBackToCourses: () => emit('backToCourses'),
  onSwitchToDownload: (downloadItemId?: string) => emit('switchToDownload', downloadItemId),
  onSwitchToTask: (taskId?: string) => emit('switchToTask', taskId)
})

onMounted(() => {
  loadCourseSessions()
})
</script>

<style scoped>
/* Custom scrollbar styles - macOS style thin scrollbars that auto-hide */
.sessions-list {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.sessions-list:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.sessions-list::-webkit-scrollbar {
  width: 6px;
}

.sessions-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.sessions-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  border: none;
  transition: background 0.3s ease;
}

.sessions-list:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.sessions-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}
</style>
