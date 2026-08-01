<template>
  <div class="notes-workspace" :class="{ 'is-mobile': isMobile }">
    <!-- Mobile drawer backdrop (signed-in or gated) -->
    <div
      v-if="isMobile && sidebarOpen"
      class="nw-backdrop"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar always visible so Notes keeps its left chrome when signed out -->
    <NotesSidebar
      class="nw-sidebar"
      :class="{ 'is-open': !isMobile || sidebarOpen }"
      :style="sidebarStyle"
      :keyword="cn.keyword.value"
      :active-group-id="cn.activeGroupId.value"
      :managed-groups="cn.managedGroups.value"
      :other-groups="cn.otherGroups.value"
      :notes="cn.notes.value"
      :selected-note-id="cn.selectedNoteId.value"
      :loading="cn.loading.value"
      :page="cn.page.value"
      :total-pages="cn.totalPages.value"
      :mobile="isMobile"
      @update:keyword="onKeyword"
      @set-group="onSetGroup"
      @open-note="onOpenNote"
      @create-note="onCreateNote"
      @delete-note="onDeleteNote"
      @delete-group="onDeleteGroup"
      @new-group="showNewGroupModal = true"
      @refresh="onRefreshList"
      @go-page="cn.goToPage"
      @close="sidebarOpen = false"
    />

    <!-- Desktop-only drag handle between sidebar and canvas -->
    <div
      v-if="!isMobile"
      class="nw-resize"
      :class="{ 'is-dragging': resizing }"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="sidebarWidthPx"
      :aria-valuemin="SIDEBAR_MIN"
      :aria-valuemax="SIDEBAR_MAX"
      :title="$t('cloudNotes.resizeSidebar')"
      @pointerdown="onResizeStart"
    />

    <!-- Gated right pane when signed out (topbar mirrors empty editor canvas) -->
    <div v-if="cn.notSignedIn.value" class="nw-gated-canvas">
      <div class="nw-gated-topbar">
        <button
          v-if="isMobile"
          type="button"
          class="nw-gated-menu-btn"
          :aria-label="$t('cloudNotes.openSidebar')"
          @click="sidebarOpen = true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div class="nw-gated-topbar-spacer" />
        <RouterLink class="nw-gated-back" :to="{ name: 'home' }" :title="$t('cloudNotes.backToApp')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>{{ $t('cloudNotes.backToApp') }}</span>
        </RouterLink>
      </div>
      <div class="nw-gated-body">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <p>{{ $t('cloudNotes.notSignedIn') }}</p>
        <RouterLink
          class="btn btn--primary nw-signin-btn"
          :to="{ name: 'login', query: { redirect: route.fullPath } }"
        >
          {{ $t('auth.signIn') }}
        </RouterLink>
      </div>
    </div>

    <template v-else>
      <NotesEditorCanvas
        :has-note="!!cn.selectedNote.value"
        :title="ed.editableTitle.value"
        :group-id="cn.selectedNote.value?.note_group_id ?? 0"
        :move-groups="moveGroups"
        :save-status="ed.saveStatus.value"
        :mobile="isMobile"
        :can-export="canExportCurrentNote"
        :get-content="() => ed.currentNoteContent()"
        @open-sidebar="sidebarOpen = true"
        @create-note="onCreateNote"
        @update:title="(v) => (ed.editableTitle.value = v)"
        @save-title="ed.onSaveTitle"
        @move-group="onMoveGroup"
        @set-holder="(el) => (ed.editorHolder.value = el)"
        @duplicate="onDuplicateNote"
        @delete="onDeleteCurrentNote"
      />

      <div v-if="cn.error.value" class="nw-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>

      <PublicStorageBanner v-if="!publicStorageNoticeStore.acknowledged.value" />
    </template>

    <NotesNewGroupModal
      v-if="showNewGroupModal"
      @close="showNewGroupModal = false"
      @create="onCreateGroup"
    />
  </div>
</template>

<script setup lang="ts">
// Notion-style full-page Notes workspace. Data layer is unchanged
// (useCloudNotes + useNoteEditor); chrome is standalone via route meta.fullPage.
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useCloudNotes } from '../../composables/notes/useCloudNotes'
import { useNoteEditor } from '../../composables/notes/useNoteEditor'
import { notesRefreshTick } from '../../stores/notesRefreshStore'
import { authStore } from '../../stores/authStore'
import { cloudStorageStore } from '../../stores/cloudStorageStore'
import { publicStorageNoticeStore } from '../../stores/publicStorageNoticeStore'
import NotesSidebar from './NotesSidebar.vue'
import NotesEditorCanvas from './NotesEditorCanvas.vue'
import NotesNewGroupModal from './NotesNewGroupModal.vue'
import PublicStorageBanner from './PublicStorageBanner.vue'

defineOptions({ name: 'NotesPage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const cn = useCloudNotes()
const ed = useNoteEditor(cn, t)

const showNewGroupModal = ref(false)
const sidebarOpen = ref(false)
const isMobile = ref(false)

/** Notes outside ASnote (ASuser, Ungrouped, custom folders) can export to a file. */
const canExportCurrentNote = computed(() => {
  const note = cn.selectedNote.value
  if (!note) return false
  const mid = cloudStorageStore.managedGroupId.value
  if (mid == null) return true
  return Number(note.note_group_id ?? 0) !== Number(mid)
})

// Desktop sidebar width (px). Persisted so a drag survives reloads.
const SIDEBAR_DEFAULT = 248 // ~15.5rem
const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 480
const SIDEBAR_STORAGE_KEY = 'autoslides.notes.sidebarWidth'

function readStoredSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    const n = raw == null ? NaN : Number(raw)
    if (Number.isFinite(n)) return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)))
  } catch {
    // private mode / blocked storage
  }
  return SIDEBAR_DEFAULT
}

const sidebarWidthPx = ref(readStoredSidebarWidth())
const resizing = ref(false)
const sidebarStyle = computed(() =>
  isMobile.value ? undefined : { width: `${sidebarWidthPx.value}px` },
)

const moveGroups = computed(() => cn.groups.value.filter((g) => g.id !== 0))

let initialized = false
let seenRefreshTick = notesRefreshTick.value
/** Prevents route ↔ selection feedback loops while we replace URLs. */
let syncingRoute = false

function checkMobile(): void {
  isMobile.value = window.innerWidth <= 768
}

function clampSidebarWidth(px: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)))
}

function persistSidebarWidth(px: number): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(px))
  } catch {
    // ignore
  }
}

function onResizeStart(e: PointerEvent): void {
  if (isMobile.value) return
  e.preventDefault()
  resizing.value = true
  const startX = e.clientX
  const startW = sidebarWidthPx.value
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture?.(e.pointerId)

  const onMove = (ev: PointerEvent) => {
    sidebarWidthPx.value = clampSidebarWidth(startW + (ev.clientX - startX))
  }
  const onUp = (ev: PointerEvent) => {
    resizing.value = false
    persistSidebarWidth(sidebarWidthPx.value)
    target.releasePointerCapture?.(ev.pointerId)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function parseRouteNoteId(): number | null {
  const raw = route.params.noteId
  const s = Array.isArray(raw) ? raw[0] : raw
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function routeToNote(id: number | null): void {
  syncingRoute = true
  const target =
    id == null
      ? { name: 'notes' as const }
      : { name: 'notes-detail' as const, params: { noteId: String(id) } }
  void router.replace(target).finally(() => {
    syncingRoute = false
  })
}

async function syncFromRoute(): Promise<void> {
  if (cn.notSignedIn.value) return
  const id = parseRouteNoteId()
  if (id == null) {
    if (cn.selectedNoteId.value != null) cn.closeNote()
    return
  }
  if (cn.selectedNoteId.value === id) return
  await ed.openNote(id)
  // openNote leaves selection unchanged when the API fails — soft-fail home.
  if (cn.selectedNoteId.value !== id) {
    routeToNote(null)
  }
}

async function initOnce(): Promise<void> {
  if (initialized) return
  initialized = true
  await cn.init()
  await syncFromRoute()
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  void initOnce()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// KeepAlive re-activation: reload when the watch engine created a note since
// the last visit, and re-init after a sign-in that happened elsewhere.
onActivated(() => {
  void initOnce()
  if (notesRefreshTick.value !== seenRefreshTick) {
    seenRefreshTick = notesRefreshTick.value
    void cn.loadAll()
  } else if (cn.notSignedIn.value && authStore.isLoggedIn.value) {
    void cn.init().then(() => syncFromRoute())
  } else {
    void syncFromRoute()
  }
})

// Flush pending editor edits when the page is hidden (KeepAlive) or evicted.
onDeactivated(() => {
  const id = cn.selectedNoteId.value
  if (id != null) void ed.flushSave(id)
})
onBeforeUnmount(() => {
  const id = cn.selectedNoteId.value
  if (id != null) void ed.flushSave(id)
})

// Signing in while the page is visible: load immediately.
// Signing out: flip the gate so the canvas shows Sign In without waiting on a failed API call.
watch(
  () => authStore.isLoggedIn.value,
  (loggedIn) => {
    if (loggedIn && cn.notSignedIn.value) {
      void cn.init().then(() => syncFromRoute())
    } else if (!loggedIn) {
      cn.notSignedIn.value = true
    }
  },
)

// Deep-link / browser back-forward while the instance is alive.
watch(
  () => route.params.noteId,
  () => {
    if (syncingRoute) return
    void syncFromRoute()
  },
)

function onKeyword(value: string): void {
  cn.keyword.value = value
  // Debounced server keyword search lives in the composable.
  void cn.searchNotes()
}

function onSetGroup(id: number | ''): void {
  cn.setGroup(id)
}

async function onOpenNote(id: number): Promise<void> {
  await ed.openNote(id)
  routeToNote(id)
  if (isMobile.value) sidebarOpen.value = false
}

async function onCreateNote(): Promise<void> {
  const id = await cn.createNote()
  if (id != null) {
    await ed.openNote(id)
    routeToNote(id)
    if (isMobile.value) sidebarOpen.value = false
  }
}

function onRefreshList(): void {
  void cn.init()
}

async function onDeleteNote(id: number): Promise<void> {
  if (!window.confirm(t('cloudNotes.confirmDeleteNote'))) return
  const wasOpen = cn.selectedNoteId.value === id
  await cn.deleteNote(id)
  if (wasOpen) routeToNote(null)
}

async function onDeleteCurrentNote(): Promise<void> {
  const id = cn.selectedNoteId.value
  if (id == null) return
  await onDeleteNote(id)
}

/** Create a sibling note with the same title + content in the same group. */
async function onDuplicateNote(): Promise<void> {
  const src = cn.selectedNote.value
  if (!src) return
  const content = await ed.currentNoteContent()
  const title = (ed.editableTitle.value || src.title || t('cloudNotes.untitled')).trim()
  const copyTitle = `${title} ${t('cloudNotes.duplicateSuffix')}`
  const newId = await cn.createNote()
  if (newId == null) return
  await cn.renameNote(newId, copyTitle)
  if (content) await cn.saveContent(newId, content)
  // Preserve folder membership (create lands in Ungrouped by default).
  const groupId = Number(src.note_group_id ?? 0)
  if (groupId !== 0) {
    const moved = await cn.moveNoteToGroup(newId, groupId, content)
    if (moved != null && moved !== newId) {
      await ed.openNote(moved)
      routeToNote(moved)
      return
    }
  }
  await ed.openNote(newId)
  routeToNote(newId)
}

async function onDeleteGroup(id: number, name: string): Promise<void> {
  if (!window.confirm(t('cloudNotes.confirmDeleteGroup', { name: name || t('cloudNotes.defaultGroup') }))) return
  await cn.deleteGroup(id)
}

async function onCreateGroup(name: string): Promise<void> {
  const ok = await cn.createGroup(name)
  if (ok) showNewGroupModal.value = false
}

async function onMoveGroup(groupId: number): Promise<void> {
  const note = cn.selectedNote.value
  if (!note) return
  const prevId = note.id
  // Ungroup recreates the note — ship the live editor document so we don't drop edits.
  const content = groupId === 0 ? await ed.currentNoteContent() : undefined
  const newId = await cn.moveNoteToGroup(prevId, groupId, content)
  if (newId == null) return
  if (newId !== prevId) {
    await ed.openNote(newId)
    routeToNote(newId)
  } else {
    note.note_group_id = groupId
  }
}
</script>

<style scoped>
/* Layout only — color tokens live in the unscoped block below so dark mode
   (html[data-theme="dark"]) reliably overrides them without Vue scoped rewrites. */
.notes-workspace {
  position: relative;
  display: flex;
  height: 100%;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--nt-bg);
  color: var(--nt-text);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

/* Right-pane gate when signed out (sidebar stays mounted). */
.nw-gated-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--nt-bg);
}

.nw-gated-topbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 6px 12px 6px 14px;
  flex-shrink: 0;
}

.nw-gated-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted);
  cursor: pointer;
}

.nw-gated-menu-btn:hover {
  background: var(--nt-sidebar-hover);
  color: var(--nt-text);
}

.nw-gated-topbar-spacer {
  flex: 1;
}

/* Match NotesEditorCanvas `.nec-back` so the empty / signed-out chrome looks the same. */
.nw-gated-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted);
  font-size: 12.5px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.nw-gated-back:hover {
  background: var(--nt-sidebar-hover);
  color: var(--nt-text);
}

.nw-gated-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--nt-text-muted);
  font-size: 14px;
  padding: 24px;
}

.nw-gated-body p {
  margin: 0;
}

/* Primary button in the gate still uses shared .btn — nudge accent toward blue. */
.nw-signin-btn {
  --accent: var(--nt-accent);
  --accent-hover: #1a6fc0;
}

.nw-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 15, 0.35);
  z-index: 20;
}

.nw-sidebar {
  flex-shrink: 0;
  z-index: 21;
}

/* Thin hit target between sidebar and canvas (desktop). */
.nw-resize {
  position: relative;
  flex: 0 0 5px;
  width: 5px;
  margin-left: -2px;
  margin-right: -2px;
  cursor: col-resize;
  z-index: 22;
  touch-action: none;
  background: transparent;
}

.nw-resize::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: transparent;
  transition: background 0.12s ease, width 0.12s ease;
}

.nw-resize:hover::after,
.nw-resize.is-dragging::after {
  width: 2px;
  background: var(--nt-accent, #2383e2);
}

.notes-workspace:has(.nw-resize.is-dragging) {
  user-select: none;
  cursor: col-resize;
}

.nw-error {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--nt-sidebar-bg);
  border: 1px solid var(--danger, #c4554d);
  color: var(--danger, #c4554d);
  font-size: 13px;
  cursor: pointer;
  z-index: 30;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Mobile: sidebar as overlay drawer */
@media (max-width: 768px) {
  .notes-workspace .nw-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(18rem, 86vw);
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
  }

  .notes-workspace .nw-sidebar.is-open {
    transform: translateX(0);
  }
}
</style>

<!--
  Unscoped token sheet: light defaults on .notes-workspace, dark when the app
  stamps html[data-theme="dark"] (settingsStore). Must stay unscoped so the
  html[data-theme] selector isn't rewritten by Vue's scoped attribute.
-->
<style>
.notes-workspace {
  --nt-bg: #ffffff;
  --nt-sidebar-bg: #f7f7f5;
  --nt-sidebar-hover: rgba(0, 0, 0, 0.04);
  --nt-sidebar-active: rgba(0, 0, 0, 0.08);
  --nt-text: #37352f;
  --nt-text-muted: #787774;
  --nt-border: rgba(0, 0, 0, 0.06);
  --nt-accent: #2383e2;
  --nt-selection-bg: rgba(35, 131, 226, 0.28);
  --nt-selection-fg: inherit;
  --nt-elevated: #ffffff;
  --nt-elevated-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  /* Notion-style workspace avatar: light gray square + dark glyph */
  --nt-avatar-bg: #e3e2e0;
  --nt-avatar-fg: #37352f;
  --nt-sidebar-width: 15.5rem;
  --nt-doc-max: 52rem;
  --nt-title-size: 2.5rem;
  color-scheme: light;
}

html[data-theme="dark"] .notes-workspace {
  --nt-bg: #191919;
  --nt-sidebar-bg: #202020;
  --nt-sidebar-hover: rgba(255, 255, 255, 0.055);
  --nt-sidebar-active: rgba(255, 255, 255, 0.09);
  --nt-text: rgba(255, 255, 255, 0.81);
  --nt-text-muted: rgba(255, 255, 255, 0.5);
  --nt-border: rgba(255, 255, 255, 0.09);
  --nt-accent: #5b9dff;
  --nt-selection-bg: rgba(91, 157, 255, 0.38);
  --nt-selection-fg: rgba(255, 255, 255, 0.92);
  --nt-elevated: #2a2a2a;
  --nt-elevated-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  /* Muted square + light glyph (matches Notion dark sidebar) */
  --nt-avatar-bg: rgba(255, 255, 255, 0.12);
  --nt-avatar-fg: rgba(255, 255, 255, 0.9);
  color-scheme: dark;
}

/* Selection highlight tokens are consumed by styles/editor.css for both
   text ::selection and .ce-block--selected (one color). */
.notes-workspace ::selection {
  background: var(--nt-selection-bg);
  color: var(--nt-selection-fg);
}
</style>
