<template>
  <div class="notes-page">
    <!-- Not signed in -->
    <div v-if="cn.notSignedIn.value" class="np-signin">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <p>{{ $t('cloudNotes.notSignedIn') }}</p>
      <RouterLink class="btn btn--primary" :to="{ name: 'login' }">{{ $t('auth.signIn') }}</RouterLink>
    </div>

    <template v-else>
      <!-- Left region: groups + note list sharing one search toolbar. -->
      <div class="np-sidebar">
        <div class="np-toolbar">
          <div class="np-search-wrap">
            <svg class="np-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              v-model="cn.keyword.value"
              class="np-search"
              :placeholder="$t('cloudNotes.searchPlaceholder')"
              @input="cn.searchNotes()"
            />
          </div>
          <button class="np-icon-action" :title="$t('cloudNotes.newNote')" @click="onCreateNote">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
            </svg>
          </button>
          <button
            class="np-icon-action"
            :title="$t('cloudNotes.refreshList')"
            :disabled="cn.loading.value"
            @click="onRefreshList"
          >
            <svg :class="{ spinning: cn.loading.value }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
        </div>

        <div class="np-panes">
          <!-- Groups column -->
          <aside class="np-groups">
            <div class="np-groups-scroll custom-scrollbar">
              <button
                class="np-group-item"
                :class="{ active: cn.activeGroupId.value === '' }"
                @click="cn.setGroup('')"
              >
                <svg class="np-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                {{ $t('cloudNotes.allNotes') }}
              </button>

              <!-- AutoSlides-managed groups (ASnote / ASuser) -->
              <div v-if="cn.managedGroups.value.length > 0" class="np-managed-section">
                <div class="np-managed-header">{{ $t('cloudNotes.managedSection') }}</div>
                <button
                  v-for="g in cn.managedGroups.value"
                  :key="g.id"
                  class="np-group-item np-group-item--managed"
                  :class="{ active: cn.activeGroupId.value === g.id }"
                  :title="g.name"
                  @click="cn.setGroup(g.id)"
                >
                  <svg class="np-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                  </svg>
                  {{ g.name }}
                </button>
              </div>

              <!-- Other groups (Ungrouped + user-created) -->
              <div class="np-groups-header">{{ $t('cloudNotes.otherGroupsSection') }}</div>
              <div v-for="g in cn.otherGroups.value" :key="g.id" class="np-group-item-row">
                <button
                  class="np-group-item"
                  :class="{ active: cn.activeGroupId.value === g.id }"
                  :title="g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup'))"
                  @click="cn.setGroup(g.id)"
                >
                  <svg class="np-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup')) }}
                </button>
                <button
                  v-if="g.id !== 0"
                  class="np-icon-btn np-group-delete"
                  :title="$t('cloudNotes.deleteGroup')"
                  @click.stop="onDeleteGroup(g.id, g.name)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>

            <div class="np-groups-footer">
              <button class="np-newgroup-btn" @click="openNewGroup">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                {{ $t('cloudNotes.newGroupTitle') }}
              </button>
            </div>
          </aside>

          <!-- Note list column -->
          <section class="np-list">
            <div class="np-list-items custom-scrollbar">
              <div v-if="cn.loading.value" class="np-empty">{{ $t('cloudNotes.loading') }}</div>
              <div v-else-if="cn.notes.value.length === 0" class="np-empty">{{ $t('cloudNotes.noNotes') }}</div>
              <div v-for="note in cn.notes.value" :key="note.id" class="np-note-item-row">
                <button
                  class="np-note-item"
                  :class="{ active: cn.selectedNoteId.value === note.id }"
                  :title="note.title || $t('cloudNotes.untitled')"
                  @click="ed.openNote(note.id)"
                >
                  <span class="np-note-title">{{ note.title || $t('cloudNotes.untitled') }}</span>
                  <span class="np-note-meta">{{ note.updated_at }}</span>
                </button>
                <button
                  class="np-icon-btn np-note-delete"
                  :title="$t('cloudNotes.delete')"
                  @click.stop="onDeleteNote(note.id)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>

            <div v-if="cn.totalPages.value > 1" class="np-pager">
              <button class="btn btn--sm btn--ghost" :disabled="cn.page.value <= 1" @click="cn.goToPage(cn.page.value - 1)">‹</button>
              <span>{{ cn.page.value }} / {{ cn.totalPages.value }}</span>
              <button class="btn btn--sm btn--ghost" :disabled="cn.page.value >= cn.totalPages.value" @click="cn.goToPage(cn.page.value + 1)">›</button>
            </div>
          </section>
        </div>
      </div>

      <!-- Right: editor pane -->
      <section class="np-editor">
        <div v-if="!cn.selectedNote.value" class="np-editor-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>{{ $t('cloudNotes.selectNote') }}</p>
        </div>
        <template v-else>
          <div class="np-editor-header">
            <input
              v-model="ed.editableTitle.value"
              class="text-input np-title-input"
              :placeholder="$t('cloudNotes.untitled')"
              @blur="ed.onSaveTitle"
              @keyup.enter="ed.onSaveTitle"
            />
            <select class="select-field np-group-select" :value="String(cn.selectedNote.value.note_group_id ?? 0)" @change="onMoveGroup">
              <option value="0">{{ $t('cloudNotes.defaultGroup') }}</option>
              <option v-for="g in cn.groups.value.filter(x => x.id !== 0)" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
            </select>
            <span class="np-save-status" :class="ed.saveStatus.value">
              <template v-if="ed.saveStatus.value === 'saving'">{{ $t('cloudNotes.saving') }}</template>
              <template v-else-if="ed.saveStatus.value === 'saved'">{{ $t('cloudNotes.saved') }}</template>
            </span>
          </div>
          <div class="np-editor-holder custom-scrollbar">
            <div :ref="(el) => (ed.editorHolder.value = el as HTMLElement | null)" class="np-editor-doc"></div>
          </div>
        </template>
      </section>

      <div v-if="cn.error.value" class="np-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>
    </template>

    <!-- New group modal -->
    <div v-if="showNewGroupModal" class="modal-overlay" @click.self="showNewGroupModal = false">
      <div class="modal-content np-modal">
        <div class="modal-header">
          <h3>{{ $t('cloudNotes.newGroupTitle') }}</h3>
          <button class="modal-close" @click="showNewGroupModal = false">×</button>
        </div>
        <div class="modal-body">
          <input
            ref="newGroupInput"
            v-model="newGroupName"
            class="text-input np-newgroup-input"
            :maxlength="NOTE_GROUP_NAME_MAX"
            :placeholder="$t('cloudNotes.newGroupPlaceholder')"
            @keyup.enter="onCreateGroup"
          />
          <p class="np-newgroup-hint">{{ $t('cloudNotes.newGroupHint', { max: NOTE_GROUP_NAME_MAX }) }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showNewGroupModal = false">{{ $t('cloudNotes.cancel') }}</button>
          <button class="btn btn--primary" :disabled="!newGroupName.trim()" @click="onCreateGroup">
            {{ $t('cloudNotes.add') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Cloud Notes page: note list + groups + Editor.js editing over the Yanhekt
// note API. Ported from the desktop CloudNotesTab's 'notes' view mode (the
// index/import/export/share features are desktop-only).
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { useCloudNotes } from '../../composables/notes/useCloudNotes';
import { useNoteEditor } from '../../composables/notes/useNoteEditor';
import { NOTE_GROUP_NAME_MAX } from '../../lib/notes/notesTypes';
import { notesRefreshTick } from '../../stores/notesRefreshStore';
import { authStore } from '../../stores/authStore';

defineOptions({ name: 'NotesPage' });

const { t } = useI18n();
const cn = useCloudNotes();
const ed = useNoteEditor(cn, t);

const showNewGroupModal = ref(false);
const newGroupName = ref('');
const newGroupInput = ref<HTMLInputElement | null>(null);

let initialized = false;
let seenRefreshTick = notesRefreshTick.value;

async function initOnce(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await cn.init();
}

onMounted(() => void initOnce());

// KeepAlive re-activation: reload when the watch engine created a note since
// the last visit, and re-init after a sign-in that happened elsewhere.
onActivated(() => {
  void initOnce();
  if (notesRefreshTick.value !== seenRefreshTick) {
    seenRefreshTick = notesRefreshTick.value;
    void cn.loadAll();
  } else if (cn.notSignedIn.value && authStore.isLoggedIn.value) {
    void cn.init();
  }
});

// Flush pending editor edits when the page is hidden (KeepAlive) or evicted.
onDeactivated(() => {
  const id = cn.selectedNoteId.value;
  if (id != null) void ed.flushSave(id);
});
onBeforeUnmount(() => {
  const id = cn.selectedNoteId.value;
  if (id != null) void ed.flushSave(id);
});

// Signing in while the page is visible: load immediately.
watch(
  () => authStore.isLoggedIn.value,
  (loggedIn) => {
    if (loggedIn && cn.notSignedIn.value) void cn.init();
  },
);

async function onCreateNote(): Promise<void> {
  const id = await cn.createNote();
  if (id != null) await ed.openNote(id);
}

function onRefreshList(): void {
  void cn.init();
}

async function onDeleteNote(id: number): Promise<void> {
  if (!window.confirm(t('cloudNotes.confirmDeleteNote'))) return;
  await cn.deleteNote(id);
}

async function onDeleteGroup(id: number, name: string): Promise<void> {
  if (!window.confirm(t('cloudNotes.confirmDeleteGroup', { name: name || t('cloudNotes.defaultGroup') }))) return;
  await cn.deleteGroup(id);
}

function openNewGroup(): void {
  newGroupName.value = '';
  showNewGroupModal.value = true;
  void nextTick(() => newGroupInput.value?.focus());
}

async function onCreateGroup(): Promise<void> {
  const name = newGroupName.value.trim();
  if (!name) return;
  const ok = await cn.createGroup(name);
  if (ok) showNewGroupModal.value = false;
}

async function onMoveGroup(e: Event): Promise<void> {
  const note = cn.selectedNote.value;
  if (!note) return;
  const groupId = Number((e.target as HTMLSelectElement).value);
  await cn.moveNoteToGroup(note.id, groupId);
  note.note_group_id = groupId;
}
</script>

<style scoped>
.notes-page {
  display: flex;
  height: 100%;
  min-height: 0;
  background-color: var(--bg-page);
}

.np-signin {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}

.np-signin p {
  margin: 0;
}

/* ── Left region: toolbar + groups + list ─────────────────────────────── */
.np-sidebar {
  display: flex;
  flex-direction: column;
  width: 26.5rem;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  min-height: 0;
}

.np-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.np-search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.np-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.np-search {
  width: 100%;
  padding: 6px 8px 6px 28px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  box-sizing: border-box;
}

.np-search:focus {
  outline: none;
  border-color: var(--accent);
}

.np-icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.np-icon-action:hover:not(:disabled) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.np-icon-action:disabled {
  opacity: 0.5;
  cursor: default;
}

.np-icon-action .spinning {
  animation: np-spin 0.9s linear infinite;
}

@keyframes np-spin {
  to {
    transform: rotate(360deg);
  }
}

.np-panes {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Groups column */
.np-groups {
  width: 10.5rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  min-height: 0;
}

.np-groups-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
}

.np-group-item-row {
  display: flex;
  align-items: center;
}

.np-group-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-group-item:hover {
  background-color: var(--bg-hover);
}

.np-group-item.active {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.np-group-icon {
  flex-shrink: 0;
}

.np-managed-section {
  margin: 8px 0 4px;
  padding: 4px;
  border-radius: 8px;
  background-color: var(--bg-subtle);
}

.np-managed-header,
.np-groups-header {
  padding: 6px 8px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.np-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.np-icon-btn:hover {
  background-color: var(--danger-bg, var(--bg-hover));
  color: var(--danger);
}

.np-groups-footer {
  padding: 8px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.np-newgroup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.np-newgroup-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Note list column */
.np-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.np-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
}

.np-note-item-row {
  display: flex;
  align-items: center;
}

.np-note-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.np-note-item:hover {
  background-color: var(--bg-hover);
}

.np-note-item.active {
  background-color: var(--bg-subtle);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.np-note-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-note-meta {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-note-delete {
  opacity: 0;
}

.np-note-item-row:hover .np-note-delete {
  opacity: 1;
}

.np-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.np-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* ── Editor pane ──────────────────────────────────────────────────────── */
.np-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.np-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.np-title-input {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.np-group-select {
  width: 7.5rem;
  flex-shrink: 0;
  /* Match the compact header control height used by .text-input next door. */
  height: var(--control-height);
  min-height: var(--control-height);
  font-size: 0.75rem;
}

.np-save-status {
  flex-shrink: 0;
  font-size: 12px;
  white-space: nowrap;
  min-width: 50px;
  text-align: center;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.np-save-status.saving {
  color: var(--text-secondary);
}

.np-save-status.saved {
  color: var(--success);
}

.np-editor-holder {
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px 96px;
  color: var(--text-primary);
}

.np-editor-doc {
  max-width: 760px;
  margin: 0 auto;
  /* Left gutter houses Editor.js's block toolbar (＋ / drag handle), which sits
     at right:100% of the content column. Without this the toolbar overshoots
     into the panel divider. */
  padding: 0 16px 0 56px;
  box-sizing: border-box;
}

.np-editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  color: var(--text-secondary);
  font-size: 14px;
}

.np-editor-empty p {
  margin: 0;
}

.np-editor-empty svg {
  color: var(--text-muted);
  opacity: 0.7;
}

.np-error {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 8px;
  background-color: var(--danger-bg, var(--bg-elevated));
  border: 1px solid var(--danger);
  color: var(--danger);
  font-size: 13px;
  cursor: pointer;
  z-index: 10;
}

.np-modal {
  max-width: 22rem;
}

.np-newgroup-input {
  width: 100%;
}

.np-newgroup-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Editor.js theming (maps its hardcoded light chrome to design tokens so
      light + dark both look right — mirrors WatchNotesPanel) ─────────────── */
.np-editor-doc :deep(.ce-block__content),
.np-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.np-editor-doc :deep(.ce-paragraph),
.np-editor-doc :deep(.ce-header),
.np-editor-doc :deep(.cdx-block) {
  color: var(--text-primary);
}

.np-editor-doc :deep(a) {
  color: var(--link-color);
}

.np-editor-doc :deep([data-placeholder]:empty::before),
.np-editor-doc :deep(.cdx-block[data-placeholder]:empty::before) {
  color: var(--text-muted);
}

.np-editor-doc :deep(.ce-toolbar__plus),
.np-editor-doc :deep(.ce-toolbar__settings-btn) {
  color: var(--text-secondary);
}

.np-editor-doc :deep(.ce-toolbar__plus:hover),
.np-editor-doc :deep(.ce-toolbar__settings-btn:hover) {
  background-color: var(--bg-hover);
}

.np-editor-doc :deep(.ce-popover),
.np-editor-doc :deep(.ce-inline-toolbar),
.np-editor-doc :deep(.ce-conversion-toolbar),
.np-editor-doc :deep(.ce-settings) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.np-editor-doc :deep(.ce-popover__item:hover),
.np-editor-doc :deep(.ce-inline-tool:hover),
.np-editor-doc :deep(.ce-inline-toolbar__dropdown:hover),
.np-editor-doc :deep(.ce-conversion-tool:hover) {
  background-color: var(--bg-hover);
}

.np-editor-doc :deep(.ce-popover__item-icon),
.np-editor-doc :deep(.ce-conversion-tool__icon) {
  background-color: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.np-editor-doc :deep(.cdx-input) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

.np-editor-doc :deep(.ce-code__textarea) {
  background-color: var(--bg-input);
  border-color: var(--border-input);
  color: var(--text-primary);
}

.np-editor-doc :deep(.tc-wrap) {
  --color-background: var(--bg-subtle);
  --color-text-secondary: var(--text-muted);
  --color-border: var(--border-color);
}

.np-editor-doc :deep(.ce-delimiter) {
  color: var(--text-muted);
}

/* ── Mobile: stack the panes ──────────────────────────────────────────── */
@media (max-width: 860px) {
  .notes-page {
    flex-direction: column;
    overflow-y: auto;
  }

  .np-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .np-panes {
    max-height: 22rem;
  }

  .np-editor {
    min-height: 24rem;
  }
}
</style>
