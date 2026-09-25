<template>
  <div class="external-note-panel">
    <div class="en-header">
      <span class="en-title" :title="entry.displayName">{{ entry.displayName }}</span>
      <span class="en-provider">{{ $t('advanced.addons.providerObsidian') }}</span>
    </div>

    <div class="en-top">
      <div v-if="entry.status === 'creating'" class="en-card en-muted">
        {{ $t('cloudNotes.watchNotes.creating') }}
      </div>

      <!-- No note yet: the student decides where this lecture's slides go. -->
      <div v-else-if="!entry.target" class="en-card">
        <p class="en-lead">{{ $t('cloudNotes.watchNotes.external.chooseLead') }}</p>
        <div class="en-actions">
          <button
            type="button"
            class="btn btn--primary btn--sm"
            :disabled="!hasVault || busy"
            @click="run(() => watchNotesStore.createObsidianNote(entry.tabId))"
          >
            {{ $t('cloudNotes.watchNotes.external.createNote') }}
          </button>
          <button type="button" class="btn btn--sm" :disabled="busy" @click="chooseNote">
            {{ $t('cloudNotes.watchNotes.external.chooseNote') }}
          </button>
        </div>
        <p v-if="!hasVault" class="en-hint">{{ $t('cloudNotes.watchNotes.external.noVaultHint') }}</p>
      </div>

      <!-- Has a note: which file, and ways to open it. -->
      <div v-else class="en-card">
        <div class="en-note">
          <svg class="en-note-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div class="en-note-text">
            <span class="en-note-name" :title="entry.target.notePath">{{ noteName }}</span>
            <span class="en-note-where">{{ noteWhere }}</span>
          </div>
          <button
            type="button"
            class="btn btn--ghost btn--sm en-change"
            :disabled="busy"
            @click="chooseNote"
          >
            {{ $t('cloudNotes.watchNotes.external.changeNote') }}
          </button>
        </div>
        <div class="en-actions en-actions--fill">
          <button
            v-if="entry.target.vaultPath"
            type="button"
            class="btn btn--primary btn--sm"
            @click="bridge.openInObsidian(entry.tabId)"
          >
            {{ $t('cloudNotes.watchNotes.external.openInObsidian') }}
          </button>
          <button type="button" class="btn btn--sm" @click="bridge.reveal(entry.tabId)">
            {{ isMac ? $t('cloudNotes.watchNotes.external.showInFinder') : $t('cloudNotes.watchNotes.external.showInFolder') }}
          </button>
        </div>
      </div>

      <!-- A vault was found above the chosen note and none is configured yet. -->
      <div v-if="showVaultOffer" class="en-offer">
        <p class="en-offer-text">
          <span class="en-offer-found">{{ $t('cloudNotes.watchNotes.external.foundVault', { name: entry.target?.vaultName }) }}</span>
          <span>{{ $t('cloudNotes.watchNotes.external.foundVaultAsk') }}</span>
        </p>
        <div class="en-offer-actions">
          <button type="button" class="btn btn--sm" @click="bridge.useFoundVault(entry.tabId)">
            {{ $t('cloudNotes.watchNotes.external.useThisVault') }}
          </button>
          <button type="button" class="btn btn--ghost btn--sm" @click="offerDismissed.add(entry.tabId)">
            {{ $t('cloudNotes.watchNotes.external.notNow') }}
          </button>
        </div>
      </div>

      <p v-if="entry.lastError" class="en-error" role="status">{{ errorText }}</p>
    </div>

    <div class="en-queue-head">{{ $t('cloudNotes.watchNotes.external.queueTitle') }}</div>
    <div ref="queueEl" class="en-queue custom-scrollbar">
      <ul v-if="entry.items.length > 0" class="en-list">
        <li v-for="item in entry.items" :key="item.id" class="en-row" :class="`is-${item.status}`">
          <div class="en-thumb">
            <img v-if="item.thumb" :src="item.thumb" alt="" />
          </div>
          <div class="en-row-text">
            <span class="en-row-name">{{ $t('cloudNotes.watchNotes.external.slideN', { n: item.index }) }}</span>
            <span class="en-row-time">{{ timeOf(item.queuedAt) }}</span>
          </div>
          <span class="en-chip" :class="`en-chip--${item.status}`">
            <svg v-if="item.status === 'appended'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ statusLabel(item.status) }}
          </span>
        </li>
      </ul>
      <p v-else class="en-empty">{{ $t('cloudNotes.watchNotes.external.queueEmpty') }}</p>
    </div>

    <div class="en-footer">
      <div class="en-counts">
        <span>{{ $t('cloudNotes.watchNotes.external.appendedCount', { n: appendedCount }) }}</span>
        <span class="en-dot" aria-hidden="true">·</span>
        <span>{{ $t('cloudNotes.watchNotes.external.queuedCount', { n: queuedCount }) }}</span>
        <template v-if="footerState">
          <span class="en-dot" aria-hidden="true">·</span>
          <span class="en-state">{{ footerState }}</span>
        </template>
      </div>
      <button
        type="button"
        class="btn btn--sm en-pause"
        @click="watchNotesStore.setObsidianPaused(entry.tabId, !entry.paused)"
      >
        <!-- Same icons and sizes as the Task tab's Start / Pause. -->
        <svg v-if="entry.paused" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        {{ entry.paused ? $t('cloudNotes.watchNotes.external.resume') : $t('cloudNotes.watchNotes.external.pause') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Right-panel Notes view for file-based providers (Obsidian). There is no
// editor: the note lives in the user's own app, so this shows where slides go,
// the queue of kept slides (queued → appended), and a pause control. Kept at
// the panel's normal width (App.vue widens only for the Yanhekt editor).
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore } from '@shared/services/configStore'
import { watchNotesStore } from '@features/cloudNotes/watchNotesStore'
import type { ObsidianQueueStatus, ObsidianWatchNoteEntry } from '@features/cloudNotes/watchNotesTypes'

const props = defineProps<{ entry: ObsidianWatchNoteEntry }>()

const { t, locale } = useI18n()
const bridge = window.electronAPI.obsidianNotes
const isMac = navigator.userAgent.includes('Mac')
const busy = ref(false)
// Tabs whose "use this vault" offer was waved away (this session only).
const offerDismissed = reactive(new Set<string>())

const hasVault = computed(() => !!configStore.obsidianVaultPath)

const showVaultOffer = computed(
  () => !!props.entry.target?.vaultPath && !hasVault.value && !offerDismissed.has(props.entry.tabId),
)

/** "Test 1/Test 1 Course.md" → "Test 1 Course". */
const noteName = computed(() => {
  const path = props.entry.target?.displayPath ?? ''
  return path.split('/').pop()?.replace(/\.md$/i, '') || path
})

/** Folder inside the vault plus the vault, or "not in a vault". */
const noteWhere = computed(() => {
  const target = props.entry.target
  if (!target) return ''
  const parts = target.displayPath.split('/')
  const folder = parts.slice(0, -1).join('/')
  if (!target.vaultName) return t('cloudNotes.watchNotes.external.noVault')
  return folder
    ? t('cloudNotes.watchNotes.external.inVaultFolder', { name: target.vaultName, folder })
    : t('cloudNotes.watchNotes.external.inVault', { name: target.vaultName })
})

// Capture order, top to bottom — the order the slides go into the note. Follow
// new slides to the bottom unless the student has scrolled up to look back.
const queueEl = ref<HTMLElement | null>(null)
watch(
  () => props.entry.items.length,
  async () => {
    const el = queueEl.value
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    await nextTick()
    if (atBottom) el.scrollTop = el.scrollHeight
  },
)
const appendedCount = computed(() => props.entry.items.filter((i) => i.status === 'appended').length)
const queuedCount = computed(() => props.entry.items.length - appendedCount.value)

const footerState = computed(() => {
  if (props.entry.paused) return t('cloudNotes.watchNotes.external.paused')
  if (!props.entry.target && queuedCount.value > 0) return t('cloudNotes.watchNotes.external.waitingForNote')
  return ''
})

function statusLabel(status: ObsidianQueueStatus): string {
  switch (status) {
    case 'appended': return t('cloudNotes.watchNotes.external.statusAppended')
    case 'appending': return t('cloudNotes.watchNotes.external.statusAppending')
    default: return t('cloudNotes.watchNotes.external.statusQueued')
  }
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const errorText = computed(() => {
  switch (props.entry.lastError) {
    case 'no_vault': return t('cloudNotes.watchNotes.external.errors.noVault')
    case 'not_a_vault': return t('cloudNotes.watchNotes.external.errors.notAVault')
    case 'bad_subfolder': return t('cloudNotes.watchNotes.external.errors.badSubfolder')
    default: return t('cloudNotes.watchNotes.external.errors.write')
  }
})

async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } finally {
    busy.value = false
  }
}

function chooseNote(): Promise<void> {
  return run(() => watchNotesStore.chooseObsidianNote(props.entry.tabId))
}
</script>

<style scoped>
.external-note-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--bg-surface);
}

.en-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.en-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.en-provider {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--bg-selected);
  color: var(--text-secondary);
  font-size: 11px;
}

.en-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  flex-shrink: 0;
}

.en-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-elevated);
}

.en-lead {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.en-hint,
.en-muted {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
}

.en-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.en-actions--fill > .btn {
  flex: 1 1 0;
  justify-content: center;
  white-space: nowrap;
}

.en-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.en-note-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--text-secondary);
}

.en-note-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.en-note-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.en-note-where {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.en-change {
  flex-shrink: 0;
  margin: -3px -4px 0 0;
}

.en-offer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background-color: var(--bg-subtle);
}

.en-offer-text {
  display: flex;
  flex-direction: column;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
}

.en-offer-found {
  overflow-wrap: anywhere;
}

.en-offer-actions {
  display: flex;
  gap: 6px;
}

.en-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--danger);
}

.en-queue-head {
  padding: 4px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.en-queue {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--border-color);
}

.en-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.en-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.en-thumb {
  flex-shrink: 0;
  width: 72px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-subtle);
}

.en-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.en-row.is-queued .en-thumb,
.en-row.is-appending .en-thumb {
  opacity: 0.6;
}

.en-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.en-row-name {
  font-size: 12px;
  color: var(--text-primary);
}

.en-row-time {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.en-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  background-color: var(--bg-selected);
  color: var(--text-secondary);
}

.en-chip--appended {
  color: var(--success);
  background-color: var(--success-bg);
}

.en-empty {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.en-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.en-counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.en-dot {
  color: var(--text-muted);
}

.en-state {
  color: var(--warning);
}

.en-pause {
  flex-shrink: 0;
}
</style>
