<template>
  <!-- Share note modal: long link, short link (minted + recorded on the note),
       and AutoSlides Index publish. Owns all share state; the parent opens it
       via the exposed open() when the editor pane emits `share`. -->
  <div v-if="showShareModal" class="modal-overlay" @click.self="close">
    <div class="cn-import-box cn-share-box">
      <button class="modal-close cn-share-close" :aria-label="$t('cloudNotes.shareClose')" :title="$t('cloudNotes.shareClose')" @click="close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <h3 class="cn-modal-title">{{ $t('cloudNotes.shareTitle') }}</h3>
      <p class="cn-share-meta">
        <template v-if="shareImageCount > 0">{{ $t('cloudNotes.shareImagesCount', { n: shareImageCount }) }}</template>
        <template v-else>{{ $t('cloudNotes.shareNoImages') }}</template>
      </p>

      <div class="cn-share-field">
        <span class="cn-share-label">{{ $t('cloudNotes.shareLongLabel') }}</span>
        <div class="cn-share-row">
          <input class="text-input cn-share-url" readonly :value="shareLongUrl" @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn cn-share-action" :disabled="shareImageCount === 0" @click="onCopyShare('long')">
            {{ shareCopied === 'long' ? $t('cloudNotes.shareCopied') : $t('cloudNotes.shareCopy') }}
          </button>
          <button class="btn cn-share-action" :disabled="shareImageCount === 0" @click="onOpenShare('long')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ $t('cloudNotes.shareOpen') }}</span>
          </button>
        </div>
      </div>

      <div class="cn-share-field">
        <span class="cn-share-label">{{ $t('cloudNotes.shareShortLabel') }}</span>
        <div v-if="shareShortUrl" class="cn-share-row">
          <input class="text-input cn-share-url" readonly :value="shareShortUrl" @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn cn-share-action" @click="onCopyShare('short')">
            {{ shareCopied === 'short' ? $t('cloudNotes.shareCopied') : $t('cloudNotes.shareCopy') }}
          </button>
          <button class="btn cn-share-action" @click="onOpenShare('short')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ $t('cloudNotes.shareOpen') }}</span>
          </button>
        </div>
        <div v-else class="cn-share-row">
          <button class="btn cn-share-action cn-share-getshort" :disabled="shareShortening || shareImageCount === 0" @click="onGetShortLink">
            {{ shareShortening ? $t('cloudNotes.shareShortening') : $t('cloudNotes.shareGetShort') }}
          </button>
          <span v-if="shareShortError" class="cn-share-error">{{ shareShortError }}</span>
        </div>
      </div>

      <div class="cn-share-field">
        <span class="cn-share-label">{{ $t('cloudNotes.shareIndexLabel') }}</span>
        <div v-if="shareIndexUrl" class="cn-share-row">
          <input class="text-input cn-share-url" readonly :value="shareIndexUrl" @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn cn-share-action" @click="onCopyShare('index')">
            {{ shareCopied === 'index' ? $t('cloudNotes.shareCopied') : $t('cloudNotes.shareCopy') }}
          </button>
          <button class="btn cn-share-action" @click="onOpenShare('index')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ $t('cloudNotes.shareOpen') }}</span>
          </button>
        </div>
        <div v-else class="cn-share-row">
          <button class="btn cn-share-action cn-share-getshort" :disabled="shareIndexing || !shareCanIndex || shareImageCount === 0" @click="onPublishToIndex">
            {{ shareIndexing ? $t('cloudNotes.shareIndexPublishing') : $t('cloudNotes.shareIndexPublish') }}
          </button>
          <span v-if="!shareCanIndex" class="cn-share-hint">{{ $t('cloudNotes.shareIndexUnavailable') }}</span>
          <span v-else-if="shareIndexError" class="cn-share-error">{{ shareIndexError }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildSharePayload, buildShareUrl, encodeSharePayload } from '@common/shareLink'
import { noteImageUrls, findRecordedShareUrl, readNoteMetadata, upsertNoteMetadata } from '@common/notesContent'
import { managedNoteDisplayName } from '@common/notesTypes'
import type { SlideMetadataSource } from '@common/slideMetadataTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import type { useNotesPublish } from '@features/cloudNotes/useNotesPublish'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  publisher: ReturnType<typeof useNotesPublish>
  /** Freshest stringified content for the open note (the editor composable's currentNoteContent). */
  getContent: () => Promise<string>
  /** Called after publish/shortlink rewrites the note content — remounts the live editor. */
  onContentUpdated: (content: string) => Promise<void>
}>()

const { t } = useI18n()

const showShareModal = ref(false)
const shareLongUrl = ref('')
const shareShortUrl = ref<string | null>(null)
const shareFragment = ref('')
const shareImageCount = ref(0)
const shareShortening = ref(false)
const shareShortError = ref('')
const shareCopied = ref<'long' | 'short' | 'index' | null>(null)
const shareIndexUrl = ref<string | null>(null)
const shareIndexing = ref(false)
const shareIndexError = ref('')
const shareIndexSource = ref<SlideMetadataSource | null>(null)
const shareReview = ref<{ reviewed: boolean; edited: boolean }>({ reviewed: false, edited: false })
// Only recorded-session notes carry the course/session identity the index needs.
const shareCanIndex = computed(() => !!(shareIndexSource.value?.courseId && shareIndexSource.value?.sessionId))

async function open(): Promise<void> {
  const note = props.cn.selectedNote.value
  if (!note) return
  const content = await props.getContent()
  const urls = noteImageUrls(content)
  const payload = buildSharePayload(managedNoteDisplayName(note.title), urls)
  shareFragment.value = encodeSharePayload(payload)
  shareLongUrl.value = buildShareUrl(payload)
  shareImageCount.value = urls.length
  shareShortUrl.value = findRecordedShareUrl(content)
  shareShortError.value = ''
  shareCopied.value = null
  // Index publish state: identity + review come from the embedded slides metadata.
  const meta = readNoteMetadata(content)
  shareIndexUrl.value = meta?.note.indexUrl ?? null
  shareIndexSource.value = meta?.slides?.source ?? null
  const rev = meta?.slides?.review
  const edited = !!(rev?.edited || rev?.cropped)
  // Editing implies reviewing.
  shareReview.value = { reviewed: !!rev?.reviewed || edited, edited }
  shareIndexError.value = ''
  showShareModal.value = true
}

function close(): void {
  showShareModal.value = false
}

function shareUrlFor(which: 'long' | 'short' | 'index'): string | null {
  if (which === 'short') return shareShortUrl.value
  if (which === 'index') return shareIndexUrl.value
  return shareLongUrl.value
}

async function onCopyShare(which: 'long' | 'short' | 'index'): Promise<void> {
  const url = shareUrlFor(which)
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    shareCopied.value = which
    setTimeout(() => { if (shareCopied.value === which) shareCopied.value = null }, 1500)
  } catch { /* clipboard denied — ignore */ }
}

function onOpenShare(which: 'long' | 'short' | 'index'): void {
  const url = shareUrlFor(which)
  if (url) window.electronAPI.shell.openExternal(url)
}

async function onPublishToIndex(): Promise<void> {
  if (shareIndexing.value || shareIndexUrl.value || !shareCanIndex.value || shareImageCount.value === 0) return
  // Review nudge: editing implies reviewing, so warn only when neither holds.
  if (!shareReview.value.reviewed && !shareReview.value.edited) {
    const res = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'question',
      title: t('cloudNotes.shareIndexLabel'),
      message: t('cloudNotes.shareIndexReviewWarn'),
      buttons: [t('cloudNotes.shareIndexPublishAnyway'), t('cloudNotes.shareIndexReviewFirst')],
      defaultId: 1,
      cancelId: 1,
    })
    if (res && res.response !== 0) return
  }
  const noteId = props.cn.selectedNoteId.value
  if (noteId == null) return
  shareIndexing.value = true
  shareIndexError.value = ''
  try {
    // useNotesPublish owns the payload build, publish, and metadata write-back;
    // it returns the updated content so we can refresh the live editor.
    const res = await props.publisher.publishNote(noteId, await props.getContent())
    if (!res.ok) {
      shareIndexError.value = ('error' in res && res.error) || t('cloudNotes.shareIndexError')
      return
    }
    shareIndexUrl.value = res.indexUrl
    if (res.content) { try { await props.onContentUpdated(res.content) } catch { /* best-effort */ } }
  } catch (e) {
    shareIndexError.value = e instanceof Error ? e.message : String(e)
  } finally {
    shareIndexing.value = false
  }
}

async function onGetShortLink(): Promise<void> {
  if (shareShortening.value || shareShortUrl.value || shareImageCount.value === 0) return
  shareShortening.value = true
  shareShortError.value = ''
  try {
    const res = await window.electronAPI.cloudNotes.shortenShareUrl(shareFragment.value)
    if (!res.ok) { shareShortError.value = t('cloudNotes.shareShortError'); return }
    const url = res.data.url
    shareShortUrl.value = url
    // Record the short link in the note's managed metadata block so it persists
    // and a future Share reuses it instead of minting a new one.
    const noteId = props.cn.selectedNoteId.value
    if (noteId != null) {
      try {
        const content = await props.getContent()
        const next = upsertNoteMetadata(content, { note: { shareUrl: url } })
        if (await props.cn.saveContent(noteId, next)) await props.onContentUpdated(next)
      } catch { /* metadata update is best-effort */ }
    }
  } catch {
    shareShortError.value = t('cloudNotes.shareShortError')
  } finally {
    shareShortening.value = false
  }
}

defineExpose({ open })
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

.cn-share-box {
  position: relative;
  width: 480px;
}

.cn-share-close {
  position: absolute;
  top: 14px;
  right: 14px;
}

.cn-share-meta {
  margin: -4px 0 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.cn-share-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cn-share-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.cn-share-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.cn-share-url {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* Row actions share the input's control height for a consistent line. */
.cn-share-action {
  flex-shrink: 0;
  font-size: 12px;
  padding: 4px 12px;
}

.cn-share-getshort {
  align-self: flex-start;
}

.cn-share-error {
  color: var(--danger);
  font-size: 12px;
  align-self: center;
}

.cn-share-hint {
  color: var(--text-muted);
  font-size: 12px;
  align-self: center;
}
</style>
