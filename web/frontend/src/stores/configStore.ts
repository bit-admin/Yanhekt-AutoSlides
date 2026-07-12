import { reactive } from "vue";
import { readJSON, writeJSON } from "./storage";

// Unified reactive config, persisted as a single JSON blob. This is the web
// analogue of the desktop app's electron-store `AppConfig`: one object holding
// preferences + saved/pinned state. The auth token deliberately stays in its
// own `autoslides.token` key (a session secret, mirroring the desktop app's
// separate `authToken`).

const STORAGE_KEY = "autoslides.config";
const LEGACY_LOCALE_KEY = "autoslides.locale";

export type ThemeMode = "system" | "light" | "dark";
// Web supports two locales only (no ja/ko).
export type LanguageMode = "system" | "en" | "zh";

// Captured at subscribe time so a subscribed course keeps its rich fields (classrooms /
// participant_count / term) — those come from the course list/search and are
// NOT returned by getCourseInfo. Ported from the desktop app's PinnedCourse.
export interface SubscribedCourse {
  id: string;
  title: string;
  instructor?: string;
  time?: string;
  classrooms?: { name: string }[];
  participant_count?: number;
  college_name?: string;
  professors?: string[];
  school_year?: string;
  semester?: string;
}

export interface WebConfig {
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  savedSearchesLive: string[];
  savedSearchesRecorded: string[];
  subscribedRecordedCourses: SubscribedCourse[];
  sidebarCollapsed: boolean;
}

const defaults = (): WebConfig => ({
  themeMode: "system",
  languageMode: "system",
  savedSearchesLive: [],
  savedSearchesRecorded: [],
  subscribedRecordedCourses: [],
  sidebarCollapsed: false,
});

function load(): WebConfig {
  const stored = readJSON<Partial<WebConfig>>(STORAGE_KEY, {});
  const merged: WebConfig = { ...defaults(), ...stored };

  // One-time migration: an earlier build persisted the locale under its own
  // key. Adopt it as the language mode, then drop the legacy key.
  const legacyLocale = localStorage.getItem(LEGACY_LOCALE_KEY);
  if (legacyLocale === "en" || legacyLocale === "zh") {
    if (stored.languageMode === undefined) merged.languageMode = legacyLocale;
    localStorage.removeItem(LEGACY_LOCALE_KEY);
    writeJSON(STORAGE_KEY, merged);
  }

  return merged;
}

// Reactive singleton — read synchronously anywhere; mutate via the helpers so
// every change is written through to localStorage.
export const configStore = reactive<WebConfig>(load());

/** Persist the current config snapshot (plain-object clone, JSON-safe). */
export function persistConfig(): void {
  writeJSON(STORAGE_KEY, {
    themeMode: configStore.themeMode,
    languageMode: configStore.languageMode,
    savedSearchesLive: [...configStore.savedSearchesLive],
    savedSearchesRecorded: [...configStore.savedSearchesRecorded],
    subscribedRecordedCourses: configStore.subscribedRecordedCourses.map((c) => ({ ...c })),
    sidebarCollapsed: configStore.sidebarCollapsed,
  });
}
