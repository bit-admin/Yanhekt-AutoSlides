<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="dialog-box lec-rename-box" @click.stop>
      <h3 class="dialog-title">{{ $t('lectures.renameModalTitle') }}</h3>
      <p class="dialog-help">
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

      <div class="dialog-actions">
        <button
          type="button"
          class="btn dialog-btn"
          :disabled="isApplying"
          @click="emit('close')"
        >
          {{ $t('trash.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn--primary dialog-btn"
          :disabled="previews.length === 0 || isHydrating || isApplying"
          @click="apply"
        >
          {{ isApplying ? $t('lectures.renaming') : $t('lectures.applyRename') }}
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
import { tokenManager } from '@shared/services/authService'
import {
  hydrateCourseMetas,
  type LectureCourseMeta,
} from '@features/lectures/lectureCourseMetaCache'
import { DEFAULT_RENAME } from '@features/lectures/lecturePrefs'
import type { LectureVideoItem } from '@features/lectures/useLecturesPage'
import { overrides } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('LectureRenameModal')
const { t } = useI18n()

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
const metaByCourse = ref<Map<string, LectureCourseMeta>>(new Map())

const hydrate = async () => {
  isHydrating.value = true
  hydrateWarning.value = ''
  const token = tokenManager.getToken()
  const courseIds = [...new Set(props.items.map((i) => i.courseId).filter(Boolean))] as string[]
  const titleBy = new Map<string, string>()
  for (const item of props.items) {
    if (item.courseId && !titleBy.has(item.courseId)) {
      titleBy.set(
        item.courseId,
        item.displayName.split(' - ')[0] || item.displayName || item.courseId,
      )
    }
  }

  if (!token) {
    hydrateWarning.value = t('lectures.renameOfflineWarning')
  }

  try {
    metaByCourse.value = await hydrateCourseMetas(courseIds, titleBy)
    if (token && [...metaByCourse.value.values()].some((m) => m.degraded)) {
      hydrateWarning.value = t('lectures.renamePartialWarning')
    }
  } catch (error) {
    log.warn('Rename hydrate failed', error)
    hydrateWarning.value = t('lectures.renamePartialWarning')
  } finally {
    isHydrating.value = false
  }
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
      await (overrides.lecturesProvider
        ? overrides.lecturesProvider.rename(row.path, row.toName)
        : window.electronAPI.lectures.rename(row.path, row.toName))
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
.lec-rename-box {
  width: min(560px, 94vw);
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
</style>
