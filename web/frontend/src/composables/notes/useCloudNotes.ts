import { computed, ref } from 'vue';
import type { NoteSummary, NoteDetail, NoteGroup, NotesResult } from '../../lib/notes/notesTypes';
import { notesClient } from '../../lib/notes/notesClient';
import { noteErrorText } from '../../lib/notes/noteErrors';
import { UNGROUP_KEPT_BOTH } from '../../lib/notes/noteUngroup';

const PAGE_SIZE = 20;
/** Page size used when fetching the full note set (server honours large sizes). */
const FETCH_PAGE_SIZE = 500;
/** Safety cap on full-set paging (FETCH_PAGE_SIZE * this = max notes loaded). */
const MAX_FETCH_PAGES = 20;
/** Debounce for live keyword search so we don't hit the API on every keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The Yanhekt note list ignores group filters, so all folders use the same
 * catalog and local pagination. Keyword matches come from the server and use
 * the same local group filter. List rows carry no editor content.
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
  /** True for the whole of init() — groups *and* notes. See init(). */
  const busy = ref(false);
  const saving = ref(false);
  const error = ref('');
  /** Set when no token is stored — the user must sign in first. */
  const notSignedIn = ref(false);

  /** Bumps on every new search so in-flight keyword pages discard stale results. */
  let searchGen = 0;
  /** Bumps on every openNote so a stale detail fetch cannot win a rapid A→B→A. */
  let openGen = 0;
  /** The note whose detail is currently being fetched; dims its sidebar row. */
  const openingNoteId = ref<number | null>(null);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Whose notes these are. A different token (sign-out, or another account
  // signing in while this cached page lives on) starts a new epoch: everything
  // loaded is dropped (`resetForIdentity`) and an answer still on its way for
  // the previous epoch writes nothing. Each action calls `live()` once at its
  // start and checks the result after every await.
  let epoch = 0;
  const live = (): (() => boolean) => {
    const mine = epoch;
    return () => mine === epoch;
  };

  const selectedNoteId = computed(() => selectedNote.value?.id ?? null);

  /** Unwrap a result envelope; routes auth/errors into reactive state. */
  function unwrap<T>(res: NotesResult<T>): T | null {
    if (res.ok) {
      notSignedIn.value = false;
      return res.data;
    }
    if (res.error === 'not-signed-in') {
      notSignedIn.value = true;
    } else {
      error.value = noteErrorText(res.error);
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
    const alive = live();
    const res = await notesClient.groupList();
    if (!alive()) return;
    const data = unwrap(res);
    if (data) groups.value = [{ id: 0, name: '' }, ...data.filter((group) => group.id !== 0)];
  }

  /**
   * Page note/list with a non-empty keyword into searchResults. Stale responses
   * (superseded by a newer searchGen) are discarded. Does not touch allNotes.
   */
  async function fetchKeywordMatches(kw: string): Promise<void> {
    const alive = live();
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
        if (gen !== searchGen || !alive()) return;
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
    const alive = live();
    loading.value = true;
    error.value = '';
    try {
      const collected: NoteSummary[] = [];
      let p = 1;
      let lastPage = 1;
      let complete = true;
      do {
        const res = await notesClient.list({ page: p, pageSize: FETCH_PAGE_SIZE });
        if (!alive()) return;
        const data = unwrap(res);
        if (!data) {
          complete = false;
          break;
        }
        collected.push(...data.data);
        lastPage = Math.max(1, data.last_page);
        p += 1;
      } while (p <= lastPage && p <= MAX_FETCH_PAGES);
      // A page that failed leaves the list as it was (the error is shown): the
      // pages before it are not the whole list.
      if (complete) allNotes.value = collected;
      const kw = keyword.value.trim();
      if (kw !== '') {
        // Keep loading true across the keyword re-fetch.
        await fetchKeywordMatches(kw);
      } else {
        searchResults.value = null;
        applyView();
      }
    } finally {
      if (alive()) loading.value = false;
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

  /**
   * Load full note detail into the editor pane.
   *
   * Guarded by a generation counter (same idea as `searchGen` above) so a slow
   * fetch for note A cannot land after the user has already moved to B and
   * clobber the newer selection. The losing call still returns its data to its
   * own caller — it just no longer owns `selectedNote`.
   */
  async function openNote(id: number): Promise<NoteDetail | null> {
    const alive = live();
    error.value = '';
    const gen = ++openGen;
    openingNoteId.value = id;
    try {
      const res = await notesClient.get(id);
      if (!alive()) return null;
      const data = unwrap(res);
      if (data && gen === openGen) selectedNote.value = data;
      return data;
    } finally {
      if (gen === openGen) openingNoteId.value = null;
    }
  }

  function closeNote(): void {
    selectedNote.value = null;
  }

  async function createNote(): Promise<number | null> {
    error.value = '';
    const alive = live();
    const res = await notesClient.create();
    if (!alive()) return null;
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
      const alive = live();
      const res = await notesClient.updateContent(id, content);
      // A refusal that arrives for the previous account is not this page's error.
      if (!res.ok && alive()) unwrap(res);
      return res.ok;
    } finally {
      saving.value = false;
    }
  }

  async function renameNote(id: number, title: string): Promise<boolean> {
    error.value = '';
    const alive = live();
    const res = await notesClient.updateTitle(id, title);
    if (!alive()) return false;
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
    const alive = live();
    const res = await notesClient.delete(id);
    if (!alive()) return false;
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
    const alive = live();
    const res = await notesClient.moveToGroup(id, groupId, title, content);
    if (!alive()) return null;
    const newId = unwrap(res);
    if (newId == null) {
      // The copy exists and the original stayed: show both.
      if (!res.ok && res.error === UNGROUP_KEPT_BOTH) {
        // A reload clears the error line; this one has to stay up.
        const message = error.value;
        await loadAll();
        error.value = message;
      }
      return null;
    }

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
    const alive = live();
    const res = await notesClient.groupCreate(name);
    if (!alive()) return false;
    if (res.ok) {
      await refreshGroups();
    } else {
      unwrap(res);
    }
    return res.ok;
  }

  async function deleteGroup(id: number): Promise<boolean> {
    error.value = '';
    const alive = live();
    const res = await notesClient.groupDelete(id);
    if (!alive()) return false;
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
      if (selectedNote.value?.note_group_id === id) selectedNote.value.note_group_id = 0;
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

  /**
   * The signed-in identity changed: drop everything loaded for the previous
   * one, and let nothing still in flight for it write. The caller reloads.
   */
  function resetForIdentity(): void {
    epoch += 1;
    searchGen += 1;
    openGen += 1;
    if (searchDebounceTimer != null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    groups.value = [];
    allNotes.value = [];
    searchResults.value = null;
    notes.value = [];
    selectedNote.value = null;
    openingNoteId.value = null;
    keyword.value = '';
    activeGroupId.value = '';
    page.value = 1;
    totalPages.value = 1;
    filteredCount.value = 0;
    loading.value = false;
    busy.value = false;
    saving.value = false;
    error.value = '';
  }

  /**
   * Initial load — groups + the complete note set.
   *
   * `busy` covers both halves. `loading` alone does not: it is set by loadAll /
   * fetchKeywordMatches but never by refreshGroups, so a Refresh button bound to
   * it re-enables while the group list is still in flight.
   */
  async function init(): Promise<void> {
    if (busy.value) return;
    const alive = live();
    busy.value = true;
    try {
      await Promise.all([refreshGroups(), loadAll()]);
    } finally {
      if (alive()) busy.value = false;
    }
  }

  return {
    // state
    groups,
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
    busy,
    saving,
    error,
    notSignedIn,
    openingNoteId,
    // actions
    init,
    resetForIdentity,
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
