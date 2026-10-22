import { ref, watch } from "vue";
import type { LocationQuery } from "vue-router";
import {
  searchLiveList,
  getCourseList,
  getAvailableSemesters,
  getCourseDetail,
  getSessionRoom,
  type SemesterOption,
} from "../lib/api";
import { IndexError, indexSessionIds, searchIndex, type IndexCourse } from "../lib/indexApi";
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
// The one term searched (`SemesterOption.key`). The current term is searched on
// Yanhekt, every earlier one on the Index. There is no "all terms" search.
// `semesterInitialized` keeps the auto-pick of the current term to the first time.
const selectedTerm = ref<string | null>(null);
const semesterInitialized = ref(false);
/** An i18n key explaining an empty Index search (too short, term not indexed, Index down). */
const notice = ref("");
const results = ref<Course[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const isLoading = ref(false);
const errorMessage = ref("");
const hasSearched = ref(false);

/** Settle time for semester checkbox runs — shorter than typing, still enough
 *  to absorb a burst of clicks. */
const SEMESTER_DEBOUNCE_MS = 250;

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
  const token = authStore.token.value;
  if (!token) return;
  try {
    availableSemesters.value = await getAvailableSemesters(token);
  } catch (error) {
    console.error("Failed to load available semesters:", error);
  }
};

const selectLatestSemester = async () => {
  await ensureSemesters();
  if (availableSemesters.value.length > 0) {
    selectedTerm.value = availableSemesters.value[0].key;
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
  notice.value = "";
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
      } else if (isIndexTerm()) {
      // The Index answers every match at once; pages of RESULTS_PER_PAGE are cut
      // here so each card's Yanhekt reads happen only once it is shown.
      if (resetPage) {
        indexGeneration++;
        const found = await searchPastTerm(keyword.value.trim(), selectedTerm.value!);
        if (seq !== requestSeq) return;
        indexMatches = found;
        totalPages.value = Math.max(1, Math.ceil(found.length / RESULTS_PER_PAGE));
      }
      const start = (currentPage.value - 1) * RESULTS_PER_PAGE;
      const page = indexMatches.slice(start, start + RESULTS_PER_PAGE).map(indexCourseToCourse);
      results.value = resetPage ? page : [...results.value, ...page];
        void fillIndexCourses(page.map((c) => c.id), token, indexGeneration);
    } else {
      const tagId = availableSemesters.value.find((s) => s.key === selectedTerm.value)?.tagId;
      const response = await getCourseList(token, {
        keyword: keyword.value.trim(),
        semesters: tagId != null ? [tagId] : [],
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

/** A term without a Yanhekt tag id is an earlier term: the Index searches it. */
const isIndexTerm = (): boolean => {
  const term = availableSemesters.value.find((s) => s.key === selectedTerm.value);
  return !!term && term.tagId === null;
};

/** An Index result as a course card, before `fillIndexCourses` adds what Yanhekt knows. */
const indexCourseToCourse = (c: IndexCourse): Course => {
  const m = c.term ? /^(\d{4}-\d{4})-([12])$/.exec(c.term) : null;
  return {
    id: String(c.id),
    title: c.name,
    instructor: c.teachers.join(", "),
    time: "",
    professors: c.teachers,
    school_year: m?.[1],
    semester: m?.[2],
  };
};

/** Every match of the current Index search; `results` shows the pages scrolled to so far. */
let indexMatches: IndexCourse[] = [];
/** Bumped by each new Index search, so late card fills from an older one are dropped. */
let indexGeneration = 0;

/** What a card gains from Yanhekt, per course id. Kept for the session: course facts do not change. */
const courseFills = new Map<string, Promise<Partial<Course>>>();
const FILL_CONCURRENCY = 4;

/**
 * Card fields for a course the Index found: `/v1/course?id=` (cover, English
 * name, college, teachers, term) and the classroom of its newest session
 * (`/v1/course/session` → broadcast `live.subtitle`; course detail has none).
 */
const courseFill = (id: string, token: string): Promise<Partial<Course>> => {
  let fill = courseFills.get(id);
  if (!fill) {
    fill = (async () => {
      const [detail, room] = await Promise.all([
        getCourseDetail(id, token).catch(() => null),
        indexSessionIds(id)
          .then((ids) => (ids.length > 0 ? getSessionRoom(ids[ids.length - 1], token) : undefined))
          .catch(() => undefined),
      ]);
      const patch: Partial<Course> = {};
      if (detail) {
        patch.titleEn = detail.title_en;
        patch.imageUrl = detail.image_url?.trim() || undefined;
        patch.college_name = detail.college_name;
        if (detail.professors?.length) {
          patch.professors = detail.professors;
          patch.instructor = detail.professors.join(", ");
        }
      }
      if (room) patch.classrooms = [{ name: room }];
      return patch;
    })();
    // Only a fill that learned something is kept; an empty one is retried next time.
    void fill.then((p) => {
      if (Object.keys(p).length === 0) courseFills.delete(id);
    });
    courseFills.set(id, fill);
  }
  return fill;
};

/** Fill in the shown Index cards from Yanhekt, a few at a time, card by card. */
const fillIndexCourses = async (ids: string[], token: string, generation: number) => {
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const patch = await courseFill(id, token);
      if (generation !== indexGeneration || Object.keys(patch).length === 0) continue;
      results.value = results.value.map((c) => (c.id === id ? { ...c, ...patch } : c));
    }
  };
  await Promise.all(Array.from({ length: Math.min(FILL_CONCURRENCY, ids.length) }, worker));
};

/** Index search of one earlier term. Its refusals become a notice instead of an error. */
const searchPastTerm = async (q: string, term: string): Promise<IndexCourse[]> => {
  if ([...q].length < 2) {
    notice.value = "searchPage.indexTooShort";
    return [];
  }
  try {
    const data = await searchIndex(q, term);
    return data.results;
  } catch (error) {
    const code = error instanceof IndexError ? error.code : "network";
    if (code === "term-not-indexed") notice.value = "searchPage.indexTermMissing";
    else if (code === "query-too-short" || code === "query-required") notice.value = "searchPage.indexTooShort";
    else if (code === "query-too-long") notice.value = "searchPage.indexTooLong";
    else {
      console.error("Index search failed:", error);
      notice.value = "searchPage.indexUnavailable";
    }
    return [];
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

/**
 * Debounced like typing, so flicking through terms costs one search.
 *
 * Reuses `debounceTimer` (and therefore `cancelPendingSearch`) rather than
 * adding a second timer, so a keyword keystroke and a term change cannot both
 * be pending at once.
 */
const setTerm = (key: string) => {
  if (selectedTerm.value === key && semesterInitialized.value) return;
  selectedTerm.value = key;
  semesterInitialized.value = true;
  cancelPendingSearch();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void executeSearch();
  }, SEMESTER_DEBOUNCE_MS);
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

// Header search submit: open the Search page *with* the keyword in the URL.
// A bare push to /search would make SearchPage's syncFromRoute adopt the empty
// query and wipe the keyword — resubmitting from a course page used to land on
// an empty search. Claiming the key first turns the route-watcher sync into a
// no-op, so this explicit run is the only one.
const submitSearch = async () => {
  cancelPendingSearch();
  lastExecutedKey = searchKey(mode.value, keyword.value);
  await router.push({ name: "search", query: buildQuery() });
  if (mode.value === "recorded" && !semesterInitialized.value) {
    await selectLatestSemester();
  }
  await executeSearch();
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
    selectedTerm,
    notice,
    results,
    currentPage,
    totalPages,
    isLoading,
    errorMessage,
    hasSearched,
    executeSearch,
    loadMore,
    setMode,
    setTerm,
    syncFromRoute,
    handleSidebarFocus,
    handleSidebarEnter,
    submitSearch,
    selectResult,
    openSavedSearch,
  };
}
