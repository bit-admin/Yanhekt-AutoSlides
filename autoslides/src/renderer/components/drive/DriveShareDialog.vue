<template>
  <div class="modal-overlay" @click.self="onOverlay">
    <div class="dialog-box drive-share-box" role="dialog" aria-modal="true" @click.stop>
      <h3 class="dialog-title">{{ $t('drive.createShareTitle') }}</h3>
      <p class="dialog-help">{{ title }}</p>

      <template v-if="!made">
        <!-- Every extracted slide must be on Drive as it is now. -->
        <p v-if="missing > 0" class="drive-share-note" role="status">
          {{ $t('drive.shareNeedsUpload', { count: missing }) }}
        </p>
        <p v-else class="drive-share-note">{{ $t('drive.shareSlides', { count: folder.counts.total }) }}</p>

        <label class="checkbox-label drive-share-option">
          <input v-model="timeline" type="checkbox" />
          <span>{{ $t('advanced.cloudStorage.shareTimelineTitle') }}</span>
        </label>
        <p class="drive-share-hint">{{ $t('advanced.cloudStorage.shareTimelineDescription') }}</p>
        <label class="checkbox-label drive-share-option">
          <input v-model="shorten" type="checkbox" />
          <span>{{ $t('drive.shortLink') }}</span>
        </label>

        <p v-if="error" class="drive-share-error" role="alert">{{ error }}</p>

        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" :disabled="working" @click="emit('close')">
            {{ $t('trash.cancel') }}
          </button>
          <button
            v-if="missing > 0"
            type="button"
            class="btn btn--primary dialog-btn"
            :disabled="working || uploading"
            @click="uploadFirst"
          >
            {{ uploading ? $t('drive.uploadWaiting') : $t('drive.uploadFirst') }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn--primary dialog-btn"
            :disabled="working"
            @click="create"
          >
            {{ working ? $t('drive.creatingShare') : $t('drive.createShare') }}
          </button>
        </div>
      </template>

      <template v-else>
        <p class="drive-share-note">{{ copied ? $t('drive.linkCopied') : $t('drive.linkReady') }}</p>
        <input class="input-field drive-share-url" :value="made.shortUrl || made.longUrl" readonly @focus="selectAll" />
        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" @click="copy">{{ $t('drive.copyLink') }}</button>
          <button type="button" class="btn btn--primary dialog-btn" @click="emit('close')">{{ $t('drive.done') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DriveFolderSummary } from '@common/driveStatus'
import type { SlideShareRecord } from '@common/sidecars/metadata'
import { configStore } from '@shared/services/configStore'
import { DriveUploads } from '@shared/services/driveUploadQueue'
import { startDriveUploads } from '@shared/services/driveUploadStart'
import { driveFolderTitle } from '@features/cloudNotes/useDrivePage'

const props = defineProps<{ folder: DriveFolderSummary }>()
const emit = defineEmits<{ close: []; created: [] }>()
const { t } = useI18n()

// The Settings value is the default; the choice here is for this link only.
const timeline = ref(configStore.cloudShareEmbedTimeline !== false)
const shorten = ref(true)
const working = ref(false)
const error = ref('')
const made = ref<SlideShareRecord | null>(null)
const copied = ref(false)

const title = computed(() => driveFolderTitle(props.folder))
const missing = computed(() => props.folder.counts.total - props.folder.counts.uploaded)
const uploading = computed(() => DriveUploads.isBusy(props.folder.path))

watch(() => props.folder.counts.uploaded, () => { error.value = '' })

function errorText(code: string, count?: number): string {
  switch (code) {
    case 'not-uploaded': return t('drive.shareNeedsUpload', { count: count ?? missing.value })
    case 'nothing-to-share': return t('drive.nothingToShare')
    case 'not-recognised': return t('drive.noneRecognised')
    default: return t('drive.shareFailed')
  }
}

async function uploadFirst(): Promise<void> {
  await startDriveUploads(t, [{ path: props.folder.path, recognised: props.folder.recognised }])
}

async function create(): Promise<void> {
  working.value = true
  error.value = ''
  try {
    const result = await window.electronAPI.drive.createShare(String(props.folder.path), {
      timeline: timeline.value,
      shorten: shorten.value,
    })
    if (!result.ok) {
      error.value = errorText(result.error, result.count)
      return
    }
    made.value = result.data
    emit('created')
    await copy()
  } finally {
    working.value = false
  }
}

async function copy(): Promise<void> {
  if (!made.value) return
  try {
    await navigator.clipboard.writeText(made.value.shortUrl || made.value.longUrl)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function selectAll(event: FocusEvent): void {
  (event.target as HTMLInputElement).select()
}

function onOverlay(): void {
  if (!working.value) emit('close')
}
</script>

<style scoped>
.drive-share-box {
  width: min(460px, 92vw);
}

.drive-share-note {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.drive-share-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
}

.drive-share-hint {
  margin: 4px 0 0 26px;
  font-size: 12px;
  color: var(--text-muted);
}

.drive-share-error {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.drive-share-url {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
