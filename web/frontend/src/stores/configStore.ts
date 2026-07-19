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
// AI-filtering providers (LLM only on the web; desktop's ML mode isn't ported).
export type AIServiceType = "builtin" | "copilot" | "custom";

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

/** Default public Cloudflare relay. Also the "reset" target in Settings. */
export const PUBLIC_RELAY_ENDPOINT = "https://relay.ruc.edu.kg";

export interface WebConfig {
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  savedSearchesLive: string[];
  savedSearchesRecorded: string[];
  subscribedRecordedCourses: SubscribedCourse[];
  sidebarCollapsed: boolean;
  // Base URL of the recorded-HLS relay (no trailing slash). Defaults to the
  // public Worker; may be overridden with another relay origin. Scheme matters:
  // an https page cannot fetch an http relay (mixed active content) — see
  // settingsStore.setRelayEndpoint / isMixedContentRelay.
  relayEndpoint: string;
  // Run post-processing (pHash phases) automatically after each saved slide
  // during watch-mode extraction. Desktop parity: `autoPostProcessingLive`.
  autoPostProcessingLive: boolean;
  // Auto-create a cloud note (ASuser group) while extracting and append the
  // captured slides. Desktop parity: `cloudWatchSyncEnabled`.
  cloudWatchSyncEnabled: boolean;
  // Per-badge intent that cloud storage (ASnote + ASuser) was initialized.
  // Server group list is still the authority; this only distinguishes
  // "never initialized" from "was initialized, group deleted → repair".
  // Desktop parity: `cloudStorageInitializedUsers`.
  cloudStorageInitializedUsers: string[];
  // AI filtering (post-processing phase 3). Desktop parity: `enableAIFiltering`
  // + the aiFiltering config block, LLM-only and simplified for the web.
  aiFilteringEnabled: boolean;
  aiServiceType: AIServiceType;
  // GitHub Copilot via the copilot-proxy Worker: gho_/ghu_ user token from the
  // device flow (or pasted), plus display identity captured at connect time.
  aiCopilotToken: string;
  aiCopilotModel: string;
  aiCopilotUsername: string;
  aiCopilotAvatarUrl: string;
  // Custom OpenAI-compatible endpoint (must allow browser CORS).
  aiCustomBaseUrl: string;
  aiCustomApiKey: string;
  aiCustomModel: string;
}

const defaults = (): WebConfig => ({
  themeMode: "system",
  languageMode: "system",
  savedSearchesLive: [],
  savedSearchesRecorded: [],
  subscribedRecordedCourses: [],
  sidebarCollapsed: false,
  relayEndpoint: PUBLIC_RELAY_ENDPOINT,
  autoPostProcessingLive: true,
  cloudWatchSyncEnabled: false,
  cloudStorageInitializedUsers: [],
  aiFilteringEnabled: false,
  aiServiceType: "builtin",
  aiCopilotToken: "",
  aiCopilotModel: "gpt-4.1",
  aiCopilotUsername: "",
  aiCopilotAvatarUrl: "",
  aiCustomBaseUrl: "",
  aiCustomApiKey: "",
  aiCustomModel: "",
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

  // Heal missing / malformed relay endpoints from older configs or bad edits.
  const normalized = normalizeRelayEndpoint(merged.relayEndpoint || "");
  merged.relayEndpoint = normalized || PUBLIC_RELAY_ENDPOINT;

  // Heal pre-init configs that never had the flag array.
  if (!Array.isArray(merged.cloudStorageInitializedUsers)) {
    merged.cloudStorageInitializedUsers = [];
  }

  return merged;
}

// Reactive singleton — read synchronously anywhere; mutate via the helpers so
// every change is written through to localStorage.
export const configStore = reactive<WebConfig>(load());

/**
 * Normalize a relay endpoint the user typed:
 * - trim whitespace
 * - strip trailing slashes
 * - if no scheme, default to https:// (public relay is HTTPS; LAN http must
 *   be typed explicitly so mixed-content risk is intentional)
 * - accept only http: / https:
 * Returns null when the value is empty or not a usable absolute URL.
 */
export function normalizeRelayEndpoint(raw: string): string | null {
  let s = (raw || "").trim();
  if (!s) return null;
  // Bare host/path without scheme → assume https (safe default for public).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
    s = `https://${s}`;
  }
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Drop path/query/hash — the relay routes are always /playlist + /segment
  // at the origin. Non-default ports are preserved via URL.origin.
  const origin = url.origin; // already no trailing slash
  return origin;
}

/** Persist the current config snapshot (plain-object clone, JSON-safe). */
export function persistConfig(): void {
  writeJSON(STORAGE_KEY, {
    themeMode: configStore.themeMode,
    languageMode: configStore.languageMode,
    savedSearchesLive: [...configStore.savedSearchesLive],
    savedSearchesRecorded: [...configStore.savedSearchesRecorded],
    subscribedRecordedCourses: configStore.subscribedRecordedCourses.map((c) => ({ ...c })),
    sidebarCollapsed: configStore.sidebarCollapsed,
    relayEndpoint: configStore.relayEndpoint || PUBLIC_RELAY_ENDPOINT,
    autoPostProcessingLive: configStore.autoPostProcessingLive,
    cloudWatchSyncEnabled: configStore.cloudWatchSyncEnabled,
    cloudStorageInitializedUsers: [...configStore.cloudStorageInitializedUsers],
    aiFilteringEnabled: configStore.aiFilteringEnabled,
    aiServiceType: configStore.aiServiceType,
    aiCopilotToken: configStore.aiCopilotToken,
    aiCopilotModel: configStore.aiCopilotModel,
    aiCopilotUsername: configStore.aiCopilotUsername,
    aiCopilotAvatarUrl: configStore.aiCopilotAvatarUrl,
    aiCustomBaseUrl: configStore.aiCustomBaseUrl,
    aiCustomApiKey: configStore.aiCustomApiKey,
    aiCustomModel: configStore.aiCustomModel,
  });
}

/** Whether this account badge has previously initialized cloud storage. */
export function isCloudStorageInitialized(badge: string): boolean {
  if (!badge) return false;
  return (configStore.cloudStorageInitializedUsers ?? []).includes(badge);
}

/**
 * Persist per-badge cloud-storage init intent. The server group list remains the
 * authority on whether ASnote/ASuser exist; this flag only drives repair vs.
 * "never initialized".
 */
export function setCloudStorageInitialized(badge: string, initialized: boolean): void {
  if (!badge) return;
  const set = new Set(configStore.cloudStorageInitializedUsers ?? []);
  if (initialized) set.add(badge);
  else set.delete(badge);
  configStore.cloudStorageInitializedUsers = [...set];
  persistConfig();
}
