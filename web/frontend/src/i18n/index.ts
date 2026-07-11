import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import { configStore } from "../stores/configStore";

// Web-only strings layered over the locale files copied verbatim from the
// desktop app (kept separate so the copies stay diffable against upstream).
const webEn = {
  webAuth: {
    signInWithPassword: "Sign in with Password",
    signInWithToken: "Sign in with Token",
    passwordTitle: "Sign in with Password",
    tokenTitle: "Sign in with Token",
    usernamePlaceholder: "Student ID",
    passwordPlaceholder: "Password",
    signIn: "Sign In",
    signingIn: "Signing in…",
    tokenPlaceholder: "Paste your Yanhekt token here",
    tokenConfirm: "Verify & Sign In",
    tokenHint:
      "Drag the button below to your bookmarks bar, open yanhekt.cn and sign in, then click the bookmark to fetch your token.",
    bookmarkletLabel: "Get AutoSlides Token",
    invalidToken: "Invalid token, please try again",
    passwordDisclaimer:
      "Your credentials are only used to sign in to school SSO and are never stored.",
  },
};

const webZh = {
  webAuth: {
    signInWithPassword: "密码登录",
    signInWithToken: "Token 登录",
    passwordTitle: "密码登录",
    tokenTitle: "Token 登录",
    usernamePlaceholder: "学号",
    passwordPlaceholder: "密码",
    signIn: "登录",
    signingIn: "登录中…",
    tokenPlaceholder: "在此粘贴延河课堂 Token",
    tokenConfirm: "验证并登录",
    tokenHint: "将下方按钮拖到书签栏，打开延河课堂并登录后，点击该书签即可获取 Token。",
    bookmarkletLabel: "获取 AutoSlides Token",
    invalidToken: "Token 无效，请重试",
    passwordDisclaimer: "您的账号密码仅用于登录学校统一身份认证，不会被存储。",
  },
};

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
  messages: { en: { ...en, ...webEn }, zh: { ...zh, ...webZh } },
  globalInjection: true,
});

/** Low-level i18n switch. Callers persist via settingsStore.setLanguageMode. */
export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
}

export function getCurrentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}
