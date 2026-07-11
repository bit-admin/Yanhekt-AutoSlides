import { configStore, persistConfig, type LanguageMode, type ThemeMode } from "./configStore";
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

/** Apply persisted preferences at startup and follow OS scheme in system mode. */
export function initSettings(): void {
  applyTheme();
  applyLanguage();
  // Track the OS scheme so "Follow System" updates live.
  prefersDark?.addEventListener("change", () => {
    if (configStore.themeMode === "system") applyTheme();
  });
}
