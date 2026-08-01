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
/** Debounce for live keyword search so we don't hit the API on every keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Reactive state + actions for the Notes page. Ported from the desktop
 * useCloudNotes (autoslides/src/renderer/features/cloudNotes/useCloudNotes.ts);
 * the data source is the fetch-backed notesClient instead of the Electron IPC
 * bridge, and the desktop-only README recreation is dropped.
 *
 * Grouping model: the server's note/list endpoint ignores any groupId filter,
 * so we load the complete note set once (paging note/list with empty keyword)
 * into `allNotes` and filter by group + paginate client-side. Keyword search is
 * server-side: a non-empty keyword pages note/list with `keyword=` into
 * `searchResults`, then the same client group/page slice runs over that buffer.
 * Export/import keep using the full catalog via loadAll() + allNotes. List rows
 * carry no content, so both sets stay light. The Editor.js wiring lives in the
 * component; this composable owns the data.
 */
export function useCloudNotes() {
  const groups = ref<NoteGroup[]>([]);
  /** Complete note set (all groups), loaded via loadAll(). */
  const allNotes = ref<NoteSummary[]>([]);
  /**
   * Server keyword matches when a search is active; null means "use allNotes".
   * Kept separate so export/import can still rely on the full catalog.
   */
  const searchResults = ref<NoteSummary[] | null>(null);
  /** The current visible page after group filtering over the active source set. */
  const notes = ref<NoteSummary[]>([]);
  const selectedNote = ref<NoteDetail | null>(null);

  const keyword = ref('');
  const activeGroupId = ref<number | ''>(''); // '' = all notes

  const page = ref(1);
  const totalPages = ref(1);
  /** Number of notes matching the current group (+ keyword, when searching). */
  const filteredCount = ref(0);

  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  /** Set when no token is stored — the user must sign in first. */
  const notSignedIn = ref(false);

  /** Bumps on every new search so in-flight keyword pages discard stale results. */
  let searchGen = 0;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Active source set: server keyword matches when searching, else full catalog. */
  function sourceRows(): NoteSummary[] {
    return searchResults.value ?? allNotes.value;
  }

  /** Recompute the visible page from the active source given the active group. */
  function applyView(): void {
    const gid = activeGroupId.value;
    let rows = sourceRows();
    if (gid !== '') rows = rows.filter((n) => n.note_group_id === gid);

    filteredCount.value = rows.length;
    totalPages.value = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page.value > totalPages.value) page.value = totalPages.value;
    const start = (page.value - 1) * PAGE_SIZE;
    notes.value = rows.slice(start, start + PAGE_SIZE);
  }

  /** Patch a note title in both the full catalog and the active search buffer. */
  function patchTitle(id: number, title: string): void {
    const row = allNotes.value.find((n) => n.id === id);
    if (row) row.title = title;
    const searchRow = searchResults.value?.find((n) => n.id === id);
    if (searchRow) searchRow.title = title;
  }

  /** Drop a note from both the full catalog and the active search buffer. */
  function removeFromBuffers(id: number): void {
    allNotes.value = allNotes.value.filter((n) => n.id !== id);
    if (searchResults.value) {
      searchResults.value = searchResults.value.filter((n) => n.id !== id);
    }
  }

  /** Patch note_group_id in both buffers. */
  function patchGroup(id: number, groupId: number): void {
    const row = allNotes.value.find((n) => n.id === id);
    if (row) row.note_group_id = groupId;
    const searchRow = searchResults.value?.find((n) => n.id === id);
    if (searchRow) searchRow.note_group_id = groupId;
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

  /**
   * Page note/list with a non-empty keyword into searchResults. Stale responses
   * (superseded by a newer searchGen) are discarded. Does not touch allNotes.
   */
  async function fetchKeywordMatches(kw: string): Promise<void> {
    const gen = ++searchGen;
    const ownLoading = !loading.value;
    if (ownLoading) loading.value = true;
    error.value = '';
    try {
      const collected: NoteSummary[] = [];
      let p = 1;
      let lastPage = 1;
      do {
        const res = await notesClient.list({ page: p, pageSize: FETCH_PAGE_SIZE, keyword: kw });
        if (gen !== searchGen) return;
        const data = unwrap(res);
        if (!data) break;
        collected.push(...data.data);
        lastPage = Math.max(1, data.last_page);
        p += 1;
      } while (p <= lastPage && p <= MAX_FETCH_PAGES);
      if (gen !== searchGen) return;
      searchResults.value = collected;
      applyView();
    } finally {
      if (ownLoading && gen === searchGen) loading.value = false;
    }
  }

  /** Load the complete note set by paging note/list (empty keyword), then recompute the view. */
  async function loadAll(): Promise<void> {
    // Invalidate any in-flight keyword search; loadAll owns the next view update.
    searchGen += 1;
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
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
      const kw = keyword.value.trim();
      if (kw !== '') {
        // Keep loading true across the keyword re-fetch.
        await fetchKeywordMatches(kw);
      } else {
        searchResults.value = null;
        applyView();
      }
    } finally {
      loading.value = false;
    }
  }

  /**
   * Apply the current keyword: empty → clear search buffer (instant, local);
   * non-empty → debounced server keyword fetch. Group filter stays client-side.
   */
  function searchNotes(resetPage = true): void {
    if (resetPage) page.value = 1;
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    const kw = keyword.value.trim();
    if (kw === '') {
      searchGen += 1;
      searchResults.value = null;
      applyView();
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      void fetchKeywordMatches(kw);
    }, SEARCH_DEBOUNCE_MS);
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
      patchTitle(id, title);
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
      removeFromBuffers(id);
      applyView();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  /**
   * Move `id` into `groupId` (0 = Ungrouped).
   * Returns the resulting note id (new when ungrouped via recreate), or null on failure.
   * Pass live editor `content` when ungrouping so unsaved edits aren't lost.
   */
  async function moveNoteToGroup(
    id: number,
    groupId: number,
    content?: string,
  ): Promise<number | null> {
    error.value = '';
    const row = allNotes.value.find((n) => n.id === id);
    const title = row?.title ?? selectedNote.value?.title ?? '';
    const res = await notesClient.moveToGroup(id, groupId, title, content);
    const newId = unwrap(res);
    if (newId == null) return null;

    if (newId !== id) {
      // Ungroup recreated the note under a new id — drop the old row and reload.
      removeFromBuffers(id);
      if (selectedNote.value?.id === id) selectedNote.value = null;
      await loadAll();
    } else {
      patchGroup(id, groupId);
      if (selectedNote.value?.id === id) selectedNote.value.note_group_id = groupId;
      await refreshGroups();
      applyView();
    }
    return newId;
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
      if (searchResults.value) {
        for (const n of searchResults.value) {
          if (n.note_group_id === id) n.note_group_id = 0;
        }
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
