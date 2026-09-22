<template>
  <div class="external-note-panel custom-scrollbar">
    <div class="en-header">
      <span class="en-title" :title="entry.displayName">{{ entry.displayName }}</span>
      <span class="en-provider">{{ $t('advanced.addons.providerObsidian') }}</span>
    </div>

    <div class="en-body">
      <div v-if="entry.status === 'creating'" class="en-muted">
        {{ $t('cloudNotes.watchNotes.creating') }}
      </div>

      <!-- No note yet: the student decides where this lecture's slides go. -->
      <template v-else-if="!entry.target">
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
          <button type="button" class="btn btn--sm" :disabled="busy" @click="run(() => watchNotesStore.chooseObsidianNote(entry.tabId))">
            {{ $t('cloudNotes.watchNotes.external.chooseNote') }}
          </button>
        </div>
        <p v-if="!hasVault" class="en-muted en-small">{{ $t('cloudNotes.watchNotes.external.noVaultHint') }}</p>
        <p v-if="entry.waiting > 0" class="en-count">
          {{ $t('cloudNotes.watchNotes.external.waiting', { n: entry.waiting }) }}
        </p>
      </template>

      <!-- Has a note: where it is, what went in, and ways to open it. -->
      <template v-else>
        <div class="en-field">
          <span class="en-label">{{ $t('cloudNotes.watchNotes.external.note') }}</span>
          <span class="en-path" :title="entry.target.notePath">{{ entry.target.displayPath }}</span>
          <span class="en-muted en-small">
            {{
              entry.target.vaultName
                ? $t('cloudNotes.watchNotes.external.inVault', { name: entry.target.vaultName })
                : $t('cloudNotes.watchNotes.external.noVault')
            }}
          </span>
        </div>

        <p class="en-count">
          {{ $t('cloudNotes.watchNotes.external.added', { n: entry.appended }) }}
        </p>

        <div class="en-actions">
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
          <button type="button" class="btn btn--sm" :disabled="busy" @click="run(() => watchNotesStore.chooseObsidianNote(entry.tabId))">
            {{ $t('cloudNotes.watchNotes.external.chooseNote') }}
          </button>
        </div>

        <!-- A vault was found above the chosen note and none is configured yet. -->
        <div v-if="entry.target.vaultPath && !hasVault" class="en-offer">
          <p>{{ $t('cloudNotes.watchNotes.external.foundVault', { name: entry.target.vaultName }) }}</p>
          <button type="button" class="btn btn--sm" @click="bridge.useFoundVault(entry.tabId)">
            {{ $t('cloudNotes.watchNotes.external.useThisVault') }}
          </button>
        </div>
      </template>

      <p v-if="entry.lastError" class="en-error" role="status">{{ errorText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Right-panel Notes view for file-based providers (Obsidian). There is no
// editor: the note lives in the user's own app, so this shows where slides go
// and how to open it. Kept at the panel's normal width (App.vue widens only for
// the Yanhekt editor).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore } from '@shared/services/configStore'
import { watchNotesStore } from '@features/cloudNotes/watchNotesStore'
import type { ObsidianWatchNoteEntry } from '@features/cloudNotes/watchNotesTypes'

const props = defineProps<{ entry: ObsidianWatchNoteEntry }>()

const { t } = useI18n()
const bridge = window.electronAPI.obsidianNotes
const isMac = navigator.userAgent.includes('Mac')
const busy = ref(false)

const hasVault = computed(() => !!configStore.obsidianVaultPath)

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
</script>

<style scoped>
.external-note-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
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

.en-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px;
}

.en-lead {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.en-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.en-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.en-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.en-path {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  word-break: break-all;
}

.en-count {
  margin: 0;
  font-size: 12px;
  color: var(--text-primary);
}

.en-muted {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.en-small {
  margin: 0;
  font-size: 11px;
}

.en-offer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.en-offer p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
}

.en-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--danger);
}
</style>
