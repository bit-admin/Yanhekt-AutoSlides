<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="cn-import-box cn-removal-box">
      <h3 class="cn-modal-title">{{ $t('cloudIndex.removalTitle') }}</h3>

      <p v-if="done" class="cn-removal-body">{{ done.message }}</p>
      <template v-else>
        <p class="cn-removal-body">{{ $t('cloudIndex.removalBody') }}</p>
        <p v-if="errorMsg" class="cn-share-error">{{ errorMsg }}</p>
      </template>

      <div class="cn-modal-actions">
        <template v-if="done">
          <button class="btn btn--primary cn-modal-btn" @click="finish">{{ $t('cloudIndex.removalClose') }}</button>
        </template>
        <template v-else>
          <button class="btn cn-modal-btn" :disabled="busy" @click="emit('close')">{{ $t('cloudNotes.cancel') }}</button>
          <button class="btn btn--danger cn-modal-btn" :disabled="busy" @click="submit">
            {{ busy ? $t('cloudIndex.removalBusy') : $t('cloudIndex.removalConfirm') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotesResult, IndexRemovalResult } from '@common/notesTypes'

const props = defineProps<{
  courseId: string
  sessionId: string
  onSubmit: (courseId: string, sessionId: string) => Promise<NotesResult<IndexRemovalResult>>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'removed', lectureRemoved: boolean): void
}>()

const { t } = useI18n()

const busy = ref(false)
const errorMsg = ref('')
// `changed` distinguishes an actual removal (parent must refresh) from a no-op.
const done = ref<{ message: string; changed: boolean; lectureRemoved: boolean } | null>(null)

async function submit(): Promise<void> {
  busy.value = true
  errorMsg.value = ''
  try {
    const res = await props.onSubmit(props.courseId, props.sessionId)
    if (!res.ok) {
      errorMsg.value = res.error === 'not-signed-in' ? t('cloudNotes.notSignedIn') : t('cloudIndex.removalError')
      return
    }
    if (res.data.removed === 0) {
      done.value = { message: t('cloudIndex.removalNoVersions'), changed: false, lectureRemoved: false }
      return
    }
    done.value = {
      message: t('cloudIndex.removalDone', { n: res.data.removed }),
      changed: true,
      lectureRemoved: res.data.lectureRemoved,
    }
  } catch {
    errorMsg.value = t('cloudIndex.removalNetworkError')
  } finally {
    busy.value = false
  }
}

function finish(): void {
  if (done.value?.changed) emit('removed', done.value.lectureRemoved)
  else emit('close')
}
</script>

<style scoped>
/* This modal's copy of the shared modal-box classes (ImportProgressModal
   precedent: extracted modals carry their own scoped subset). */
.cn-import-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  box-shadow: 0 8px 32px var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cn-modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.cn-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.cn-modal-btn {
  flex: 1;
  min-height: 32px;
  border-radius: 7px;
  font-size: 13px;
}

.cn-share-error {
  color: var(--danger);
  font-size: 12px;
  align-self: center;
}

.cn-removal-box {
  max-width: 420px;
}

.cn-removal-body {
  margin: 4px 0 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
