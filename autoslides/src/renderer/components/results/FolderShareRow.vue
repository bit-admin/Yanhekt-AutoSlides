<template>
  <!-- A folder's share links, under its row on the Slides page: the newest by
       default, older versions through the arrows. A short link, once made,
       replaces the long one in the row. -->
  <div class="share-row">
    <svg class="share-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    <button type="button" class="share-url" :title="$t('drive.openShareLink')" @click="open">{{ shownUrl }}</button>
    <span
      class="share-marker"
      :class="{ 'share-marker--none': !shown.timeline }"
      :title="shown.timeline ? $t('drive.linkTimelineHint') : $t('drive.linkNoTimelineHint')"
    >{{ shown.timeline ? $t('drive.linkTimeline') : $t('drive.linkNoTimeline') }}</span>
    <!-- No link matches the folder as it is now (a crop, a trash or a new
         slide since): every version shows the slides from before. -->
    <span
      v-if="outdated"
      class="share-marker share-marker--outdated"
      :title="$t('drive.linkOutdatedHint')"
    >{{ $t('drive.linkOutdated') }}</span>

    <div class="share-actions">
      <!-- Versions: remove (never the current link), older, n/m, newer. -->
      <template v-if="shares.length > 1">
        <button
          type="button"
          class="share-action"
          :disabled="shown.current || removing"
          :title="removeHint"
          :aria-label="removeHint"
          @click="remove"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <button
          type="button"
          class="share-action"
          :disabled="index === 0"
          :title="$t('drive.olderLink')"
          :aria-label="$t('drive.olderLink')"
          @click="select(index - 1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="share-version" :title="versionHint">{{ index + 1 }}/{{ shares.length }}</span>
        <button
          type="button"
          class="share-action"
          :disabled="index === shares.length - 1"
          :title="$t('drive.newerLink')"
          :aria-label="$t('drive.newerLink')"
          @click="select(index + 1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <span class="share-divider" aria-hidden="true" />
      </template>

      <button
        type="button"
        class="share-action"
        :class="{ 'share-action--done': copied }"
        :title="copied ? $t('drive.linkCopied') : $t('drive.copyLink')"
        :aria-label="copied ? $t('drive.linkCopied') : $t('drive.copyLink')"
        @click="copy"
      >
        <svg v-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <button
        type="button"
        class="share-action"
        :disabled="!!shown.shortUrl || !shown.canShorten || shortening"
        :title="shortenHint"
        :aria-label="shortenHint"
        @click="shorten"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="6" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>
        </svg>
      </button>
      <button
        type="button"
        class="share-action"
        :title="$t('drive.openShareLink')"
        :aria-label="$t('drive.openShareLink')"
        @click="open"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 3h6v6"/>
          <path d="M10 14 21 3"/>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DriveShareLink } from '@common/driveStatus'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('FolderShareRow')

const props = defineProps<{
  folderPath: string
  /** Oldest first; never empty. */
  shares: DriveShareLink[]
}>()

const emit = defineEmits<{
  /** A link was shortened or removed: the folder's list needs reading again. */
  (e: 'changed'): void
}>()

const { t, locale } = useI18n()

// The version picked with the arrows; null follows the newest, so a new
// upload's link shows up without touching the arrows.
const selectedId = ref<string | null>(null)
const index = computed(() => {
  const found = selectedId.value ? props.shares.findIndex((s) => s.id === selectedId.value) : -1
  return found >= 0 ? found : props.shares.length - 1
})
const shown = computed(() => props.shares[index.value])
const shownUrl = computed(() => shown.value.shortUrl ?? shown.value.longUrl)
const outdated = computed(() => !props.shares.some((s) => s.current))

const select = (i: number) => {
  const share = props.shares[i]
  if (!share) return
  selectedId.value = i === props.shares.length - 1 ? null : share.id
}

const versionHint = computed(() => t('drive.linkVersion', {
  index: index.value + 1,
  count: props.shares.length,
  date: new Date(shown.value.createdAt).toLocaleString(locale.value),
}))

const shortenHint = computed(() => {
  if (shown.value.shortUrl) return t('drive.alreadyShort')
  if (!shown.value.canShorten) return t('drive.tooLongToShorten')
  return t('drive.shortenLink')
})

const open = () => {
  void window.electronAPI.shell.openExternal(shownUrl.value)
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const copy = async () => {
  try {
    await navigator.clipboard.writeText(shownUrl.value)
  } catch (error) {
    log.warn('Copy failed', error)
    return
  }
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1500)
}

const shortening = ref(false)

const shorten = async () => {
  const share = shown.value
  if (shortening.value || share.shortUrl || !share.canShorten) return
  shortening.value = true
  try {
    const result = await window.electronAPI.drive.shortenShare(props.folderPath, share.id)
    if (result.ok) {
      emit('changed')
    } else {
      log.warn('Shorten failed', result.error, result.message)
      await window.electronAPI.dialog.showMessageBox({
        type: 'info',
        message: t('drive.shortenFailed'),
        buttons: [t('lectureOutputs.ok')],
      })
    }
  } finally {
    shortening.value = false
  }
}

const removeHint = computed(() => (shown.value.current ? t('drive.currentLinkStays') : t('drive.removeLink')))

const removing = ref(false)

const remove = async () => {
  const share = shown.value
  if (removing.value || share.current || props.shares.length <= 1) return
  const answer = await window.electronAPI.dialog.showMessageBox({
    type: 'warning',
    message: t('drive.removeLinkMessage'),
    detail: t('drive.removeLinkDetail'),
    buttons: [t('trash.cancel'), t('drive.remove')],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
  })
  if (answer.response !== 1) return
  // Land on the neighbour: the newer one, or the older one when this was the newest.
  const i = index.value
  const next = props.shares[i + 1] ?? props.shares[i - 1]
  removing.value = true
  try {
    const result = await window.electronAPI.drive.removeShare(props.folderPath, share.id)
    if (result.ok) {
      selectedId.value = next && next !== props.shares[props.shares.length - 1] ? next.id : null
      emit('changed')
    } else {
      log.warn('Remove link failed', result.error, result.message)
    }
  } finally {
    removing.value = false
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.share-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 12px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-input);
  min-width: 0;
}

.share-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

/* The link keeps to the left part of the row; the actions own the right. */
.share-url {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 50%;
  padding: 2px 0;
  border: 0;
  background: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  text-align: left;
  color: var(--link-color);
  cursor: pointer;
}

.share-url:hover {
  text-decoration: underline;
}

/* Same chip as the ids beside a name; dashed when the timeline is missing. */
.share-marker {
  flex-shrink: 0;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-subtle);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: var(--text-muted);
  cursor: help;
}

.share-marker--none {
  border-style: dashed;
  background: none;
}

.share-marker--outdated {
  border-color: var(--warning-border);
  background: var(--warning-bg);
  color: var(--warning);
}

.share-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}

.share-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.share-action:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.share-action:disabled {
  opacity: 0.4;
  cursor: default;
}

.share-action--done {
  color: var(--success);
}

.share-url:focus-visible,
.share-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.share-version {
  min-width: 3ch;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
  cursor: default;
}

.share-divider {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background-color: var(--border-color);
}
</style>
