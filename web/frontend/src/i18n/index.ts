import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import { configStore } from "../stores/configStore";

// Web-only strings layered over the locale files copied verbatim from the
// desktop app (kept separate so the copies stay diffable against upstream).
const webEn = {
  webAuth: {
    pageTitle: "Sign In",
    signInWithPassword: "Sign in with Password",
    signInWithToken: "Sign in with Token",
    passwordTitle: "Sign in with Password",
    tokenTitle: "Sign in with Token",
    usernamePlaceholder: "Student ID",
    passwordPlaceholder: "Password",
    signIn: "Sign In",
    signingIn: "Signing in…",
    tokenPlaceholder: "Paste your Yanhekt token here",
    tokenConfirm: "Verify",
    tokenContinue: "Continue",
    tokenHint:
      "Drag the button above to your bookmarks bar, then click it on yanhekt.cn to fetch your token.",
    bookmarkletLabel: "Get Yanhekt Token",
    bookmarkletDrag: "Drag me",
    invalidToken: "Invalid token, please try again",
    passwordDisclaimer:
      "Your credentials are only used to sign in to school SSO and are never stored.",
    chooseTitle: "Sign in to AutoSlides",
    chooseSubtitle: "to see your live streams and recordings",
    formTitle: "Sign in",
    continueSubtitle: "to continue to AutoSlides",
    passwordOptionDesc: "Sign in with your school SSO account",
    tokenOptionDesc: "Import a session from yanhekt.cn",
    back: "Back",
    close: "Close",
    help: "Help",
    privacy: "Privacy",
    terms: "Terms",
  },
};

const webZh = {
  webAuth: {
    pageTitle: "登录",
    signInWithPassword: "使用密码登录",
    signInWithToken: "使用 Token 登录",
    passwordTitle: "密码登录",
    tokenTitle: "Token 登录",
    usernamePlaceholder: "学号",
    passwordPlaceholder: "密码",
    signIn: "登录",
    signingIn: "登录中…",
    tokenPlaceholder: "在此粘贴延河课堂 Token",
    tokenConfirm: "验证",
    tokenContinue: "继续",
    tokenHint: "将上方的按钮拖到书签栏，然后在 yanhekt.cn 点击它获取你的 Token。",
    bookmarkletLabel: "获取延河课堂 Token",
    bookmarkletDrag: "拖动我",
    invalidToken: "Token 无效，请重试",
    passwordDisclaimer: "您的账号密码仅用于登录学校统一身份认证，不会被存储。",
    chooseTitle: "登录 AutoSlides",
    chooseSubtitle: "查看你的直播和录播",
    formTitle: "登录",
    continueSubtitle: "以继续使用 AutoSlides",
    passwordOptionDesc: "使用你的统一身份认证账号登录",
    tokenOptionDesc: "从延河课堂导入登录状态",
    back: "返回",
    close: "关闭",
    help: "帮助",
    privacy: "隐私",
    terms: "条款",
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
