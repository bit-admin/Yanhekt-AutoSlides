import { computed } from "vue";
import { configStore, persistConfig } from "../stores/configStore";

// Saved search keywords, one list per mode. Ported from the desktop app's
// features/course/savedSearches.ts, with the electron-store IPC swapped for a
// configStore mutation + localStorage persist.

export interface SavedSearchEntry {
  keyword: string;
  mode: "live" | "recorded";
}

export const savedSearchesLive = computed<string[]>(() => configStore.savedSearchesLive);
export const savedSearchesRecorded = computed<string[]>(() => configStore.savedSearchesRecorded);

// Merged for the Home page: live first, then recorded.
export const mergedSavedSearches = computed<SavedSearchEntry[]>(() => [
  ...savedSearchesLive.value.map((keyword) => ({ keyword, mode: "live" as const })),
  ...savedSearchesRecorded.value.map((keyword) => ({ keyword, mode: "recorded" as const })),
]);

export const addSavedSearch = (mode: "live" | "recorded", keyword: string): void => {
  const kw = keyword.trim();
  const list = mode === "live" ? configStore.savedSearchesLive : configStore.savedSearchesRecorded;
  if (!kw || list.includes(kw)) return; // no-empty + case-sensitive dedupe
  list.push(kw);
  persistConfig();
};

export const removeSavedSearch = (mode: "live" | "recorded", keyword: string): void => {
  const list = mode === "live" ? configStore.savedSearchesLive : configStore.savedSearchesRecorded;
  const idx = list.indexOf(keyword);
  if (idx === -1) return;
  list.splice(idx, 1);
  persistConfig();
};
