import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import { configStore } from "../stores/configStore";

export type MessageSchema = typeof en;
export type AppLocale = "en" | "zh";

/** Resolve the browser's preferred locale to one of the two supported ones. */
export function detectSystemLocale(): AppLocale {
  const systemLang = navigator.language || navigator.languages?.[0] || "en";
  return systemLang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

// Initial locale resolved from the persisted language mode ('system' follows
// the browser). Persistence itself is owned by configStore + settingsStore.
function initialLocale(): AppLocale {
  const mode = configStore.languageMode;
  return mode === "system" ? detectSystemLocale() : mode;
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: "en",
  messages: { en, zh },
  globalInjection: true,
});

/** Low-level i18n switch. Callers persist via settingsStore.setLanguageMode. */
export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
}

export function getCurrentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}
