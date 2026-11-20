<template>
  <!-- Share note modal: long link and short link (minted + recorded on the
       note). Owns all share state; the parent opens it
       via the exposed open() when the editor pane emits `share`. -->
  <div v-if="showShareModal" class="modal-overlay" @click.self="close">
    <div class="dialog-box cn-share-box">
      <h3 class="dialog-title">{{ $t('cloudNotes.shareTitle') }}</h3>
      <p class="cn-share-meta">
        <template v-if="shareImageCount > 0">{{ $t('cloudNotes.shareImagesCount', { n: shareImageCount }) }}</template>
        <template v-else>{{ $t('cloudNotes.shareNoImages') }}</template>
      </p>
      <p v-if="shareMode === 'link-only'" class="cn-share-hint-block">{{ $t('cloudNotes.shareImagesOnlyHint') }}</p>

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

      <template v-if="shareMode === 'full'">
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
      </template>

      <div class="dialog-actions">
        <button class="btn dialog-btn" type="button" @click="close">{{ $t('cloudNotes.shareClose') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildSharePayload, buildShareUrl, encodeSharePayload, parseCossImageUrl } from '@common/shareLink'
import { shareTimelineDeltaFromNote } from '@common/shareTimeline'
import { noteImageUrls, findRecordedShareUrl, readNoteMetadata, upsertNoteMetadata } from '@common/notesContent'
import { configStore } from '@shared/services/configStore'
import { managedNoteIdentity } from '@common/notesTypes'
import type { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { overrides } from '@shared/overrideRegistry'

const props = defineProps<{
  cn: ReturnType<typeof useCloudNotes>
  /** Freshest stringified content for the open note (the editor composable's currentNoteContent). */
  getContent: () => Promise<string>
  /** Called after the short link rewrites the note content — remounts the live editor. */
  onContentUpdated: (content: string) => Promise<void>
}>()

const { t } = useI18n()

const showShareModal = ref(false)
/** ASnote keeps the short link; other groups are long-link only. */
const shareMode = ref<'full' | 'link-only'>('full')
const shareLongUrl = ref('')
const shareShortUrl = ref<string | null>(null)
const shareFragment = ref('')
const shareImageCount = ref(0)
const shareShortening = ref(false)
const shareShortError = ref('')
const shareCopied = ref<'long' | 'short' | null>(null)

function isASnoteGroup(noteGroupId: number | null | undefined): boolean {
  const managedGroupId = cloudStorageStore.managedGroupId.value
  if (managedGroupId == null) return false
  return Number(noteGroupId ?? 0) === Number(managedGroupId)
}

async function open(): Promise<void> {
  const note = props.cn.selectedNote.value
  if (!note) return
  const content = await props.getContent()
  const noteUrls = noteImageUrls(content)
  const urls = overrides.noteImageUrls?.(noteUrls) ?? noteUrls
  const cossCount = urls.reduce((n, u) => n + (parseCossImageUrl(u) ? 1 : 0), 0)
  const metaForShare = readNoteMetadata(content)
  const embed = configStore.cloudShareEmbedTimeline !== false
  const t = embed ? shareTimelineDeltaFromNote(metaForShare?.timeline ?? null, urls.length) : undefined
  const payload = buildSharePayload(managedNoteIdentity(note.title), urls, undefined, t ? { t } : undefined)
  shareMode.value = isASnoteGroup(note.note_group_id) ? 'full' : 'link-only'
  shareFragment.value = encodeSharePayload(payload)
  shareLongUrl.value = buildShareUrl(payload)
  // Count matches what the payload actually encodes (non-COSS URLs are skipped).
  shareImageCount.value = cossCount
  shareShortUrl.value = shareMode.value === 'full' ? findRecordedShareUrl(content) : null
  shareShortError.value = ''
  shareCopied.value = null
  showShareModal.value = true
}

function close(): void {
  showShareModal.value = false
}

function shareUrlFor(which: 'long' | 'short'): string | null {
  if (which === 'short') return shareShortUrl.value
  return shareLongUrl.value
}

async function onCopyShare(which: 'long' | 'short'): Promise<void> {
  const url = shareUrlFor(which)
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    shareCopied.value = which
    setTimeout(() => { if (shareCopied.value === which) shareCopied.value = null }, 1500)
  } catch { /* clipboard denied — ignore */ }
}

function onOpenShare(which: 'long' | 'short'): void {
  const url = shareUrlFor(which)
  if (url) window.electronAPI.shell.openExternal(url)
}

async function onGetShortLink(): Promise<void> {
  if (shareShortening.value || shareShortUrl.value || shareImageCount.value === 0) return
  shareShortening.value = true
  shareShortError.value = ''
  try {
    const notes = overrides.cloudNotesProvider ?? window.electronAPI.cloudNotes
    const res = await notes.shortenShareUrl(shareFragment.value)
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
.cn-share-box {
  width: 480px;
  max-width: 92vw;
  max-height: 80vh;
  overflow: auto;
}

.cn-share-meta {
  margin: -4px 0 4px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.cn-share-hint-block {
  margin: -6px 0 2px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
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
</style>
