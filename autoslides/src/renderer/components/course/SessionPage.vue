<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-line bg-elevated p-4">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-line-input bg-field px-3 py-1.5 text-xs text-fg transition-colors hover:bg-hover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          {{ $t('sessions.backToCourses') }}
        </button>
        <h2 class="m-0 flex-1 truncate text-lg font-semibold text-fg">{{ course?.title }}</h2>
        <button @click="toggleCourseDetails" class="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-fg-secondary transition-colors hover:bg-hover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform" :class="{ 'rotate-180': showCourseDetails }">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      <div v-show="showCourseDetails" class="mt-3 grid grid-cols-2 gap-2">
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.instructor">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('playback.instructor') }}</span>
          <span class="text-fg">{{ course.instructor }}</span>
        </div>
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.professors && course.professors.length > 0">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('playback.professors') }}</span>
          <span class="text-fg">{{ course.professors.join(', ') }}</span>
        </div>
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.time">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('sessions.academicTerm') }}</span>
          <span class="text-fg">{{ course.time }}</span>
        </div>
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.classrooms && course.classrooms.length > 0">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('sessions.classrooms') }}</span>
          <span class="text-fg">{{ course.classrooms.map((c: { name: string }) => c.name).join(', ') }}</span>
        </div>
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.college_name">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('sessions.college') }}</span>
          <span class="text-fg">{{ course.college_name }}</span>
        </div>
        <div class="flex items-baseline gap-2 text-xs" v-if="course?.participant_count !== undefined">
          <span class="flex-shrink-0 font-medium text-fg-muted">{{ $t('sessions.participants') }}</span>
          <span class="text-fg">{{ course.participant_count }} {{ $t('sessions.participantsCount') }}</span>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="errorMessage" class="mb-3 flex items-center gap-2 rounded border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="flex flex-col items-center justify-center gap-3 py-16 text-fg-secondary">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent"></div>
        <p class="m-0 text-sm">{{ $t('sessions.loadingSessions') }}</p>
      </div>

      <div v-else-if="!errorMessage">

        <div v-if="sessions.length === 0" class="py-16 text-center text-fg-secondary">
          <p class="m-0 text-sm italic">{{ $t('sessions.noSessions') }}</p>
        </div>

        <div v-else>
          <div class="mb-4 flex flex-wrap gap-2">
            <button @click="addAllToQueue" class="flex cursor-pointer items-center gap-1.5 rounded border border-line-input bg-field px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ $t('sessions.addAllToTasks') }}
            </button>
            <button @click="downloadAllCamera" class="flex cursor-pointer items-center gap-1.5 rounded border border-line-input bg-field px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ $t('sessions.downloadAllCamera') }}
            </button>
            <button @click="downloadAllScreen" class="flex cursor-pointer items-center gap-1.5 rounded border border-line-input bg-field px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {{ $t('sessions.downloadAllScreen') }}
            </button>
          </div>
          <div class="flex flex-col gap-2">
            <div
              v-for="session in sessions"
              :key="session.session_id"
              class="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 transition-all hover:border-accent hover:shadow-sm"
              @click="selectSession(session)"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-elevated text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-fg">{{ session.title }}</div>
                  <div class="mt-0.5 flex flex-wrap gap-2 text-[11px] text-fg-muted">
                    <span v-if="session.week_number && session.day">
                      {{ $t('sessions.week') }} {{ session.week_number }}{{ $t('sessions.week') === '第' ? '周' : '' }}, {{ getDayName(session.day) }}
                    </span>
                    <span v-if="session.duration">
                      {{ formatDuration(session.duration) }}
                    </span>
                    <span v-if="session.started_at">
                      {{ formatDate(session.started_at) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex flex-shrink-0 gap-1.5">
                <button @click.stop="addToQueue(session)" class="flex cursor-pointer items-center gap-1 rounded border border-line-input bg-field px-2 py-1 text-[11px] text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent" :title="$t('sessions.addToTask')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  <span>{{ $t('sessions.task') }}</span>
                </button>
                <button @click.stop="downloadCamera(session)" class="flex cursor-pointer items-center gap-1 rounded border border-line-input bg-field px-2 py-1 text-[11px] text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent" :title="$t('sessions.downloadCamera')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>{{ $t('sessions.camera') }}</span>
                </button>
                <button @click.stop="downloadScreen(session)" class="flex cursor-pointer items-center gap-1 rounded border border-line-input bg-field px-2 py-1 text-[11px] text-fg transition-colors hover:border-accent hover:bg-hover hover:text-accent" :title="$t('sessions.downloadScreen')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span>{{ $t('sessions.screen') }}</span>
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

