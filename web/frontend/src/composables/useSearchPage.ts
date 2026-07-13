import { ref, watch } from "vue";
import type { LocationQuery } from "vue-router";
import {
  searchLiveList,
  getCourseList,
  getAvailableSemesters,
  type SemesterOption,
} from "../lib/api";
import { authStore } from "../stores/authStore";
import { router } from "../router";
import { openCourse } from "./courseSelection";
import { transformLiveStreamToCourse, transformCourseDataToCourse, type Course } from "./useCourseList";

// Ported from the desktop app's features/course/useSearchPage.ts.

const SEARCH_DEBOUNCE_MS = 400;
const RESULTS_PER_PAGE = 16;

// Module-singleton search state: the left-panel search bar writes the keyword,
// SearchPage.vue renders the results, and results persist across navigation.
const keyword = ref("");
const mode = ref<"live" | "recorded">("recorded");
const availableSemesters = ref<SemesterOption[]>([]);
// Selected semester ids; an empty array means "all semesters" (no filter).
// `semesterInitialized` distinguishes the not-yet-defaulted startup state from
// a deliberate empty/"all" selection so we only auto-pick the latest once.
const selectedSemesterIds = ref<number[]>([]);
const semesterInitialized = ref(false);
const results = ref<Course[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const isLoading = ref(false);
const errorMessage = ref("");
const hasSearched = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Sequence number so stale responses (rapid keyword/mode/semester flips) are dropped.
let requestSeq = 0;
// The mode|keyword pair of the last executeSearch run. syncFromRoute compares
// against it so a URL change we produced ourselves doesn't re-run the search
// (load-bearing: prevents double execution between explicit searches and the
// route watcher in SearchPage).
let lastExecutedKey: string | null = null;

const searchKey = (m: string, kw: string) => `${m}|${kw.trim()}`;

// The URL is the source of truth for q/mode; searches reflect them via
// replace so typing doesn't spam history.
const buildQuery = (): Record<string, string> => {
  const query: Record<string, string> = {};
  const kw = keyword.value.trim();
  if (kw) query.q = kw;
  if (mode.value !== "recorded") query.mode = mode.value;
  return query;
};

const reflectQueryInUrl = () => {
  if (router.currentRoute.value.name !== "search") return;
  void router.replace({ name: "search", query: buildQuery() });
};

const cancelPendingSearch = () => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};

const ensureSemesters = async () => {
  if (availableSemesters.value.length > 0) return;
  try {
    availableSemesters.value = await getAvailableSemesters();
  } catch (error) {
    console.error("Failed to load available semesters:", error);
  }
};

const selectLatestSemester = async () => {
  await ensureSemesters();
  if (availableSemesters.value.length > 0) {
    selectedSemesterIds.value = [availableSemesters.value[0].id];
  }
  semesterInitialized.value = true;
};

const executeSearch = async (resetPage = true) => {
  cancelPendingSearch();

  const token = authStore.token.value;
  if (!token) {
    errorMessage.value = "Please login first";
    results.value = [];
    hasSearched.value = true;
    return;
  }

  if (resetPage) {
    currentPage.value = 1;
  }

  lastExecutedKey = searchKey(mode.value, keyword.value);
  reflectQueryInUrl();

  const seq = ++requestSeq;
  isLoading.value = true;
  errorMessage.value = "";
  hasSearched.value = true;

  try {
    if (mode.value === "live") {
      const response = await searchLiveList(token, keyword.value.trim(), currentPage.value, RESULTS_PER_PAGE);
      if (seq !== requestSeq) return;
      const transformed = response.data.map(transformLiveStreamToCourse);
      if (resetPage) {
        results.value = transformed;
      } else {
        results.value = [...results.value, ...transformed];
      }
      totalPages.value = response.last_page;
      currentPage.value = response.current_page;
    } else {
      const response = await getCourseList(token, {
        keyword: keyword.value.trim(),
        semesters: [...selectedSemesterIds.value],
        page: currentPage.value,
        pageSize: RESULTS_PER_PAGE,
      });
      if (seq !== requestSeq) return;
      const transformed = response.data.map(transformCourseDataToCourse);
      if (resetPage) {
        results.value = transformed;
      } else {
        results.value = [...results.value, ...transformed];
      }
      totalPages.value = response.last_page;
      currentPage.value = response.current_page;
    }
  } catch (error: unknown) {
    if (seq !== requestSeq) return;
    console.error("Search failed:", error);
    errorMessage.value = (error instanceof Error && error.message) || "Failed to search courses";
    if (resetPage) {
      results.value = [];
    }
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false;
    }
  }
};

const loadMore = async () => {
  if (isLoading.value || currentPage.value >= totalPages.value) return;
  currentPage.value += 1;
  await executeSearch(false);
};

// Search-as-you-type: debounce while the Search page is active. The key check
// makes keyword writes that came with an executed search (syncFromRoute,
// openSavedSearch) a no-op instead of a second run.
watch(keyword, () => {
  if (router.currentRoute.value.name !== "search") return;
  cancelPendingSearch();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (searchKey(mode.value, keyword.value) === lastExecutedKey) return;
    executeSearch();
  }, SEARCH_DEBOUNCE_MS);
});

// Adopt q/mode from the route (deep link, back/forward through query states).
// URL changes produced by our own searches match lastExecutedKey and no-op; a
// bare /search (no params) is only adopted, not auto-executed, matching the
// pre-router first-visit behavior.
const syncFromRoute = async (query: LocationQuery) => {
  const q = typeof query.q === "string" ? query.q : "";
  const m = query.mode === "live" ? "live" : "recorded";
  const key = searchKey(m, q);
  if (key === lastExecutedKey) return;
  cancelPendingSearch();
  keyword.value = q;
  mode.value = m;
  if (!q && !query.mode && !hasSearched.value) return;
  // Claim the key before the awaits so a second sync of the same query
  // (explicit call + route watcher) can't start a duplicate run.
  lastExecutedKey = key;
  if (m === "recorded" && !semesterInitialized.value) {
    await selectLatestSemester();
  }
  await executeSearch();
};

const setMode = async (m: "live" | "recorded") => {
  if (mode.value === m) return;
  mode.value = m;
  if (m === "recorded" && !semesterInitialized.value) {
    await selectLatestSemester();
  }
  await executeSearch();
};

const setSemesters = async (ids: number[]) => {
  selectedSemesterIds.value = ids;
  semesterInitialized.value = true;
  await executeSearch();
};

// Focusing the sidebar search bar opens the Search page; the first visit runs
// an initial search immediately (empty keyword is a valid search).
const handleSidebarFocus = async () => {
  await router.push({ name: "search", query: buildQuery() });
  // A non-empty keyword implies an earlier executed search (hasSearched set),
  // so only the bare first visit reaches the execute below — no overlap with
  // syncFromRoute, which never executes a bare /search.
  if (!hasSearched.value && !isLoading.value) {
    if (mode.value === "recorded" && !semesterInitialized.value) {
      await selectLatestSemester();
    }
    await executeSearch();
  }
};

const handleSidebarEnter = () => {
  executeSearch();
};

const selectResult = (course: Course) => {
  openCourse(mode.value, course);
};

// Open a saved search: adopt its keyword + mode, switch to the Search page,
// and run it (ports the desktop app's openSavedSearch).
const openSavedSearch = async (kw: string, m: "live" | "recorded") => {
  cancelPendingSearch();
  keyword.value = kw;
  mode.value = m;
  await router.push({ name: "search", query: buildQuery() });
  // Deterministic execution regardless of SearchPage watcher timing; the
  // key claim makes whichever runs second a no-op.
  await syncFromRoute(router.currentRoute.value.query);
};

export function useSearchPage() {
  return {
    keyword,
    mode,
    availableSemesters,
    selectedSemesterIds,
    results,
    currentPage,
    totalPages,
    isLoading,
    errorMessage,
    hasSearched,
    executeSearch,
    loadMore,
    setMode,
    setSemesters,
    syncFromRoute,
    handleSidebarFocus,
    handleSidebarEnter,
    selectResult,
    openSavedSearch,
  };
}
