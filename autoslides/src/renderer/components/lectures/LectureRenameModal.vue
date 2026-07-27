<template>
  <!-- Drive-style workspace modal chrome (matches NewGroupModal / NoteExportFormatModal). -->
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="lec-modal-box lec-rename-box" @click.stop>
      <h3 class="lec-modal-title">{{ $t('lectures.renameModalTitle') }}</h3>
      <p class="lec-modal-help">
        {{ $t('lectures.renameModalHint') }}
      </p>

      <div class="lec-toggles">
        <label class="lec-toggle">
          <input type="checkbox" v-model="options.includeInstructor" />
          <span>{{ $t('lectures.renameIncludeInstructor') }}</span>
        </label>
        <label class="lec-toggle">
          <input type="checkbox" v-model="options.includeSchoolYear" />
          <span>{{ $t('lectures.renameIncludeSchoolYear') }}</span>
        </label>
        <label class="lec-toggle">
          <input type="checkbox" v-model="options.includeCollege" />
          <span>{{ $t('lectures.renameIncludeCollege') }}</span>
        </label>
        <label class="lec-toggle">
          <input type="checkbox" v-model="options.includeClassrooms" />
          <span>{{ $t('lectures.renameIncludeClassrooms') }}</span>
        </label>
      </div>

      <div v-if="isHydrating" class="lec-status">{{ $t('lectures.renameHydrating') }}</div>
      <div v-else-if="hydrateWarning" class="lec-status lec-status--warn">{{ hydrateWarning }}</div>

      <div class="lec-preview custom-scrollbar">
        <div v-for="row in previews" :key="row.path" class="lec-preview-row">
          <div class="lec-preview-from" :title="row.fromName">{{ row.fromName }}</div>
          <div class="lec-preview-arrow">→</div>
          <div class="lec-preview-to" :title="row.toName">{{ row.toName }}</div>
        </div>
        <div v-if="previews.length === 0 && !isHydrating" class="lec-preview-empty">
          {{ $t('lectures.renameModalHint') }}
        </div>
      </div>

      <div class="lec-modal-actions">
        <button
          type="button"
          class="btn lec-modal-btn"
          :disabled="isApplying"
          @click="emit('close')"
        >
          {{ $t('trash.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary lec-modal-btn"
          :disabled="previews.length === 0 || isHydrating || isApplying"
          @click="apply"
        >
          {{ isApplying ? $t('lectures.renaming') : $t('lectures.applyRename', { count: previews.length }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LectureRenameOptions } from '@common/types'
import {
  allocateUniqueFileName,
  buildDefaultRenameStem,
  buildLectureVideoFileName,
  episodeIndexForSession,
  type LectureVideoType,
} from '@common/lectureVideoNaming'
import { ApiClient } from '@shared/services/apiClient'
import { tokenManager } from '@shared/services/authService'
import { lookupCourseById } from '@features/course/lookupCourseById'
import { DEFAULT_RENAME } from '@features/lectures/lecturePrefs'
import type { LectureVideoItem } from '@features/lectures/useLecturesPage'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureRenameModal')
const { t } = useI18n()
const apiClient = new ApiClient()

const props = defineProps<{
  items: LectureVideoItem[]
  /** All basenames currently in the output dir (for collision avoidance). */
  existingNames: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
}>()

// Fresh defaults each open — not persisted (Slides PDF export convention).
const options = reactive<LectureRenameOptions>({ ...DEFAULT_RENAME })
const isHydrating = ref(false)
const isApplying = ref(false)
const hydrateWarning = ref('')

interface CourseMeta {
  title: string
  instructor?: string
  schoolYear?: string
  semester?: string | number
  college?: string
  classrooms?: string[]
  sessions: Array<{
    session_id: string
    title: string
    week_number?: number
    day?: number
    started_at?: string
  }>
}

const metaByCourse = ref<Map<string, CourseMeta>>(new Map())

const hydrate = async () => {
  isHydrating.value = true
  hydrateWarning.value = ''
  const map = new Map<string, CourseMeta>()
  const token = tokenManager.getToken()
  const courseIds = [...new Set(props.items.map((i) => i.courseId).filter(Boolean))] as string[]

  if (!token) {
    hydrateWarning.value = t('lectures.renameOfflineWarning')
  }

  for (const courseId of courseIds) {
    if (!token) {
      map.set(courseId, {
        title: props.items.find((i) => i.courseId === courseId)?.displayName.split(' - ')[0]
          || props.items.find((i) => i.courseId === courseId)?.displayName
          || courseId,
        sessions: [],
      })
      continue
    }
    try {
      const [info, list] = await Promise.all([
        apiClient.getCourseInfo(courseId, token),
        lookupCourseById(token, courseId),
      ])
      map.set(courseId, {
        title: info.title || list?.title || courseId,
        instructor: info.professor || list?.instructor,
        schoolYear: info.school_year || list?.school_year,
        semester: info.semester ?? list?.semester,
        college: info.college_name || list?.college_name,
        classrooms: (list?.classrooms || []).map((c) => c.name).filter(Boolean),
        sessions: (info.videos || []).map((v) => ({
          session_id: String(v.session_id),
          title: v.title,
          week_number: v.week_number,
          day: v.day,
          started_at: v.started_at,
        })),
      })
    } catch (error) {
      log.warn('Failed to hydrate course for rename', courseId, error)
      map.set(courseId, {
        title: props.items.find((i) => i.courseId === courseId)?.displayName || courseId,
        sessions: [],
      })
      hydrateWarning.value = t('lectures.renamePartialWarning')
    }
  }

  metaByCourse.value = map
  isHydrating.value = false
}

onMounted(() => {
  void hydrate()
})

interface PreviewRow {
  path: string
  fromName: string
  toName: string
  videoType: LectureVideoType
}

const previews = computed<PreviewRow[]>(() => {
  const existing = new Set(props.existingNames)
  const reserved = new Set<string>()

  return props.items
    .filter((item) => item.recognised && item.courseId && item.sessionId && item.videoType)
    .map((item) => {
      const meta = metaByCourse.value.get(item.courseId!)
      const episode = meta
        ? episodeIndexForSession(meta.sessions, item.sessionId!)
        : null
      const sessionTitle =
        meta?.sessions.find((s) => String(s.session_id) === String(item.sessionId))?.title
        || item.displayName

      const stem = buildDefaultRenameStem({
        courseTitle: meta?.title || item.displayName,
        sessionTitle,
        semester: meta?.semester,
        episode,
        instructor: meta?.instructor,
        schoolYear: meta?.schoolYear,
        college: meta?.college,
        classrooms: meta?.classrooms,
        includeInstructor: options.includeInstructor,
        includeSchoolYear: options.includeSchoolYear,
        includeCollege: options.includeCollege,
        includeClassrooms: options.includeClassrooms,
      })

      const ext = item.name.includes('.') ? item.name.slice(item.name.lastIndexOf('.')) : '.mp4'
      let toName = buildLectureVideoFileName({
        stem,
        courseId: item.courseId!,
        sessionId: item.sessionId!,
        videoType: item.videoType!,
        compressPreset: item.compressPreset,
        ext,
      })

      const combined = new Set([...existing, ...reserved])
      toName = allocateUniqueFileName(toName, combined, item.name)
      reserved.add(toName)

      return {
        path: item.path,
        fromName: item.name,
        toName,
        videoType: item.videoType!,
      }
    })
})

const apply = async () => {
  isApplying.value = true
  let failed = 0
  for (const row of previews.value) {
    if (row.fromName === row.toName) continue
    try {
      await window.electronAPI.lectures.rename(row.path, row.toName)
    } catch (error) {
      failed += 1
      log.error('Rename failed', row.fromName, error)
    }
  }
  isApplying.value = false
  if (failed > 0) {
    void window.electronAPI.dialog?.showMessageBox?.({
      type: 'warning',
      message: t('lectures.renamePartialResult', { failed }),
    })
  }
  emit('done')
}
</script>

<style scoped>
.lec-modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 90vh;
}

.lec-rename-box {
  width: min(560px, 94vw);
}

.lec-modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.lec-modal-help {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  text-align: center;
}

.lec-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.lec-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.lec-toggle input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.lec-status {
  font-size: 12px;
  color: var(--text-muted);
}

.lec-status--warn {
  color: var(--warning);
}

.lec-preview {
  min-height: 120px;
  max-height: 38vh;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-surface);
}

.lec-preview-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
}

.lec-preview-row:last-child {
  border-bottom: none;
}

.lec-preview-from {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lec-preview-arrow {
  color: var(--text-muted);
}

.lec-preview-to {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lec-preview-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.lec-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.lec-modal-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}
</style>
