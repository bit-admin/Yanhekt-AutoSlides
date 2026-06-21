<template>
  <div class="cloud-notes-tab">
    <!-- Not signed in -->
    <div v-if="cn.notSignedIn.value" class="cn-signin">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <p>{{ $t('cloudNotes.notSignedIn') }}</p>
    </div>

    <template v-else>
      <!-- Left: groups -->
      <aside class="cn-groups custom-scrollbar">
        <div class="cn-groups-header">{{ $t('cloudNotes.groups') }}</div>
        <button
          class="cn-group-item"
          :class="{ active: cn.activeGroupId.value === '' }"
          @click="cn.setGroup('')"
        >
          {{ $t('cloudNotes.allNotes') }}
        </button>
        <div
          v-for="g in cn.groups.value"
          :key="g.id"
          class="cn-group-item-row"
        >
          <button
            class="cn-group-item"
            :class="{ active: cn.activeGroupId.value === g.id }"
            @click="cn.setGroup(g.id)"
          >
            {{ g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup')) }}
          </button>
          <button
            v-if="g.id !== 0"
            class="cn-icon-btn"
            :title="$t('cloudNotes.deleteGroup')"
            @click.stop="onDeleteGroup(g.id, g.name)"
          >
            <svg width="13" height="13" viewBox="0 0 16 16"><path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2z" fill="currentColor"/></svg>
          </button>
        </div>

        <div class="cn-newgroup">
          <input
            v-model="newGroupName"
            class="text-input"
            :maxlength="NOTE_GROUP_NAME_MAX"
            :placeholder="$t('cloudNotes.newGroupPlaceholder', { max: NOTE_GROUP_NAME_MAX })"
            @keyup.enter="onCreateGroup"
          />
          <button class="btn btn--primary" :disabled="!newGroupName.trim()" @click="onCreateGroup">
            {{ $t('cloudNotes.add') }}
          </button>
        </div>
      </aside>

      <!-- Middle: note list -->
      <section class="cn-list">
        <div class="cn-list-toolbar">
          <input
            v-model="cn.keyword.value"
            class="text-input cn-search"
            :placeholder="$t('cloudNotes.searchPlaceholder')"
          />
          <button class="btn btn--primary" @click="onCreateNote">{{ $t('cloudNotes.newNote') }}</button>
        </div>

        <div class="cn-list-items custom-scrollbar">
          <div v-if="cn.loading.value" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
          <div v-else-if="cn.notes.value.length === 0" class="cn-empty">{{ $t('cloudNotes.noNotes') }}</div>
          <button
            v-for="note in cn.notes.value"
            :key="note.id"
            class="cn-note-item"
            :class="{ active: cn.selectedNoteId.value === note.id }"
            @click="openNote(note.id)"
          >
            <span class="cn-note-title">{{ note.title || $t('cloudNotes.untitled') }}</span>
            <span class="cn-note-meta">{{ note.updated_at }}</span>
          </button>
        </div>

        <div v-if="cn.totalPages.value > 1" class="cn-pager">
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value <= 1" @click="cn.goToPage(cn.page.value - 1)">‹</button>
          <span>{{ cn.page.value }} / {{ cn.totalPages.value }}</span>
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value >= cn.totalPages.value" @click="cn.goToPage(cn.page.value + 1)">›</button>
        </div>
      </section>

      <!-- Right: editor -->
      <section class="cn-editor">
        <div v-if="!cn.selectedNote.value" class="cn-empty cn-editor-empty">{{ $t('cloudNotes.selectNote') }}</div>
        <template v-else>
          <div class="cn-editor-header">
            <input
              v-model="editableTitle"
              class="text-input cn-title-input"
              :placeholder="$t('cloudNotes.untitled')"
              @blur="onSaveTitle"
              @keyup.enter="onSaveTitle"
            />
            <select class="text-input cn-group-select" :value="String(cn.selectedNote.value.note_group_id ?? 0)" @change="onMoveGroup">
              <option value="0">{{ $t('cloudNotes.defaultGroup') }}</option>
              <option v-for="g in cn.groups.value.filter(x => x.id !== 0)" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
            </select>
            <span class="cn-save-status" :class="{ 'is-active': saveStatus !== 'idle' }">
              <template v-if="saveStatus === 'saving'">{{ $t('cloudNotes.saving') }}</template>
              <template v-else-if="saveStatus === 'saved'">{{ $t('cloudNotes.saved') }}</template>
            </span>
            <button class="btn btn--danger-outline" @click="onDeleteNote">{{ $t('cloudNotes.delete') }}</button>
          </div>
          <div class="cn-editor-holder custom-scrollbar">
            <div ref="editorHolder" class="cn-editor-doc"></div>
          </div>
        </template>
      </section>
    </template>

    <div v-if="cn.error.value" class="cn-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorJS from '@editorjs/editorjs'
import type { OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import ImageTool from '@editorjs/image'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { NOTE_GROUP_NAME_MAX } from '@common/notesTypes'

const { t } = useI18n()
const cn = useCloudNotes()

const newGroupName = ref('')
const editableTitle = ref('')
const editorHolder = ref<HTMLElement | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let editor: EditorJS | null = null
/** True once the editor has loaded a note and is ready to accept user edits. */
let editorReady = false
/**
 * Serialized *blocks* of the currently-loaded content, used to detect genuine
 * edits. We compare blocks only — never the whole OutputData — because
 * editor.save() stamps a fresh `time` on every call, which would otherwise make
 * every save look like a change. The initial-render onChange also diffs equal.
 */
let lastSavedBlocks = ''
let saveTimer: ReturnType<typeof setTimeout> | undefined
let savedFlashTimer: ReturnType<typeof setTimeout> | undefined

function parseContent(raw: string): OutputData | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.blocks)) return parsed as OutputData
  } catch {
    // Malformed content — start blank rather than crash the editor.
  }
  return undefined
}

/** Persist the current editor content for the given note id, if it changed. */
async function flushSave(noteId: number): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (!editor || !editorReady) return
  const data = await editor.save()
  const blocks = JSON.stringify(data.blocks)
  // No genuine change vs. what's loaded/last-saved → don't hit the network.
  if (blocks === lastSavedBlocks) return
  saveStatus.value = 'saving'
  const ok = await cn.saveContent(noteId, JSON.stringify(data))
  if (ok) lastSavedBlocks = blocks
  // Don't clobber the status if the user already switched to another note.
  if (cn.selectedNoteId.value !== noteId) return
  saveStatus.value = ok ? 'saved' : 'idle'
  if (ok) {
    if (savedFlashTimer) clearTimeout(savedFlashTimer)
    savedFlashTimer = setTimeout(() => {
      if (saveStatus.value === 'saved') saveStatus.value = 'idle'
    }, 1500)
  }
}

/** Debounced auto-save triggered by Editor.js onChange. */
function scheduleSave(): void {
  if (!editorReady) return
  const noteId = cn.selectedNoteId.value
  if (noteId == null) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { flushSave(noteId) }, 1000)
}

async function destroyEditor(): Promise<void> {
  editorReady = false
  lastSavedBlocks = ''
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (editor) {
    try {
      await editor.isReady
      editor.destroy()
    } catch {
      // ignore teardown races
    }
    editor = null
  }
}

async function mountEditor(content: string): Promise<void> {
  await destroyEditor()
  if (!editorHolder.value) return
  saveStatus.value = 'idle'
  const instance = new EditorJS({
    holder: editorHolder.value,
    data: parseContent(content),
    placeholder: t('cloudNotes.editorPlaceholder'),
    onChange: scheduleSave,
    tools: {
      header: Header,
      list: List,
      image: {
        class: ImageTool,
        config: {
          uploader: {
            uploadByFile: async (file: File) => {
              const buf = await file.arrayBuffer()
              const res = await window.electronAPI.cloudNotes.uploadImage(buf, file.name, file.type)
              if (res.ok) return { success: 1, file: { url: res.data.url } }
              cn.error.value = res.error === 'not-signed-in' ? t('cloudNotes.notSignedIn') : res.error
              return { success: 0 }
            },
          },
        },
      },
    },
  })
  editor = instance
  await instance.isReady
  if (editor !== instance) return
  // Capture the editor's own block serialization of the just-loaded content as
  // the baseline, so the initial render's onChange (and block normalization)
  // don't count as an edit. Only block diffs against this trigger a real save.
  try {
    lastSavedBlocks = JSON.stringify((await instance.save()).blocks)
  } catch {
    lastSavedBlocks = ''
  }
  editorReady = true
}

async function openNote(id: number): Promise<void> {
  // Persist any pending edits to the note we're leaving before switching.
  const prevId = cn.selectedNoteId.value
  if (prevId != null && prevId !== id) await flushSave(prevId)
  const detail = await cn.openNote(id)
  if (detail) {
    editableTitle.value = detail.title
    await mountEditor(detail.content)
  }
}

async function onCreateNote(): Promise<void> {
  const id = await cn.createNote()
  if (id != null) await openNote(id)
}

async function onSaveTitle(): Promise<void> {
  const note = cn.selectedNote.value
  if (!note) return
  const next = editableTitle.value.trim()
  if (next === note.title) return
  await cn.renameNote(note.id, next)
}

async function onMoveGroup(e: Event): Promise<void> {
  const note = cn.selectedNote.value
  if (!note) return
  const groupId = Number((e.target as HTMLSelectElement).value)
  await cn.moveNoteToGroup(note.id, groupId)
  note.note_group_id = groupId
}

async function onDeleteNote(): Promise<void> {
  const note = cn.selectedNote.value
  if (!note) return
  if (!confirm(t('cloudNotes.confirmDeleteNote'))) return
  await destroyEditor()
  await cn.deleteNote(note.id)
}

async function onCreateGroup(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) return
  const ok = await cn.createGroup(name)
  if (ok) newGroupName.value = ''
}

async function onDeleteGroup(id: number, name: string): Promise<void> {
  if (!confirm(t('cloudNotes.confirmDeleteGroup', { name }))) return
  await cn.deleteGroup(id)
}

onMounted(() => {
  cn.init()
})

onUnmounted(() => {
  if (savedFlashTimer) clearTimeout(savedFlashTimer)
  destroyEditor()
})

// Live search — filter the list as the user types (client-side, instant).
watch(() => cn.keyword.value, () => cn.searchNotes(true))

// If the selected note is cleared externally, tear the editor down.
watch(() => cn.selectedNoteId.value, (id) => {
  if (id == null) destroyEditor()
})
</script>

<style scoped>
.cloud-notes-tab {
  position: relative;
  height: 100%;
  display: flex;
  overflow: hidden;
  background-color: var(--bg-surface);
}

/* Left: groups */
.cn-groups {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.cn-groups-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 4px 6px;
}

.cn-group-item-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.cn-group-item {
  flex: 0 0 auto;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 6px;
  padding: 7px 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Inside a row, the group button shares space with its delete icon. */
.cn-group-item-row .cn-group-item {
  flex: 1;
  width: auto;
  min-width: 0;
}

.cn-group-item:hover {
  background-color: var(--bg-hover);
}

.cn-group-item.active {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.cn-icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
}

.cn-icon-btn:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.cn-newgroup {
  margin-top: auto;
  display: flex;
  gap: 4px;
  padding-top: 8px;
}

.cn-newgroup .text-input {
  width: 0;
  flex: 1;
  min-width: 0;
}

/* Middle: note list */
.cn-list {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.cn-list-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
}

.cn-search {
  flex: 1;
  min-width: 0;
}

.cn-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.cn-note-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 6px;
  padding: 9px 10px;
  cursor: pointer;
}

.cn-note-item:hover {
  background-color: var(--bg-hover);
}

.cn-note-item.active {
  background-color: var(--bg-subtle);
  box-shadow: inset 2px 0 0 var(--accent);
}

.cn-note-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cn-note-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.cn-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

/* Right: editor */
.cn-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cn-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.cn-title-input {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.cn-group-select {
  width: 120px;
  flex-shrink: 0;
}

.cn-save-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cn-save-status.is-active {
  opacity: 1;
}

.cn-editor-holder {
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px 96px;
  color: var(--text-primary);
}

.cn-editor-doc {
  max-width: 760px;
  margin: 0 auto;
  /* Left gutter houses Editor.js's block toolbar (＋ / drag handle), which sits
     at right:100% of the content column. Without this the toolbar overshoots
     into the panel divider. */
  padding: 0 16px 0 56px;
  box-sizing: border-box;
}

.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.cn-editor-empty {
  margin: auto;
}

/* Sign-in prompt */
.cn-signin {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
}

.cn-error {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  max-width: 70%;
  cursor: pointer;
  z-index: var(--z-dropdown);
}

/* ── Editor.js theming (maps its hardcoded light chrome to design tokens so
      light + dark both look right) ───────────────────────────────────────── */

/* Left-align content (don't use Editor.js's own 650px centering); the doc's
   left padding provides the toolbar gutter instead, so it never overshoots. */
.cn-editor-doc :deep(.ce-block__content),
.cn-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.cn-editor-doc :deep(.ce-paragraph),
.cn-editor-doc :deep(.ce-header),
.cn-editor-doc :deep(.cdx-block) {
  color: var(--text-primary);
}

.cn-editor-doc :deep(a) {
  color: var(--link-color);
}

/* Placeholders */
.cn-editor-doc :deep([data-placeholder]:empty::before),
.cn-editor-doc :deep(.cdx-block[data-placeholder]:empty::before) {
  color: var(--text-muted);
}

/* Left-gutter controls: + button and drag/settings handle */
.cn-editor-doc :deep(.ce-toolbar__plus),
.cn-editor-doc :deep(.ce-toolbar__settings-btn) {
  color: var(--text-secondary);
}

.cn-editor-doc :deep(.ce-toolbar__plus:hover),
.cn-editor-doc :deep(.ce-toolbar__settings-btn:hover) {
  background-color: var(--bg-hover);
}

/* Floating surfaces: toolbox popover, inline toolbar, conversion toolbar,
   block-settings popover */
.cn-editor-doc :deep(.ce-popover),
.cn-editor-doc :deep(.ce-inline-toolbar),
.cn-editor-doc :deep(.ce-conversion-toolbar),
.cn-editor-doc :deep(.ce-settings) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.cn-editor-doc :deep(.ce-popover__item:hover),
.cn-editor-doc :deep(.ce-inline-tool:hover),
.cn-editor-doc :deep(.ce-inline-toolbar__dropdown:hover),
.cn-editor-doc :deep(.ce-conversion-tool:hover) {
  background-color: var(--bg-hover);
}

.cn-editor-doc :deep(.ce-popover__item-icon),
.cn-editor-doc :deep(.ce-conversion-tool__icon) {
  background-color: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
}

/* Inputs inside Editor.js (e.g. image caption) */
.cn-editor-doc :deep(.cdx-input) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}
</style>
