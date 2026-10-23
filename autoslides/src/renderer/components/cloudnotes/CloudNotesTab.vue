<template>
  <div class="cloud-notes-tab">
    <!-- Public-images notice banner -->
    <div v-if="bannerVisible && !cn.notSignedIn.value" class="cn-banner">
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
    <SignedOutPanel v-if="cn.notSignedIn.value" :title="$t('cloudNotes.notSignedIn')" />

    <template v-else>
      <!-- Left region: groups + list, sharing one search toolbar that spans
           both. The editor sits to the right with its own header. -->
      <div class="cn-sidebar">
        <div class="cn-toolbar">
          <button
            class="cn-collapse-btn"
            :class="{ active: groupCollapsed }"
            :title="$t('cloudNotes.toggleGroups')"
            :aria-label="$t('cloudNotes.toggleGroups')"
            @click="toggleGroups"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <!-- Filter notes + new note -->
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
          <!-- Manual refresh of the note list -->
          <button
            class="cn-newnote-btn"
            :title="$t('cloudNotes.refreshList')"
            :aria-label="$t('cloudNotes.refreshList')"
            :disabled="listRefreshing"
            @click="onRefreshList"
          >
            <svg :class="{ spinning: listRefreshing }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
        </div>
        <div class="cn-sidebar-panes">
      <!-- Left: groups -->
      <aside
        class="cn-groups"
        :class="{ collapsed: groupCollapsed }"
        :style="{ width: groupColPx }"
      >
        <div ref="groupsScrollEl" class="cn-groups-scroll custom-scrollbar">
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

          <!-- Managed + user groups -->
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
                :title="groupLabel(g)"
                @click="cn.setGroup(g.id)"
              >
                <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                </svg>
                {{ groupLabel(g) }}
              </button>
              <button
                class="cn-icon-btn cn-group-delete"
                :title="$t('cloudNotes.deleteGroup')"
                @click.stop="onDeleteGroup(g.id, groupLabel(g))"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
              </button>
            </div>
            <button
              v-if="cloudStorageStore.status.value === 'uninitialized' || cloudStorageStore.status.value === 'repairing'"
              class="cn-init-btn"
              :disabled="cloudStorageStore.status.value === 'repairing'"
              :title="$t('cloudNotes.initStorageTip')"
              @click="onInitStorage"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M12 12v4M10 14h4"/>
              </svg>
              {{ cloudStorageStore.status.value === 'repairing' ? $t('cloudNotes.initializing') : $t('cloudNotes.initStorage') }}
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
              :title="groupLabel(g)"
              @click="cn.setGroup(g.id)"
            >
              <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {{ groupLabel(g) }}
            </button>
            <button
              v-if="g.id !== 0"
              class="cn-icon-btn cn-group-delete"
              :title="$t('cloudNotes.deleteGroup')"
              @click.stop="onDeleteGroup(g.id, groupLabel(g))"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
          <div v-if="creatingGroup" class="cn-group-item-row cn-inline-create">
            <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <div class="cn-inline-wrap">
              <input
                ref="newGroupInput"
                v-model="newGroupName"
                class="cn-inline-input"
                :class="{ 'has-error': !!groupCreateError }"
                :placeholder="$t('cloudNotes.newGroupPlaceholder')"
                :aria-label="$t('cloudNotes.newGroupTitle')"
                :aria-invalid="!!groupCreateError"
                @keydown.enter.prevent="commitNewGroup"
                @keydown.esc.prevent="cancelNewGroup"
                @input="onGroupNameInput"
                @blur="onGroupBlur"
              />
            </div>
          </div>
        </div>

        <div class="cn-groups-footer">
          <button
            class="cn-newgroup-btn"
            @mousedown="creatingGroup ? $event.preventDefault() : undefined"
            @click="startNewGroup"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ $t('cloudNotes.newGroupTitle') }}
          </button>
        </div>
      </aside>

      <Teleport to="body">
        <div
          v-if="creatingGroup && groupCreateError"
          class="cn-inline-error"
          role="alert"
          :style="groupErrorStyle"
        >{{ groupCreateError }}</div>
      </Teleport>

      <!-- groups | list resize divider (drag left past the threshold collapses groups) -->
      <div class="cn-divider" @mousedown="startResize('group', $event)"></div>

      <!-- Middle: note list -->
      <section class="cn-list" :style="{ width: listWidth + 'px' }">
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
              :class="{
                active: cn.selectedNoteId.value === note.id,
                'is-opening': cn.openingNoteId.value === note.id,
              }"
              :title="noteListTitle(note)"
              @click="onOpenNote(note.id)"
            >
              <span class="cn-note-title">{{ noteListTitle(note) }}</span>
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

        <!-- Footer: Import / Export -->
        <div class="cn-list-footer">
          <button
            class="cn-tool-btn"
            :disabled="cloudStorageStore.blocked.value"
            :title="cloudStorageStore.blocked.value ? $t('cloudNotes.storageNotInitialized') : $t('cloudNotes.importTip')"
            @click="openImportModal"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
            </svg>
            <span v-if="imp.importing.value">{{ imp.overall.value.done }}/{{ imp.overall.value.total }}</span>
            <span v-else>{{ $t('cloudNotes.importButton') }}</span>
          </button>
          <button class="cn-tool-btn" :title="$t('cloudNotes.exportTip')" @click="exportModalRef?.openFromFooter()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
            </svg>
            <span v-if="exp.exporting.value">{{ exp.overall.value.done }}/{{ exp.overall.value.total }}</span>
            <span v-else>{{ $t('cloudNotes.exportButton') }}</span>
          </button>
        </div>
      </section>
        </div><!-- /.cn-sidebar-panes -->
      </div><!-- /.cn-sidebar -->

      <!-- list | editor resize divider -->
      <div class="cn-divider cn-divider--editor" @mousedown="startResize('list', $event)"></div>

      <ImportSelectModal
        :open="showImportModal && importPhase === 'select'"
        @close="closeImportModal"
        @start="onStartImport"
      />

      <!-- Import progress + conflict resolution (shared with the Slides page) -->
      <ImportProgressModal
        :open="showImportModal && importPhase === 'progress'"
        :title="$t('cloudNotes.importTitle')"
        :imp="imp"
        @close="closeImportModal"
        @done="doneImport"
        @open-note="onOpenConflictNote"
      />

      <NotesExportModal ref="exportModalRef" :cn="cn" :exp="exp" />

      <NoteShareModal
        ref="shareModalRef"
        :cn="cn"
        :get-content="ed.currentNoteContent"
        :on-content-updated="onEditorContentUpdated"
      />

      <NoteExportFormatModal
        ref="exportFormatModalRef"
        :cn="cn"
        :get-content="ed.currentNoteContent"
      />

      <!-- Right: editor -->
      <NoteEditorPane
        :cn="cn"
        :ed="ed"
        @share="shareModalRef?.open()"
        @export="exportFormatModalRef?.open()"
      />
    </template>
    </div>

    <div v-if="cn.error.value" class="cn-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { useAuth } from '@features/platform/useAuth'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { buildReadmeContent } from '@features/cloudNotes/readmeContent'
import { useNoteImport } from '@features/cloudNotes/useNoteImport'
import { formatNoteDisplayTitle, formatNoteGroupLabel, NOTE_GROUP_NAME_MAX, validateNoteGroupName } from '@common/notesTypes'
import ImportProgressModal from './ImportProgressModal.vue'
import NoteEditorPane from './NoteEditorPane.vue'
import NoteShareModal from './NoteShareModal.vue'
import NoteExportFormatModal from './NoteExportFormatModal.vue'
import SignedOutPanel from '../shell/SignedOutPanel.vue'
import ImportSelectModal from './ImportSelectModal.vue'
import NotesExportModal from './NotesExportModal.vue'
import { useNoteEditor } from '@features/cloudNotes/useNoteEditor'
import { useNoteExport } from '@features/cloudNotes/useNoteExport'
import { noteOpenRequestStore, notesRefreshStore } from '@features/cloudNotes/noteOpenRequest'

const { t } = useI18n()

function groupLabel(g: { id: number; name: string }): string {
  return formatNoteGroupLabel(g, t)
}

const cn = useCloudNotes()

/**
 * Sidebar row click.
 *
 * Re-clicking the note that is already open is a no-op. Beyond saving a
 * round-trip this is a correctness fix: `ed.openNote` skips `flushSave` when the
 * id is unchanged, and the remount that followed tore the editor down — clearing
 * its pending 1s save timer and silently discarding an edit typed a moment ago.
 *
 * Only the click path is guarded. The cross-page open request and the
 * import-conflict handler still call `ed.openNote` directly, because they may
 * need to (re)mount the editor for a selection made while the pane was hidden.
 */
function onOpenNote(id: number): void {
  if (cn.selectedNoteId.value === id) return
  void ed.openNote(id)
}

function noteListTitle(note: { title: string; note_group_id: number }): string {
  const managed = cn.managedGroups.value.some((g) => g.id === note.note_group_id)
  return formatNoteDisplayTitle(note.title, managed) || t('cloudNotes.untitled')
}
const { userId } = useAuth()

const imp = useNoteImport(cn, {
  meta: (count, date) => t('cloudNotes.noteMeta', { count, date }),
  slideCaption: (n) => t('cloudNotes.noteSlideCaption', { n }),
})
const exp = useNoteExport(cn)

// Editor.js lifecycle (parent-constructed — see useNoteEditor's doc comment).
const ed = useNoteEditor(cn, t)
const shareModalRef = ref<InstanceType<typeof NoteShareModal> | null>(null)
const exportFormatModalRef = ref<InstanceType<typeof NoteExportFormatModal> | null>(null)
const onEditorContentUpdated = (content: string) => ed.mountEditor(content)

// Manual refresh: reload the full note set + groups, and the storage status
// (cheap). Also covers a background auto-sync/import that ran through a separate
// useCloudNotes() instance while this page was mounted.
const listRefreshing = computed(() => cn.loading.value)

async function onRefreshList(): Promise<void> {
  void cloudStorageStore.refresh()
  await Promise.all([cn.loadAll(), cn.refreshGroups()])
}

const MYNOTES_URL = 'https://www.yanhekt.cn/profile/myNotes'
const WHY_URL = 'https://learn.ruc.edu.kg/disclosure'
function openExt(url: string): void { window.electronAPI.shell.openExternal(url) }

// Dismissible per session — resets to visible when the Tools window reopens.
const bannerVisible = ref(true)

// ── Resizable panes (groups | list | editor) ──────────────────────────────
// Session-only widths, same drag-to-resize / drag-to-collapse model as the
// window's left panel (App.vue). Mins keep the groups column wide enough for
// "Init cloud storage" on one line and the list wide enough for the long
// README note title.
const GROUP_MIN = 200
const GROUP_MAX = 340
const LIST_MIN = 250
const LIST_MAX = 560
const COLLAPSE_GAP = 60
const groupWidth = ref(210)
const listWidth = ref(300)
const groupCollapsed = ref(false)
// Shared by the groups column and the toolbar spacer above it, so the toolbar's
// middle border lines up with the groups | list pane divider.
const groupColPx = computed(() => (groupCollapsed.value ? '0px' : groupWidth.value + 'px'))

const toggleGroups = (): void => { groupCollapsed.value = !groupCollapsed.value }

let resizing: 'group' | 'list' | null = null
let resizeStartX = 0
let resizeStartGroup = 0
let resizeStartList = 0

function onResizeMove(e: MouseEvent): void {
  if (!resizing) return
  const dx = e.clientX - resizeStartX
  if (resizing === 'group') {
    const raw = resizeStartGroup + dx
    if (raw < GROUP_MIN - COLLAPSE_GAP) {
      groupCollapsed.value = true
      return
    }
    groupCollapsed.value = false
    groupWidth.value = Math.min(Math.max(GROUP_MIN, raw), GROUP_MAX)
  } else {
    const raw = resizeStartList + dx
    listWidth.value = Math.min(Math.max(LIST_MIN, raw), LIST_MAX)
  }
}

function stopResize(): void {
  resizing = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

function startResize(type: 'group' | 'list', e: MouseEvent): void {
  resizing = type
  resizeStartX = e.clientX
  // While collapsed the groups column reads as 0 wide, so dragging the divider
  // out from the edge re-expands it (like the window's left panel).
  resizeStartGroup = groupCollapsed.value ? 0 : groupWidth.value
  resizeStartList = listWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const creatingGroup = ref(false)
const newGroupName = ref('')
const groupCreateError = ref('')
const newGroupInput = ref<HTMLInputElement | null>(null)
const groupsScrollEl = ref<HTMLElement | null>(null)
const groupErrorStyle = ref<Record<string, string>>({})
let groupCreateBusy = false
let suppressGroupBlur = false

function existingGroupNames(): string[] {
  return cn.groups.value.map((g) => g.name)
}

function groupNameMessage(raw: string): string {
  const code = validateNoteGroupName(raw, existingGroupNames())
  if (!code) return ''
  return t(`cloudNotes.groupName.${code}`, { max: NOTE_GROUP_NAME_MAX })
}

function syncGroupErrorPos(): void {
  const el = newGroupInput.value
  if (!el) return
  const r = el.getBoundingClientRect()
  groupErrorStyle.value = {
    top: `${Math.round(r.bottom + 4)}px`,
    left: `${Math.round(r.left)}px`,
  }
}

function startNewGroup(): void {
  if (creatingGroup.value) {
    nextTick(() => newGroupInput.value?.focus())
    return
  }
  newGroupName.value = ''
  groupCreateError.value = ''
  creatingGroup.value = true
  nextTick(() => {
    newGroupInput.value?.focus()
    syncGroupErrorPos()
  })
}

function cancelNewGroup(): void {
  suppressGroupBlur = true
  creatingGroup.value = false
  newGroupName.value = ''
  groupCreateError.value = ''
  nextTick(() => { suppressGroupBlur = false })
}

function onGroupNameInput(): void {
  const code = validateNoteGroupName(newGroupName.value, existingGroupNames())
  if (!code || code === 'empty') {
    groupCreateError.value = ''
  } else if (code === 'tooLong' || groupCreateError.value) {
    groupCreateError.value = groupNameMessage(newGroupName.value)
  }
  nextTick(syncGroupErrorPos)
}

async function commitNewGroup(): Promise<void> {
  const err = groupNameMessage(newGroupName.value)
  if (err) {
    groupCreateError.value = err
    nextTick(() => {
      syncGroupErrorPos()
      newGroupInput.value?.focus()
    })
    return
  }
  if (groupCreateBusy) return
  groupCreateBusy = true
  suppressGroupBlur = true
  const ok = await cn.createGroup(newGroupName.value.trim())
  groupCreateBusy = false
  if (ok) {
    creatingGroup.value = false
    newGroupName.value = ''
    groupCreateError.value = ''
    suppressGroupBlur = false
    return
  }
  groupCreateError.value = t('cloudNotes.groupName.failed')
  nextTick(() => {
    suppressGroupBlur = false
    newGroupInput.value?.focus()
    syncGroupErrorPos()
  })
}

function onGroupBlur(): void {
  if (suppressGroupBlur || groupCreateBusy) return
  if (!newGroupName.value.trim()) {
    cancelNewGroup()
    return
  }
  const err = groupNameMessage(newGroupName.value)
  if (err) {
    groupCreateError.value = err
    nextTick(syncGroupErrorPos)
    return
  }
  void commitNewGroup()
}

watch(creatingGroup, (open) => {
  const el = groupsScrollEl.value
  if (open) {
    el?.addEventListener('scroll', syncGroupErrorPos, { passive: true })
    window.addEventListener('resize', syncGroupErrorPos)
  } else {
    el?.removeEventListener('scroll', syncGroupErrorPos)
    window.removeEventListener('resize', syncGroupErrorPos)
  }
})

async function onCreateNote(): Promise<void> {
  const id = await cn.createNote()
  if (id != null) await ed.openNote(id)
}

async function onDeleteNote(noteId: number): Promise<void> {
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    title: t('cloudNotes.delete'),
    message: t('cloudNotes.confirmDeleteNote'),
    buttons: [t('cloudNotes.cancel'), t('cloudNotes.delete')],
    defaultId: 1,
    cancelId: 0,
  })
  if (confirmed?.response !== 1) return
  if (cn.selectedNoteId.value === noteId) await ed.destroyEditor()
  await cn.deleteNote(noteId)
}

/** Explicit init entry point — provisions via the shared store (sets the
 * persisted per-account flag), then reconciles this page's local instance. */
async function onInitStorage(): Promise<void> {
  await cloudStorageStore.initialize()
  await cn.init()
}

// ── Import slides to notes ─────────────────────────────────────────────────
// The folder-select phase lives in ImportSelectModal; the progress phase in the
// shared ImportProgressModal. Both are gated by showImportModal + importPhase.
const showImportModal = ref(false)
const importPhase = ref<'select' | 'progress'>('select')

function openImportModal(): void {
  showImportModal.value = true
  // Reopen straight into progress if a run is active or its results are unread;
  // the select phase reloads its folder list on open (ImportSelectModal watch).
  importPhase.value = imp.queue.value.length > 0 ? 'progress' : 'select'
}

function closeImportModal(): void {
  // Only hide the modal — the queue (running or finished) stays alive so
  // reopening returns to the progress view. It is cleared only by "Done".
  showImportModal.value = false
}

function doneImport(): void {
  // Explicit dismissal of a finished queue: clear it and return to the picker.
  imp.reset()
  importPhase.value = 'select'
  showImportModal.value = false
}

function onStartImport(names: string[]): void {
  importPhase.value = 'progress'
  // Fire-and-forget: the queue runs in the background and survives modal close.
  void imp.startImport(names)
}

async function onOpenConflictNote(id?: number): Promise<void> {
  if (id == null) return
  closeImportModal()
  await ed.openNote(id)
}

// ── Export notes to slides ─────────────────────────────────────────────────
const exportModalRef = ref<InstanceType<typeof NotesExportModal> | null>(null)

async function onDeleteGroup(id: number, name: string): Promise<void> {
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    title: t('cloudNotes.deleteGroup'),
    message: t('cloudNotes.confirmDeleteGroup', { name }),
    buttons: [t('cloudNotes.cancel'), t('cloudNotes.delete')],
    defaultId: 1,
    cancelId: 0,
  })
  if (confirmed?.response !== 1) return
  await cn.deleteGroup(id)
}

onMounted(async () => {
  // Refresh the shared storage status too — covers the Tools-window instance,
  // where the main window's launch check never ran (shared/serialized, cheap).
  void cloudStorageStore.refresh()
  await cn.init()
  // Recreate the README on every open so it stays at the top (the server sorts
  // by created time, so re-saving wouldn't move it). No-op if absent.
  await cn.recreateReadme(buildReadmeContent())
})

// Cross-page "open this note" signal (e.g. an import-conflict row on the Slides
// page linking back to an existing managed note). Runs on every request, including
// the one already pending when this page first mounts.
watch(
  () => noteOpenRequestStore.pending.value,
  (req) => {
    if (req) void ed.openNote(req.noteId)
  },
  { immediate: true },
)

// Cross-page "reload notes" signal — a note was created through another
// useCloudNotes() instance, so re-fetch here to surface it (and any
// newly-created managed group).
watch(
  () => notesRefreshStore.refreshTick.value,
  () => { void Promise.all([cn.loadAll(), cn.refreshGroups()]) },
)

onUnmounted(() => {
  if (resizing) stopResize()
  groupsScrollEl.value?.removeEventListener('scroll', syncGroupErrorPos)
  window.removeEventListener('resize', syncGroupErrorPos)
})

// Account switch: the note list, groups, and any open note belong to the previous
// account. Tear down the editor first (cancels the debounced auto-save so it can't
// write the old note's content under the new account's token), drop the selection,
// then reload for the switched account. cloudStorageStore is rebound separately by
// LeftPanel's [isLoggedIn, userId] watch.
watch(() => userId.value, () => {
  void ed.destroyEditor()
  cn.selectedNote.value = null
  void cn.init()
})

// Live search — debounced server keyword (group filter still local).
watch(() => cn.keyword.value, () => { void cn.searchNotes(true) })

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

/* Left region: search toolbar on top, groups + list panes below. Sized by its
   children (groups + divider + list); the editor takes the rest. The right
   border runs full-height (toolbar + panes) so the sidebar | editor seam is
   continuous through the top bar. */
.cn-sidebar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-color);
}

.cn-sidebar-panes {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* Shared search toolbar spanning groups + list (aligns with the editor header). */
.cn-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-dropdown);
}

.cn-toolbar :deep(.semester-select) {
  flex-shrink: 0;
}

.cn-toolbar :deep(.semester-trigger) {
  max-width: 168px;
}

/* Collapse-groups button (left of the search), matches the title bar panel toggle. */
.cn-collapse-btn {
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
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cn-collapse-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.cn-collapse-btn.active {
  color: var(--accent);
  background-color: var(--badge-active-bg);
}

/* Pane resize handles — zero-width grab strip straddling the boundary
   (same idiom as App.vue's .divider). */
.cn-divider {
  width: 8px;
  margin: 0 -4px;
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-dropdown);
  background: transparent;
  cursor: col-resize;
}

/* ── Left: groups sidebar (matches LeftPanel navigator design) ───────── */
.cn-groups {
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cn-groups.collapsed {
  overflow: hidden;
  border-right: none;
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

.cn-inline-create {
  gap: 9px;
  padding: 2px 10px 2px 10px;
  overflow: visible;
}

.cn-inline-create .cn-group-icon {
  flex-shrink: 0;
}

.cn-inline-wrap {
  flex: 1 1 auto;
  min-width: 0;
}

.cn-inline-input {
  width: 100%;
  box-sizing: border-box;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  box-shadow: 0 0 0 1px var(--accent);
}

.cn-inline-input::placeholder {
  color: var(--text-muted);
}

.cn-inline-input.has-error {
  border-color: var(--danger);
  box-shadow: 0 0 0 1px var(--danger);
}

.cn-inline-error {
  position: fixed;
  z-index: var(--z-overlay);
  box-sizing: border-box;
  width: max-content;
  max-width: min(220px, calc(100vw - 24px));
  padding: 6px 8px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 4px;
  color: var(--danger);
  font-size: 11px;
  line-height: 1.35;
  box-shadow: 0 4px 12px var(--shadow-md);
  pointer-events: none;
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
  white-space: nowrap;
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

/* ── Notes-list footer: Import / Export (mirrors .cn-groups-footer) ── */
.cn-list-footer {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
}

.cn-tool-btn {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
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

.cn-tool-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.cn-tool-btn svg {
  flex-shrink: 0;
}

/* ── Import modal ──────────────────────────────────────────────────────── */
/* ── Middle: note list ───────────────────────────────────────────────── */
.cn-list {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Search input — recessed field matching LeftPanel .nav-search.
   Uses box-shadow for focus ring so the border doesn't add height. */
.cn-search-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: var(--control-height);
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

.cn-newnote-btn:disabled {
  cursor: default;
}

.cn-newnote-btn .spinning {
  animation: cn-spin 0.8s linear infinite;
}

@keyframes cn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cn-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Standalone note item — full width, no flex-grow */
.cn-note-item {
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s;
}

/* Note row — wraps the item button + hover-reveal delete (matches .cn-group-item-row) */
.cn-note-item-row {
  display: flex;
  align-items: center;
  position: relative;
}

.cn-note-item-row .cn-note-item {
  flex: 1 1 0%;
  width: auto;
  min-width: 0;
  /* Reserve room so text never sits under the action button */
  padding-right: 28px;
}

.cn-note-item:hover {
  background-color: var(--bg-hover);
}

/* Active = subtle tinted bg + accent text (matches LeftPanel .nav-item.active) */
/* Detail fetch in flight — the row dims rather than moving, so a slow note
   never shifts the list under the cursor. */
.cn-note-item.is-opening {
  opacity: 0.55;
}

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
.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
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


/* Downloading progress colored like the modal's other in-flight statuses. */
</style>
