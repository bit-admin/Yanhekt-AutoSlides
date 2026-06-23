<template>
  <div class="cloud-notes-tab">
    <!-- Public-images notice banner -->
    <div v-if="bannerVisible" class="cn-banner">
      <span class="cn-banner-msg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span>{{ $t('cloudNotes.bannerNotice') }}
          <a class="cn-banner-a" :href="WHY_URL" @click.prevent="openExt(WHY_URL)">{{ $t('cloudNotes.bannerWhy') }} ↗</a>
        </span>
      </span>
      <span class="cn-banner-actions">
        <a class="cn-banner-link" :href="MYNOTES_URL" @click.prevent="openExt(MYNOTES_URL)">{{ $t('cloudNotes.bannerMyNotes') }} ↗</a>
        <button class="cn-banner-close" :title="$t('cloudNotes.bannerDismiss')" :aria-label="$t('cloudNotes.bannerDismiss')" @click="bannerVisible = false">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </span>
    </div>

    <div class="cn-body">
    <!-- Not signed in -->
    <div v-if="cn.notSignedIn.value" class="cn-signin">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <p>{{ $t('cloudNotes.notSignedIn') }}</p>
    </div>

    <template v-else>
      <!-- Left: groups -->
      <aside class="cn-groups">
        <div class="cn-groups-scroll custom-scrollbar">
          <button
            class="cn-group-item"
            :class="{ active: cn.activeGroupId.value === '' }"
            @click="cn.setGroup('')"
          >
            <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {{ $t('cloudNotes.allNotes') }}
          </button>

          <!-- Section: AutoSlides-managed groups — distinct tinted card -->
          <div class="cn-managed-section">
            <div class="cn-managed-header">{{ $t('cloudNotes.managedSection') }}</div>
            <div
              v-for="g in cn.managedGroups.value"
              :key="g.id"
              class="cn-group-item-row"
            >
              <button
                class="cn-group-item cn-group-item--managed"
                :class="{ active: cn.activeGroupId.value === g.id }"
                @click="cn.setGroup(g.id)"
              >
                <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                </svg>
                {{ g.name }}
              </button>
              <button
                class="cn-icon-btn cn-group-delete"
                :title="$t('cloudNotes.deleteGroup')"
                @click.stop="onDeleteGroup(g.id, g.name)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
              </button>
            </div>
            <button
              v-if="!cn.hasManagedStorage.value"
              class="cn-init-btn"
              :disabled="cn.initializing.value"
              :title="$t('cloudNotes.initStorageTip')"
              @click="onInitStorage"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M12 12v4M10 14h4"/>
              </svg>
              {{ cn.initializing.value ? $t('cloudNotes.initializing') : $t('cloudNotes.initStorage') }}
            </button>
          </div>

          <!-- Section: other groups (Ungrouped + user-created) -->
          <div class="cn-groups-header">{{ $t('cloudNotes.otherGroupsSection') }}</div>
          <div
            v-for="g in cn.otherGroups.value"
            :key="g.id"
            class="cn-group-item-row"
          >
            <button
              class="cn-group-item"
              :class="{ active: cn.activeGroupId.value === g.id }"
              @click="cn.setGroup(g.id)"
            >
              <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {{ g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup')) }}
            </button>
            <button
              v-if="g.id !== 0"
              class="cn-icon-btn cn-group-delete"
              :title="$t('cloudNotes.deleteGroup')"
              @click.stop="onDeleteGroup(g.id, g.name)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <div class="cn-groups-footer">
          <button class="cn-newgroup-btn" @click="showNewGroupModal = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ $t('cloudNotes.newGroupTitle') }}
          </button>
        </div>
      </aside>

      <!-- New Group modal (matches HomePage "Add Saved Search" modal) -->
      <div v-if="showNewGroupModal" class="modal-overlay" @click.self="showNewGroupModal = false">
        <div class="cn-modal-box">
          <h3 class="cn-modal-title">{{ $t('cloudNotes.newGroupTitle') }}</h3>
          <input
            ref="newGroupInput"
            v-model="newGroupName"
            class="cn-modal-input"
            :maxlength="NOTE_GROUP_NAME_MAX"
            :placeholder="$t('cloudNotes.newGroupPlaceholder', { max: NOTE_GROUP_NAME_MAX })"
            @keyup.enter="onCreateGroup"
            @keyup.esc="showNewGroupModal = false"
          />
          <p class="cn-modal-help">{{ $t('cloudNotes.newGroupHelp', { max: NOTE_GROUP_NAME_MAX }) }}</p>
          <div class="cn-modal-actions">
            <button class="btn cn-modal-btn" @click="showNewGroupModal = false">{{ $t('cloudNotes.cancel') }}</button>
            <button class="btn btn--primary cn-modal-btn" :disabled="!newGroupName.trim()" @click="onCreateGroup">
              {{ $t('cloudNotes.add') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Middle: note list -->
      <section class="cn-list">
        <div class="cn-list-toolbar">
          <div class="cn-search-wrap">
            <svg class="cn-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              v-model="cn.keyword.value"
              class="cn-search"
              :placeholder="$t('cloudNotes.searchPlaceholder')"
            />
          </div>
          <button class="cn-newnote-btn" :title="$t('cloudNotes.newNote')" @click="onCreateNote">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
            </svg>
          </button>
        </div>

        <div class="cn-list-items custom-scrollbar">
          <div v-if="cn.loading.value" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
          <div v-else-if="cn.notes.value.length === 0" class="cn-empty">{{ $t('cloudNotes.noNotes') }}</div>
          <div
            v-for="note in cn.notes.value"
            :key="note.id"
            class="cn-note-item-row"
          >
            <button
              class="cn-note-item"
              :class="{ active: cn.selectedNoteId.value === note.id }"
              @click="openNote(note.id)"
            >
              <span class="cn-note-title">{{ note.title || $t('cloudNotes.untitled') }}</span>
              <span class="cn-note-meta">{{ note.updated_at }}</span>
            </button>
            <button
              class="cn-icon-btn cn-note-delete"
              :title="$t('cloudNotes.delete')"
              @click.stop="onDeleteNote(note.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <div v-if="cn.totalPages.value > 1" class="cn-pager">
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value <= 1" @click="cn.goToPage(cn.page.value - 1)">‹</button>
          <span>{{ cn.page.value }} / {{ cn.totalPages.value }}</span>
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value >= cn.totalPages.value" @click="cn.goToPage(cn.page.value + 1)">›</button>
        </div>

        <div v-if="cn.hasManagedStorage.value" class="cn-list-footer">
          <button class="cn-import-btn" :title="$t('cloudNotes.importTip')" @click="openImportModal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
            </svg>
            <span v-if="imp.importing.value">{{ $t('cloudNotes.importProgress', { done: imp.overall.value.done, total: imp.overall.value.total }) }}</span>
            <span v-else>{{ $t('cloudNotes.importButton') }}</span>
          </button>
        </div>
      </section>

      <!-- Import slides to notes modal -->
      <div v-if="showImportModal" class="modal-overlay" @click.self="closeImportModal">
        <div class="cn-import-box">
          <h3 class="cn-modal-title">{{ $t('cloudNotes.importTitle') }}</h3>

          <!-- Phase: select folders -->
          <template v-if="importPhase === 'select'">
            <div class="cn-import-list custom-scrollbar">
              <div v-if="loadingFolders" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
              <div v-else-if="importFolders.length === 0" class="cn-empty">{{ $t('cloudNotes.importNoFolders') }}</div>
              <button
                v-for="f in importFolders"
                :key="f.name"
                class="cn-import-folder"
                :class="{ selected: importSelected.includes(f.name) }"
                @click="toggleImportFolder(f.name)"
              >
                <input type="checkbox" class="cn-import-check" :checked="importSelected.includes(f.name)" tabindex="-1" />
                <svg class="cn-import-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="cn-import-folder-name">{{ fmtFolder(f.name) }}</span>
                <span class="cn-import-folder-count">{{ $t('cloudNotes.importImagesCount', { n: f.imageCount }) }}</span>
              </button>
            </div>
            <div class="cn-modal-actions">
              <button class="btn cn-modal-btn" @click="closeImportModal">{{ $t('cloudNotes.cancel') }}</button>
              <button class="btn btn--primary cn-modal-btn" :disabled="importSelected.length === 0" @click="onStartImport">
                {{ $t('cloudNotes.importStart', { n: importSelected.length }) }}
              </button>
            </div>
          </template>

          <!-- Phase: progress -->
          <template v-else>
            <div class="cn-import-overall">{{ $t('cloudNotes.importOverall', { done: imp.overall.value.done, total: imp.overall.value.total }) }}</div>
            <div class="cn-import-list custom-scrollbar">
              <div v-for="item in imp.queue.value" :key="item.folderName" class="cn-imp-row">
                <div class="cn-imp-row-top">
                  <span class="cn-imp-name" :title="item.displayName">{{ item.displayName }}</span>
                  <span class="cn-imp-status" :class="`s-${item.status}`">{{ importStatusText(item) }}</span>
                </div>
                <div class="cn-imp-bar">
                  <div class="cn-imp-fill" :class="`s-${item.status}`" :style="{ width: importBarWidth(item) + '%' }"></div>
                </div>
                <div v-if="item.status === 'conflict'" class="cn-imp-actions">
                  <button class="btn btn--sm btn--ghost" :disabled="imp.importing.value" @click="onOpenConflictNote(item.conflictNoteIds?.[0])">{{ $t('cloudNotes.importOpenNote') }}</button>
                  <button class="btn btn--sm" :disabled="imp.importing.value" @click="imp.resolveConflict(item, 'create')">{{ $t('cloudNotes.importCreateAnyway') }}</button>
                  <button class="btn btn--sm cn-imp-replace" :disabled="imp.importing.value" @click="imp.resolveConflict(item, 'replace')">{{ $t('cloudNotes.importReplace') }}</button>
                  <button class="btn btn--sm btn--ghost" :disabled="imp.importing.value" @click="imp.skipConflict(item)">{{ $t('cloudNotes.importSkip') }}</button>
                </div>
              </div>
            </div>
            <p v-if="imp.queue.value.some(i => i.status === 'conflict')" class="cn-import-hint">{{ $t('cloudNotes.importConflictHint') }}</p>
            <div class="cn-modal-actions">
              <template v-if="imp.importing.value">
                <button class="btn cn-modal-btn" @click="imp.cancel()">{{ $t('cloudNotes.importCancel') }}</button>
                <button class="btn btn--primary cn-modal-btn" @click="closeImportModal">{{ $t('cloudNotes.importClose') }}</button>
              </template>
              <button v-else class="btn btn--primary cn-modal-btn" @click="doneImport">{{ $t('cloudNotes.importDone') }}</button>
            </div>
          </template>
        </div>
      </div>

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
            <span class="cn-save-status" :class="saveStatus">
              <template v-if="saveStatus === 'saving'">{{ $t('cloudNotes.saving') }}</template>
              <template v-else-if="saveStatus === 'saved'">{{ $t('cloudNotes.saved') }}</template>
              <template v-else>{{ $t('cloudNotes.idle') }}</template>
            </span>
          </div>
          <div class="cn-editor-holder custom-scrollbar">
            <div ref="editorHolder" class="cn-editor-doc"></div>
          </div>
        </template>
      </section>
    </template>
    </div>

    <div v-if="cn.error.value" class="cn-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorJS from '@editorjs/editorjs'
import type { OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import ImageTool from '@editorjs/image'
import Delimiter from '@editorjs/delimiter'
import Quote from '@editorjs/quote'
import CodeTool from '@editorjs/code'
import Table from '@editorjs/table'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { useNoteImport, type ImportItem } from '@features/cloudNotes/useNoteImport'
import { formatToolFolderName } from '@shared/utils/toolWindowFolders'
import { NOTE_GROUP_NAME_MAX, EDITORJS_DOC_VERSION } from '@common/notesTypes'

const { t } = useI18n()
const cn = useCloudNotes()

// Short, English-only copyright notice embedded in every imported note (a
// condensed form of the PDF Maker cover copyright). Kept English regardless of
// UI language since the note travels with the user's Yanhekt account.
const NOTE_COPYRIGHT =
  'This file may contain copyrighted material, extracted from a recorded lecture solely for ' +
  'personal study and non-commercial educational use. All rights remain with their respective ' +
  'holders; redistribution or commercial use is prohibited. AutoSlides is an automated tool and ' +
  'claims no ownership of the content.'

const imp = useNoteImport(cn, {
  meta: (count, date) => t('cloudNotes.noteMeta', { count, date }),
  warning: NOTE_COPYRIGHT,
  slideCaption: (n) => t('cloudNotes.noteSlideCaption', { n }),
})

const MYNOTES_URL = 'https://www.yanhekt.cn/profile/myNotes'
const WHY_URL = 'https://github.com/bit-admin/yanhekt-coss-browser'
function openExt(url: string): void { window.electronAPI.shell.openExternal(url) }

// Dismissible per session — resets to visible when the Tools window reopens.
const bannerVisible = ref(true)

const newGroupName = ref('')
const showNewGroupModal = ref(false)
const newGroupInput = ref<HTMLInputElement | null>(null)
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
      quote: Quote,
      code: CodeTool,
      table: Table,
      delimiter: Delimiter,
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

async function onDeleteNote(noteId: number): Promise<void> {
  if (!confirm(t('cloudNotes.confirmDeleteNote'))) return
  if (cn.selectedNoteId.value === noteId) await destroyEditor()
  await cn.deleteNote(noteId)
}

/**
 * Build the README's Editor.js document (localized) as a JSON string. Includes a
 * fresh timestamp so re-saving it on each tab open bumps its modified time and
 * keeps it pinned to the top of the note list.
 */
function buildReadmeContent(): string {
  const stamp = t('cloudNotes.readmeUpdatedAt', { time: new Date().toLocaleString() })
  const blocks = [
    { type: 'header', data: { text: t('cloudNotes.readmeHeading'), level: 2 } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody1') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody2') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody3') } },
    { type: 'paragraph', data: { text: stamp } },
  ]
  return JSON.stringify({ time: Date.now(), blocks, version: EDITORJS_DOC_VERSION })
}

async function onInitStorage(): Promise<void> {
  await cn.initCloudStorage(buildReadmeContent())
}

// ── Import slides to notes ─────────────────────────────────────────────────
interface ImportFolder { name: string; path: string; imageCount: number }

const showImportModal = ref(false)
const importPhase = ref<'select' | 'progress'>('select')
const importFolders = ref<ImportFolder[]>([])
const importSelected = ref<string[]>([])
const loadingFolders = ref(false)

const fmtFolder = formatToolFolderName

async function loadImportFolders(): Promise<void> {
  loadingFolders.value = true
  try {
    importFolders.value = (await window.electronAPI.pdfmaker.getFolders()) as ImportFolder[]
    importSelected.value = []
  } finally {
    loadingFolders.value = false
  }
}

async function openImportModal(): Promise<void> {
  showImportModal.value = true
  // Reopen straight into progress if a run is active or its results are unread.
  if (imp.queue.value.length > 0) {
    importPhase.value = 'progress'
  } else {
    importPhase.value = 'select'
    await loadImportFolders()
  }
}

function closeImportModal(): void {
  // Only hide the modal — the queue (running or finished) stays alive so
  // reopening returns to the progress view. It is cleared only by "Done".
  showImportModal.value = false
}

function doneImport(): void {
  // Explicit dismissal of a finished queue: clear it and return to the picker.
  imp.reset()
  importSelected.value = []
  importPhase.value = 'select'
  showImportModal.value = false
}

function toggleImportFolder(name: string): void {
  const i = importSelected.value.indexOf(name)
  if (i === -1) importSelected.value.push(name)
  else importSelected.value.splice(i, 1)
}

function onStartImport(): void {
  if (importSelected.value.length === 0) return
  importPhase.value = 'progress'
  // Fire-and-forget: the queue runs in the background and survives modal close.
  void imp.startImport([...importSelected.value])
}

async function onOpenConflictNote(id?: number): Promise<void> {
  if (id == null) return
  closeImportModal()
  await openNote(id)
}

function importStatusText(item: ImportItem): string {
  switch (item.status) {
    case 'uploading': return t('cloudNotes.importUploading', { done: item.uploaded, total: item.total })
    case 'building': return t('cloudNotes.importBuilding')
    case 'done': return t('cloudNotes.importDone')
    case 'conflict': return t('cloudNotes.importConflict')
    case 'error': return item.error || t('cloudNotes.importError')
    default: return t('cloudNotes.importPending')
  }
}

function importBarWidth(item: ImportItem): number {
  if (item.status === 'done' || item.status === 'building') return 100
  if (item.status === 'uploading' && item.total > 0) return Math.round((item.uploaded / item.total) * 100)
  return 0
}

async function onCreateGroup(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) return
  const ok = await cn.createGroup(name)
  if (ok) {
    newGroupName.value = ''
    showNewGroupModal.value = false
  }
}

watch(showNewGroupModal, (open) => {
  if (open) {
    nextTick(() => newGroupInput.value?.focus())
  } else {
    newGroupName.value = ''
  }
})

async function onDeleteGroup(id: number, name: string): Promise<void> {
  if (!confirm(t('cloudNotes.confirmDeleteGroup', { name }))) return
  await cn.deleteGroup(id)
}

onMounted(async () => {
  await cn.init()
  // Recreate the README on every open so it stays at the top (the server sorts
  // by created time, so re-saving wouldn't move it). No-op if absent.
  await cn.recreateReadme(buildReadmeContent())
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
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-surface);
}

/* ── Public-notes banner ─────────────────────────────────────────────── */
.cn-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 7px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  background-color: var(--warning-bg);
  border-bottom: 1px solid var(--border-color);
}

.cn-banner-msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cn-banner-msg svg {
  color: var(--warning);
  flex-shrink: 0;
}

.cn-banner-a,
.cn-banner-link {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}

.cn-banner-a:hover,
.cn-banner-link:hover {
  text-decoration: underline;
}

.cn-banner-link {
  font-weight: 600;
  flex-shrink: 0;
}

.cn-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.cn-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.cn-banner-close:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

/* ── Three-pane body ─────────────────────────────────────────────────── */
.cn-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ── Left: groups sidebar (matches LeftPanel navigator design) ───────── */
.cn-groups {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cn-groups-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cn-groups-header {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--text-muted);
  margin-top: 2px;
  margin-bottom: 4px;
}

/* ── Managed Groups — flat like the rest, set off by separators above/below
      and an accent header (no card). ───────────────────────────────────────── */
.cn-managed-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Bleed to the sidebar edges (cancel the scroll's 10px padding) so the
     separators span full width, then re-pad so items stay aligned. */
  margin: 14px -10px;
  padding: 12px 10px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

/* Same shape as .cn-groups-header, tinted accent. */
.cn-managed-header {
  padding: 0 10px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--accent);
}

/* Accent the managed group's icon so the row reads as app-owned. */
.cn-group-item--managed .cn-group-icon {
  color: var(--accent);
  opacity: 1;
}

/* Standalone "All notes" button — full width, no flex-grow */
.cn-group-item {
  flex: 0 0 auto;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 9px;
  box-sizing: border-box;
  transition: all 0.15s;
}

/* Inside a row, the button fills remaining space next to the delete icon */
.cn-group-item-row {
  display: flex;
  align-items: center;
  position: relative;
}

.cn-group-item-row .cn-group-item {
  flex: 1 1 0%;
  width: auto;
  min-width: 0;
  /* Reserve room so text never sits under the delete button */
  padding-right: 28px;
}

.cn-group-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.cn-group-item:hover {
  background-color: var(--bg-hover);
}

/* Active = subtle tinted bg + accent text (matches LeftPanel .nav-item.active) */
.cn-group-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.cn-group-item.active .cn-group-icon {
  color: var(--accent);
}

/* Delete icon — hidden by default, visible on row hover (matches .pinned-unpin) */
.cn-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cn-icon-btn:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.cn-group-delete {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.cn-group-item-row:hover .cn-group-delete {
  opacity: 1;
  pointer-events: auto;
}

.cn-group-delete:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

/* New Group — pinned footer, set off from the list by a top separator.
   The button itself is inset so its rounded hover state aligns with the
   group items above instead of bleeding to the sidebar edges. */
.cn-groups-footer {
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
}

.cn-newgroup-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s, color 0.15s;
}

.cn-newgroup-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Init cloud storage — flat row matching the group items, accent text. */
.cn-init-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-subtle);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}

.cn-init-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.cn-init-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.cn-init-btn svg {
  flex-shrink: 0;
}

/* ── Notes-list footer: "Import slides to notes" (mirrors .cn-groups-footer) ── */
.cn-list-footer {
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
}

.cn-import-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s, color 0.15s;
}

.cn-import-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.cn-import-btn svg {
  flex-shrink: 0;
}

/* ── Import modal ──────────────────────────────────────────────────────── */
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

.cn-import-list {
  flex: 1 1 auto;
  min-height: 120px;
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 12px;
}

/* Folder picker rows */
.cn-import-folder {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
  transition: background-color 0.15s, border-color 0.15s;
}

.cn-import-folder:hover {
  background-color: var(--bg-hover);
}

.cn-import-folder.selected {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
}

.cn-import-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  pointer-events: none;
}

.cn-import-folder-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.cn-import-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cn-import-folder-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* Progress phase */
.cn-import-overall {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.cn-imp-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-surface);
}

.cn-imp-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cn-imp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.cn-imp-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.cn-imp-status.s-done { color: var(--success); }
.cn-imp-status.s-error { color: var(--danger); }
.cn-imp-status.s-conflict { color: var(--warning); }
.cn-imp-status.s-uploading,
.cn-imp-status.s-building { color: var(--accent); }

.cn-imp-bar {
  height: 4px;
  background-color: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.cn-imp-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  background-color: var(--accent);
  transition: width 0.3s ease;
}

.cn-imp-fill.s-done { background-color: var(--success); }
.cn-imp-fill.s-error,
.cn-imp-fill.s-conflict { background-color: transparent; }

.cn-imp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

/* Destructive "Replace" — matches the Download panel's "Cancel All" outline. */
.cn-imp-replace {
  color: var(--danger-pink);
  border-color: var(--danger-pink);
}

.cn-imp-replace:hover:not(:disabled) {
  background-color: var(--danger-bg);
  border-color: var(--danger-hover);
}

.cn-import-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* ── New Group modal (matches HomePage "Add Saved Search" modal) ──────── */
.cn-modal-box {
  background: var(--bg-modal);
  border-radius: 12px;
  padding: 20px;
  width: 320px;
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

.cn-modal-input {
  padding: 8px 11px;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.cn-modal-input::placeholder {
  color: var(--text-muted);
}

.cn-modal-input:focus {
  border-color: var(--accent);
}

.cn-modal-help {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
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

/* ── Middle: note list ───────────────────────────────────────────────── */
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
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

/* Search input — recessed field matching LeftPanel .nav-search.
   Uses box-shadow for focus ring so the border doesn't add height. */
.cn-search-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background-color: var(--hover-tint);
  transition: box-shadow 0.2s;
}

.cn-search-wrap:focus-within {
  box-shadow: 0 0 0 2px var(--focus-ring), 0 0 0 1px var(--accent);
}

.cn-search-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.cn-search {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  height: var(--control-height);
}

/* New note icon button — matches LeftPanel .user-banner-action */
.cn-newnote-btn {
  flex-shrink: 0;
  width: 26px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cn-newnote-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.cn-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Note row — wraps the item button + hover-reveal delete (matches .cn-group-item-row) */
.cn-note-item-row {
  display: flex;
  align-items: center;
  position: relative;
}

.cn-note-item {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  padding-right: 28px;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s;
}

.cn-note-item:hover {
  background-color: var(--bg-hover);
}

/* Active = subtle tinted bg + accent text (matches LeftPanel .nav-item.active) */
.cn-note-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.cn-note-item.active .cn-note-title {
  color: var(--accent);
}

.cn-note-item.active .cn-note-meta {
  color: var(--accent);
  opacity: 0.7;
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

/* Note delete — hidden by default, visible on row hover (matches .cn-group-delete) */
.cn-note-delete {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.cn-note-item-row:hover .cn-note-delete {
  opacity: 1;
  pointer-events: auto;
}

.cn-note-delete:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
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

/* ── Right: editor ───────────────────────────────────────────────────── */
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
  white-space: nowrap;
  min-width: 50px;
  text-align: center;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.cn-save-status.saving {
  color: var(--text-secondary);
}

.cn-save-status.saved {
  color: var(--success);
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
      light + dark both look right) ──────────────────────────────────────── */

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

/* Inputs inside Editor.js (e.g. image caption, quote text/caption) */
.cn-editor-doc :deep(.cdx-input) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

/* Code block */
.cn-editor-doc :deep(.ce-code__textarea) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

/* Table — themes itself through these three CSS variables */
.cn-editor-doc :deep(.tc-wrap) {
  --color-background: var(--bg-subtle);
  --color-text-secondary: var(--text-muted);
  --color-border: var(--border-color);
}

/* Delimiter dots */
.cn-editor-doc :deep(.ce-delimiter) {
  color: var(--text-muted);
}
</style>
