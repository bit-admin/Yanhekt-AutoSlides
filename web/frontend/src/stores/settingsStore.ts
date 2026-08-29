import {
  configStore,
  persistConfig,
  normalizeRelayEndpoint,
  type LanguageMode,
  type ThemeMode,
} from "./configStore";
import { detectSystemLocale, setLocale, type AppLocale } from "../i18n";

// Applies theme + language preferences held in configStore. The desktop app
// delegates theme to Electron's nativeTheme (which drives prefers-color-scheme);
// the browser can't force that, so we resolve the effective scheme ourselves
// and stamp `data-theme` on <html> — theme.css keys its dark tokens off it.

const prefersDark =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return prefersDark?.matches ? "dark" : "light";
  return mode;
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(configStore.themeMode));
}

export function setThemeMode(mode: ThemeMode): void {
  configStore.themeMode = mode;
  persistConfig();
  applyTheme();
}

function resolveLanguage(mode: LanguageMode): AppLocale {
  return mode === "system" ? detectSystemLocale() : mode;
}

function applyLanguage(): void {
  setLocale(resolveLanguage(configStore.languageMode));
}

export function setLanguageMode(mode: LanguageMode): void {
  configStore.languageMode = mode;
  persistConfig();
  applyLanguage();
}

/**
 * Persist a relay endpoint after normalization. Empty string stores built-in
 * (same-origin). Returns the stored origin (possibly ""), or null if the
 * input was invalid (config is left unchanged).
 */
export function setRelayEndpoint(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    configStore.relayEndpoint = "";
    persistConfig();
    return "";
  }
  const normalized = normalizeRelayEndpoint(trimmed);
  if (!normalized) return null;
  configStore.relayEndpoint = normalized;
  persistConfig();
  return normalized;
}

/** Restore built-in same-origin `/playlist` (empty endpoint). */
export function resetRelayEndpoint(): string {
  configStore.relayEndpoint = "";
  persistConfig();
  return "";
}

/**
 * True when the page is served over HTTPS but the configured relay is HTTP.
 * Browsers block that as mixed active content — HLS fetch/XHR will fail.
 * Local Electron relays are plain HTTP, so this is the common LAN pitfall.
 */
export function isMixedContentRelay(endpoint?: string): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.protocol !== "https:") return false;
  const ep = endpoint ?? configStore.relayEndpoint;
  try {
    return new URL(ep).protocol === "http:";
  } catch {
    return false;
  }
}

/** Apply persisted preferences at startup and follow OS scheme in system mode. */
export function initSettings(): void {
  applyTheme();
  applyLanguage();
  // Track the OS scheme so "Follow System" updates live.
  prefersDark?.addEventListener("change", () => {
    if (configStore.themeMode === "system") applyTheme();
  });
}
