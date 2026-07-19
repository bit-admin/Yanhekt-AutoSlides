import { computed, ref } from 'vue';
import type { NoteSummary, NoteDetail, NoteGroup, NotesResult } from '../../lib/notes/notesTypes';
import { isAutoSlidesGroupName } from '../../lib/notes/notesTypes';
import { notesClient } from '../../lib/notes/notesClient';
import { cloudStorageStore } from '../../stores/cloudStorageStore';

const PAGE_SIZE = 20;
/** Page size used when fetching the full note set (server honours large sizes). */
const FETCH_PAGE_SIZE = 500;
/** Safety cap on full-set paging (FETCH_PAGE_SIZE * this = max notes loaded). */
const MAX_FETCH_PAGES = 20;

/**
 * Reactive state + actions for the Notes page. Ported from the desktop
 * useCloudNotes (autoslides/src/renderer/features/cloudNotes/useCloudNotes.ts);
 * the data source is the fetch-backed notesClient instead of the Electron IPC
 * bridge, and the desktop-only README recreation is dropped.
 *
 * Grouping model: the server's note/list endpoint ignores any groupId filter,
 * so we load the complete note set once (paging note/list, which paginates
 * correctly and honours a large page_size) and do group filtering, keyword
 * filtering, and pagination entirely client-side over that in-memory set. List
 * rows carry no content, so the full set stays light even for many notes. The
 * Editor.js wiring lives in the component; this composable owns the data.
 */
export function useCloudNotes() {
  const groups = ref<NoteGroup[]>([]);
  /** Complete note set (all groups), loaded via loadAll(). */
  const allNotes = ref<NoteSummary[]>([]);
  /** The current visible page after group + keyword filtering. */
  const notes = ref<NoteSummary[]>([]);
  const selectedNote = ref<NoteDetail | null>(null);

  const keyword = ref('');
  const activeGroupId = ref<number | ''>(''); // '' = all notes

  const page = ref(1);
  const totalPages = ref(1);
  /** Number of notes matching the current group + keyword filter. */
  const filteredCount = ref(0);

  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  /** Set when no token is stored — the user must sign in first. */
  const notSignedIn = ref(false);

  const selectedNoteId = computed(() => selectedNote.value?.id ?? null);

  /** The AutoSlides-managed groups (ASnote import + ASuser watch), by reserved name. */
  const managedGroups = computed(() => groups.value.filter((g) => isAutoSlidesGroupName(g.name)));
  /** Everything else: the default (Ungrouped) group + user-created groups. */
  const otherGroups = computed(() => groups.value.filter((g) => !isAutoSlidesGroupName(g.name)));

  /** Unwrap a result envelope; routes auth/errors into reactive state. */
  function unwrap<T>(res: NotesResult<T>): T | null {
    if (res.ok) {
      notSignedIn.value = false;
      return res.data;
    }
    if (res.error === 'not-signed-in') {
      notSignedIn.value = true;
    } else {
      error.value = res.error;
    }
    return null;
  }

  /** Recompute the visible page from allNotes given the active group + keyword. */
  function applyView(): void {
    const gid = activeGroupId.value;
    const kw = keyword.value.trim().toLowerCase();
    let rows = allNotes.value;
    if (gid !== '') rows = rows.filter((n) => n.note_group_id === gid);
    if (kw) rows = rows.filter((n) => (n.title || '').toLowerCase().includes(kw));

    filteredCount.value = rows.length;
    totalPages.value = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page.value > totalPages.value) page.value = totalPages.value;
    const start = (page.value - 1) * PAGE_SIZE;
    notes.value = rows.slice(start, start + PAGE_SIZE);
  }

  async function refreshGroups(): Promise<void> {
    const res = await notesClient.groupList();
    const data = unwrap(res);
    if (data) {
      groups.value = data;
      // Share this list with the storage store so it can adopt ASnote/ASuser
      // without a second groupList round-trip.
      cloudStorageStore.adoptFromGroups(data);
    }
  }

  /** Load the complete note set by paging note/list, then recompute the view. */
  async function loadAll(): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      const collected: NoteSummary[] = [];
      let p = 1;
      let lastPage = 1;
      do {
        const res = await notesClient.list({ page: p, pageSize: FETCH_PAGE_SIZE });
        const data = unwrap(res);
        if (!data) break;
        collected.push(...data.data);
        lastPage = Math.max(1, data.last_page);
        p += 1;
      } while (p <= lastPage && p <= MAX_FETCH_PAGES);
      allNotes.value = collected;
      applyView();
    } finally {
      loading.value = false;
    }
  }

  /** Re-apply the group + keyword filter (client-side; no network). */
  function searchNotes(resetPage = true): void {
    if (resetPage) page.value = 1;
    applyView();
  }

  function setGroup(groupId: number | ''): void {
    activeGroupId.value = groupId;
    page.value = 1;
    applyView();
  }

  function goToPage(next: number): void {
    page.value = Math.min(Math.max(1, next), totalPages.value);
    applyView();
  }

  /** Load full note detail into the editor pane. */
  async function openNote(id: number): Promise<NoteDetail | null> {
    error.value = '';
    const res = await notesClient.get(id);
    const data = unwrap(res);
    if (data) selectedNote.value = data;
    return data;
  }

  function closeNote(): void {
    selectedNote.value = null;
  }

  async function createNote(): Promise<number | null> {
    error.value = '';
    const res = await notesClient.create();
    const id = unwrap(res);
    if (id != null) {
      // Refetch so the new (blank) note appears with proper metadata.
      await loadAll();
    }
    return id;
  }

  async function saveContent(id: number, content: string): Promise<boolean> {
    saving.value = true;
    error.value = '';
    try {
      const res = await notesClient.updateContent(id, content);
      if (!res.ok) unwrap(res);
      return res.ok;
    } finally {
      saving.value = false;
    }
  }

  async function renameNote(id: number, title: string): Promise<boolean> {
    error.value = '';
    const res = await notesClient.updateTitle(id, title);
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value.title = title;
      const row = allNotes.value.find((n) => n.id === id);
      if (row) row.title = title;
      applyView();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  async function deleteNote(id: number): Promise<boolean> {
    error.value = '';
    const res = await notesClient.delete(id);
    if (res.ok) {
      if (selectedNote.value?.id === id) selectedNote.value = null;
      allNotes.value = allNotes.value.filter((n) => n.id !== id);
      applyView();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  async function moveNoteToGroup(id: number, groupId: number): Promise<boolean> {
    error.value = '';
    const res = await notesClient.moveToGroup(id, groupId);
    if (res.ok) {
      const row = allNotes.value.find((n) => n.id === id);
      if (row) row.note_group_id = groupId;
      await refreshGroups();
      applyView();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  async function createGroup(name: string): Promise<boolean> {
    error.value = '';
    const res = await notesClient.groupCreate(name);
    if (res.ok) {
      await refreshGroups();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  async function deleteGroup(id: number): Promise<boolean> {
    error.value = '';
    const res = await notesClient.groupDelete(id);
    if (res.ok) {
      // Server reassigns the group's notes to the default group (0).
      for (const n of allNotes.value) {
        if (n.note_group_id === id) n.note_group_id = 0;
      }
      if (activeGroupId.value === id) {
        activeGroupId.value = '';
        page.value = 1;
      }
      await refreshGroups();
      applyView();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  /** Initial load — groups + the complete note set. */
  async function init(): Promise<void> {
    await Promise.all([refreshGroups(), loadAll()]);
  }

  return {
    // state
    groups,
    managedGroups,
    otherGroups,
    allNotes,
    notes,
    selectedNote,
    selectedNoteId,
    keyword,
    activeGroupId,
    page,
    totalPages,
    filteredCount,
    loading,
    saving,
    error,
    notSignedIn,
    // actions
    init,
    refreshGroups,
    loadAll,
    searchNotes,
    setGroup,
    goToPage,
    openNote,
    closeNote,
    createNote,
    saveContent,
    renameNote,
    deleteNote,
    moveNoteToGroup,
    createGroup,
    deleteGroup,
  };
}
